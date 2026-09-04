"use client";

import { useEffect, useState } from "react";
import {
  Shield, CheckCircle2, Trash2, AlertTriangle, UserX,
  RefreshCw, ChevronDown, ChevronLeft, Bot, CheckCheck, XCircle,
  History, Eye, EyeOff, Clock, Maximize2, ImageIcon, X,
} from "lucide-react";
import { ReviewQueue } from "./ReviewQueue";
import { DateRangePicker, isWithinDateRange } from "@/components/shared/DateRangePicker";
import { ConfirmModal } from "@/components/shared/ConfirmModal";

interface Report {
  id: string;
  reason: string;
  createdAt: string;
  type: "question" | "answer" | "chat";
  source: "forum" | "chat";
  questionId: string | null;
  answerId: string | null;
  questionTitle: string | null;
  answerContent: string | null;
  fullContent: string | null;
  imageUrl: string | null;
  reporterId: string | null;
  reporterName: string;
  reporterEmail: string;
  authorId?: string | null;
  authorName?: string | null;
  authorEmail?: string | null;
  messageId?: string | null;
  conversationId?: string | null;
  messageSequence?: string | null;
}

interface ModerationHistoryEntry {
  id: string;
  reportId: string | null;
  source: string;
  contentType: string | null;
  contentPreview: string | null;
  reason: string | null;
  authorId: string | null;
  authorName: string | null;
  reporterId: string | null;
  reporterName: string | null;
  actionTaken: string;
  adminNotes: string | null;
  resolvedAt: string;
  resolvedAtDisplay: string;
}

interface ContextMessage {
  id: string;
  senderId: string;
  senderName: string | null;
  content: string;
  type: string;
  sequenceNo: string;
  createdAt: string;
  deletedAt: string | null;
}

interface ModerationStats {
  totalReports: string;
  pendingForum?: string;
  pendingChat?: string;
  deletedPosts: string;
  suspendedUsers: string;
  reportsToday: string;
  blockedToday?: number;
  blockedChatToday?: number;
  blockedForumToday?: number;
}

interface AiFlag {
  id: string;
  contentType: string;
  contentId: string;
  userId: string;
  text: string | null;
  provider: string;
  score: number;
  categories: string[];
  status: string;
  createdAt: string;
}

const FLAG_STATUS_COLORS: Record<string, string> = {
  PENDING:   "bg-amber-100 text-amber-700",
  REVIEWED:  "bg-blue-100 text-blue-700",
  ACTIONED:  "bg-red-100 text-red-700",
  DISMISSED: "bg-gray-100 text-gray-500",
};

const ACTION_BADGE: Record<string, { label: string; cls: string }> = {
  APPROVED:           { label: "✓ Approved",         cls: "bg-green-100 text-green-700" },
  CONTENT_REMOVED:    { label: "🗑 Content Removed",  cls: "bg-red-100 text-red-700" },
  USER_WARNED:        { label: "⚠ Warned",            cls: "bg-yellow-100 text-yellow-700" },
  USER_WARNED_AND_SUSPENDED: { label: "⚠ Warned + Suspended", cls: "bg-orange-100 text-orange-700" },
  USER_PERMANENTLY_BANNED: { label: "🚫 Permanently Banned", cls: "bg-red-200 text-red-900" },
  UNSUSPENDED:        { label: "✔ Unsuspended",       cls: "bg-emerald-100 text-emerald-700" },
  DISMISSED:          { label: "× Dismissed",         cls: "bg-gray-100 text-gray-600" },
};

function actionBadge(action: string) {
  const match = ACTION_BADGE[action];
  if (match) return match;
  // Fallback for dynamic e.g. USER_SUSPENDED_30_DAYS
  if (action.startsWith("USER_SUSPENDED"))
    return { label: `⏱ Suspended (${action.replace("USER_SUSPENDED_", "").replace(/_/g, " ")})`, cls: "bg-orange-100 text-orange-800" };
  return { label: action.replace(/_/g, " "), cls: "bg-gray-100 text-gray-600" };
}

function resolveImageUrl(report?: Report | null): string | null {
  if (!report) return null;
  const candidates = [
    report.imageUrl,
    report.answerContent,
    report.fullContent,
    report.questionTitle,
  ];

  for (const c of candidates) {
    if (!c) continue;
    const trimmed = c.trim();
    if (
      trimmed.startsWith("/uploads/") ||
      trimmed.startsWith("http://") ||
      trimmed.startsWith("https://")
    ) {
      return trimmed;
    }
    const match = trimmed.match(/(https?:\/\/[^\s"']+|\/uploads\/[^\s"']+?\.(jpe?g|png|webp|gif|svg))/i);
    if (match) return match[0];
  }
  return null;
}

export default function ModerationPage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [history, setHistory] = useState<ModerationHistoryEntry[]>([]);
  const [stats, setStats] = useState<ModerationStats>({ totalReports: "0", deletedPosts: "0", suspendedUsers: "0", reportsToday: "0" });
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Report | null>(null);
  const [showFullContent, setShowFullContent] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // AI Flags state
  const [aiFlags, setAiFlags] = useState<AiFlag[]>([]);
  const [flagsLoading, setFlagsLoading] = useState(false);
  const [flagActionId, setFlagActionId] = useState<string | null>(null);

  // Review Workflow state
  const [showWorkflow, setShowWorkflow] = useState(false);
  const [workflowReport, setWorkflowReport] = useState<Report | null>(null);
  const [contextMessages, setContextMessages] = useState<ContextMessage[] | null>(null);
  const [contextLoading, setContextLoading] = useState(false);
  const [removeReason, setRemoveReason] = useState("");
  const [notifyAuthor, setNotifyAuthor] = useState(true);
  const [warnCategory, setWarnCategory] = useState("Harassment");
  const [warnMessage, setWarnMessage] = useState("");
  const [triggerSuspend, setTriggerSuspend] = useState(false);
  const [escalate, setEscalate] = useState(false);
  const [banReason, setBanReason] = useState("Severe Community Violation");
  const [banDuration, setBanDuration] = useState("Permanent");
  // Internal-only audit notes for the ban action — never shown to the
  // banned user (was misleadingly named banEmail; it was never an email).
  const [banInternalNotes, setBanInternalNotes] = useState("");
  const [banConfirm, setBanConfirm] = useState(false);

  // Load surrounding conversation context whenever a chat-sourced report is
  // opened in the review workflow, so the admin isn't deciding based on one
  // line out of context.
  useEffect(() => {
    if (!showWorkflow || workflowReport?.source !== "chat" || !workflowReport.conversationId || !workflowReport.messageSequence) {
      setContextMessages(null);
      return;
    }
    let cancelled = false;
    setContextLoading(true);
    setContextMessages(null);
    fetch(`/api/moderation/context?conversationId=${encodeURIComponent(workflowReport.conversationId)}&sequence=${encodeURIComponent(workflowReport.messageSequence)}`)
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled && data.success) setContextMessages(data.messages);
      })
      .catch((e) => console.error("Failed to load report context:", e))
      .finally(() => { if (!cancelled) setContextLoading(false); });
    return () => { cancelled = true; };
  }, [showWorkflow, workflowReport]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/moderation");
      const data = await res.json();
      if (data.success) {
        setReports(data.reports);
        setStats(data.stats);
        setHistory(data.history ?? []);
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const fetchFlags = async () => {
    setFlagsLoading(true);
    try {
      const res = await fetch("/api/moderation/flags?status=PENDING&limit=20");
      const data = await res.json() as { success: boolean; data?: { flags: AiFlag[] } };
      if (data.success) setAiFlags(data.data?.flags ?? []);
    } catch { /* non-critical */ }
    finally { setFlagsLoading(false); }
  };

  const updateFlagStatus = async (id: string, status: string) => {
    setFlagActionId(id);
    try {
      await fetch(`/api/moderation/flags/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, reviewedBy: "admin" }),
      });
      await fetchFlags();
    } finally { setFlagActionId(null); }
  };

  useEffect(() => { fetchData(); fetchFlags(); }, []);

  // Low-level poster used by warn/ban flows.
  const postAction = async (payload: Record<string, unknown>) => {
    const res = await fetch("/api/moderation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return res.json();
  };

  const handleAction = async (action: string, report: Report) => {
    // Chat/DM reports dismiss to a different table.
    const effectiveAction = action === "dismiss" && report.source === "chat" ? "dismiss_chat" : action;
    setActionLoading(report.id + action);
    const contentPreview = (report.questionTitle || report.answerContent || report.fullContent || "Reported content").slice(0, 120);
    try {
      await postAction({
        action: effectiveAction,
        reportId: report.id,
        source: report.source,
        questionId: report.questionId,
        answerId: report.answerId,
        messageId: report.messageId,
        userId: report.authorId,
        contentPreview,
        authorName: report.authorName,
        reporterName: report.reporterName,
        reason: report.reason,
      });
      await fetchData();
      if (selected?.id === report.id) setSelected(null);
    } finally { setActionLoading(null); }
  };

  const [activeTab, setActiveTab] = useState<"queue" | "forum-reports" | "ai-flags" | "history">("queue");
  const [historyDateFrom, setHistoryDateFrom] = useState("");
  const [historyDateTo, setHistoryDateTo] = useState("");
  const [selectedHistoryEntry, setSelectedHistoryEntry] = useState<ModerationHistoryEntry | null>(null);
  const [actionErrorMsg, setActionErrorMsg] = useState("");

  // The Forum Reports tab shows forum-sourced reports only — chat/DM reports
  // are handled from the unified Review Queue tab.
  const forumReports = reports.filter(r => r.source === "forum");

  // Send a warning to the offending user (the reported content's author).
  const handleWarn = async () => {
    if (!workflowReport?.authorId) { setActionErrorMsg("This report has no identifiable author to warn."); return; }
    setActionLoading("warn");
    const contentPreview = (workflowReport.questionTitle || workflowReport.answerContent || workflowReport.fullContent || "Reported content").slice(0, 120);
    try {
      const data = await postAction({
        action: "warn",
        source: workflowReport.source,
        reportId: workflowReport.id,
        userId: workflowReport.authorId,
        conversationId: workflowReport.conversationId,
        category: warnCategory,
        message: warnMessage,
        triggerSuspend,
        contentPreview,
        authorName: workflowReport.authorName,
        reporterName: workflowReport.reporterName,
        reason: workflowReport.reason,
      });
      if (!data.success) throw new Error(data.message);
      setShowWorkflow(false);
      setSelected(null);
      setWarnMessage("");
      await fetchData();
    } catch (e: any) {
      setActionErrorMsg(e?.message || "Failed to send warning.");
    } finally { setActionLoading(null); }
  };

  // Ban (suspend) the offending user.
  const handleBan = async () => {
    if (!workflowReport?.authorId) { setActionErrorMsg("This report has no identifiable author to ban."); return; }
    setActionLoading("ban");
    const contentPreview = (workflowReport.questionTitle || workflowReport.answerContent || workflowReport.fullContent || "User account").slice(0, 120);
    try {
      const data = await postAction({
        action: "ban",
        source: workflowReport.source,
        reportId: workflowReport.id,
        userId: workflowReport.authorId,
        conversationId: workflowReport.conversationId,
        reason: banReason,
        duration: banDuration !== "Permanent" ? banDuration : undefined,
        internalNotes: banInternalNotes,
        contentPreview,
        authorName: workflowReport.authorName,
        reporterName: workflowReport.reporterName,
      });
      if (!data.success) throw new Error(data.message);
      setShowWorkflow(false);
      setSelected(null);
      setBanConfirm(false);
      setBanInternalNotes("");
      await fetchData();
    } catch (e: any) {
      setActionErrorMsg(e?.message || "Failed to ban user.");
    } finally { setActionLoading(null); }
  };

  const handleOpenWorkflow = (item: any) => {
    const report: Report = {
      id: item.id,
      reason: item.summary || item.reason || "Reported content",
      // Prefer the raw timestamp. /api/moderation sends a pre-formatted
      // date-only string, which the header below would parse as midnight
      // and render with the wrong time; /api/moderation/review sends ISO.
      createdAt: item.createdAtISO || item.createdAt,
      type: item.contentType === "question" ? "question" : item.contentType === "answer" ? "answer" : "chat",
      source: item.source || (item.kind === "chat_report" ? "chat" : "forum"),
      questionId: item.questionId || (item.contentType === "question" ? item.contentId : null),
      answerId: item.answerId || (item.contentType === "answer" ? item.contentId : null),
      messageId: item.messageId || (item.source === "chat" ? item.contentId : null),
      conversationId: item.conversationId || null,
      messageSequence: item.messageSequence || null,
      questionTitle: item.questionTitle || (item.contentType === "question" ? item.contentPreview : null),
      answerContent: item.answerContent || (item.contentType === "answer" || item.source === "chat" ? item.contentPreview : null),
      fullContent: item.contentPreview || item.fullContent || null,
      imageUrl: item.imageUrl || null,
      reporterId: item.reporterId || null,
      reporterName: item.reporterName || "Reporter",
      reporterEmail: item.reporterEmail || "",
      authorId: item.userId || null,
      authorName: item.userName || "Author",
      authorEmail: item.userEmail || "",
    };
    // Reset all per-report form state so values don't bleed between reports
    setRemoveReason("");
    setNotifyAuthor(true);
    setWarnCategory("Harassment");
    setWarnMessage("");
    setTriggerSuspend(false);
    setEscalate(false);
    setBanReason("Severe Community Violation");
    setBanDuration("Permanent");
    setBanInternalNotes("");
    setBanConfirm(false);
    setWorkflowReport(report);
    setShowWorkflow(true);
  };

  if (showWorkflow && workflowReport) {
    return (
      <div className="px-4 sm:px-6 lg:px-8 py-8 max-w-6xl mx-auto space-y-6">
        {/* HEADER BAR */}
        <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
          <div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => { setShowWorkflow(false); setWorkflowReport(null); }}
                className="h-9 px-3 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-xs font-bold text-[#4B4355] flex items-center gap-1.5 transition shadow-xs"
              >
                <ChevronLeft className="w-4 h-4" /> Back to Queue
              </button>
              <h1 className="text-xl font-extrabold text-[#1A1C1C]">Review Workflow</h1>
              <span className={`px-2.5 py-1 rounded-full text-xs font-extrabold uppercase ${workflowReport.source === "chat" ? "bg-blue-100 text-blue-700" : "bg-purple-100 text-purple-700"}`}>
                {workflowReport.source === "chat" ? "💬 Chat Message" : "📋 Forum Content"}
              </span>
            </div>
            <p className="text-sm text-[#7D7387] mt-1.5">
              Report filed on{" "}
              <span className="font-semibold text-[#1A1C1C]">
                {(() => {
                  const d = new Date(workflowReport.createdAt);
                  return isNaN(d.getTime())
                    ? workflowReport.createdAt
                    : d.toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
                })()}
              </span>{" "}by{" "}
              <span className="font-bold text-[#1A1C1C]">{workflowReport.reporterName}</span> ({workflowReport.reporterEmail || "User"}).
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              disabled={actionLoading === "dismiss"}
              onClick={async () => {
                setActionLoading("dismiss");
                try {
                  const contentPreview = (workflowReport.questionTitle || workflowReport.answerContent || workflowReport.fullContent || "Reported content").slice(0, 120);
                  await postAction({
                    action: workflowReport.source === "chat" ? "dismiss_chat" : "dismiss",
                    reportId: workflowReport.id,
                    source: workflowReport.source,
                    questionId: workflowReport.questionId,
                    answerId: workflowReport.answerId,
                    messageId: workflowReport.messageId,
                    userId: workflowReport.authorId,
                    contentPreview,
                    authorName: workflowReport.authorName,
                    reporterName: workflowReport.reporterName,
                    reason: workflowReport.reason,
                  });
                  setShowWorkflow(false);
                  setWorkflowReport(null);
                  await fetchData();
                } finally { setActionLoading(null); }
              }}
              className="h-10 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-300 text-white font-bold text-xs flex items-center gap-1.5 transition shadow-sm"
            >
              <CheckCircle2 className="w-4 h-4" /> {actionLoading === "dismiss" ? "Dismissing…" : "Dismiss Report (No Violation)"}
            </button>
          </div>
        </div>

        {/* CONVERSATION CONTEXT FOR CHAT */}
        {workflowReport.source === "chat" && workflowReport.conversationId && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-extrabold text-[#1A1C1C]">Conversation Context</h3>
              <span className="text-xs text-[#7D7387]">Showing surrounding conversation messages</span>
            </div>
            {contextLoading && (
              <div className="py-8 text-center text-xs font-semibold text-slate-400">Loading surrounding messages…</div>
            )}
            {!contextLoading && contextMessages && contextMessages.length === 0 && (
              <p className="text-sm text-[#7D7387]">
                No surrounding messages found — the conversation may have been deleted since this report was filed.
              </p>
            )}
            {!contextLoading && contextMessages && contextMessages.length > 0 && (
              <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
                {contextMessages.map((m) => {
                  const isReported = m.sequenceNo === workflowReport.messageSequence;
                  return (
                    <div
                      key={m.id}
                      className={`rounded-xl p-3.5 text-sm transition ${
                        isReported
                          ? "bg-red-50/80 border-2 border-red-200 shadow-xs"
                          : "bg-[#F7F5FA]"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-[#1A1C1C]">{m.senderName || "Unknown Member"}</span>
                        <span className="text-xs text-[#9A93A8]">
                          {(() => {
                            const d = new Date(m.createdAt);
                            return d.toLocaleString("en-GB", {
                              day: "2-digit", month: "short", year: "numeric",
                              hour: "2-digit", minute: "2-digit", second: "2-digit",
                            });
                          })()}
                        </span>
                      </div>
                      {m.deletedAt ? (
                        <p className="leading-5 italic text-[#9A93A8]">(message deleted)</p>
                      ) : m.type === "IMAGE" ? (
                        <div className="mt-1 rounded-xl overflow-hidden border border-gray-200 bg-white p-1.5">
                          <img
                            src={m.content}
                            alt="Reported chat image"
                            className="max-h-[600px] w-full object-contain rounded-lg"
                          />
                        </div>
                      ) : (
                        <p className="leading-5 text-[#4B4355]">{m.content}</p>
                      )}
                      {isReported && (
                        <span className="inline-block mt-2 px-2 py-0.5 rounded-md bg-red-100 text-[10px] font-extrabold text-red-700 uppercase tracking-wide">
                          ⚠ Reported message
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* FORUM CONTENT CONTEXT */}
        {workflowReport.source === "forum" && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <h3 className="text-sm font-extrabold text-[#1A1C1C] mb-3">Reported Forum Content Details</h3>
            <div className="bg-[#F7F5FA] rounded-xl p-4 border border-gray-200">
              {workflowReport.questionTitle && (
                <h4 className="font-bold text-base text-[#1A1C1C] mb-1">{workflowReport.questionTitle}</h4>
              )}
              <p className="text-sm text-[#4B4355] leading-relaxed">
                {workflowReport.answerContent || workflowReport.fullContent || "(No text content)"}
              </p>
              {(() => {
                const imgUrl = resolveImageUrl(workflowReport);
                if (!imgUrl) return null;
                return (
                  <div className="mt-4 rounded-xl overflow-hidden border border-gray-200 bg-white p-2">
                    <img
                      src={imgUrl}
                      alt="Reported forum media"
                      className="max-h-[600px] w-full object-contain rounded-lg"
                    />
                  </div>
                );
              })()}
            </div>
          </div>
        )}

        {/* ACTION CARDS */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* REMOVE CONTENT CARD */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <AlertTriangle className="w-5 h-5 text-red-600" />
                <h3 className="text-xl font-extrabold text-red-600">Remove This Content?</h3>
              </div>
              <div className="border-l-4 border-[#7004DC] pl-4 mb-4">
                <p className="text-sm text-[#4B4355] leading-5 italic">
                  "{workflowReport.questionTitle || workflowReport.answerContent || workflowReport.fullContent || "The reported content appears to violate community guidelines."}"
                </p>
              </div>
              <div className="bg-red-50 rounded-xl p-4 mb-4 space-y-2 border border-red-100">
                {["Content will be permanently deleted", "The author will be notified", "This action cannot be undone"].map(item => (
                  <div key={item} className="flex items-center gap-2 text-xs font-semibold text-red-700">
                    <span className="shrink-0 text-red-500 font-bold">✕</span> {item}
                  </div>
                ))}
              </div>
              <div className="mb-4">
                <label className="block text-xs font-bold uppercase tracking-wider text-[#1A1C1C] mb-2">Reason for Removal</label>
                <input
                  value={removeReason}
                  onChange={e => setRemoveReason(e.target.value)}
                  placeholder="Select or type reason..."
                  className="w-full h-11 rounded-xl border border-gray-200 px-4 text-sm outline-none focus:border-red-400"
                />
              </div>
              <div className="flex items-center justify-between mb-5">
                <span className="text-sm text-[#4B4355] font-semibold">Notify author of removal</span>
                <button
                  type="button"
                  onClick={() => setNotifyAuthor(v => !v)}
                  className={`w-12 h-6 rounded-full transition relative ${notifyAuthor ? "bg-[#7004DC]" : "bg-gray-200"}`}
                >
                  <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${notifyAuthor ? "right-1" : "left-1"}`} />
                </button>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => { setShowWorkflow(false); setWorkflowReport(null); }}
                className="flex-1 h-11 rounded-xl border border-gray-200 text-[#4B4355] font-bold text-sm hover:bg-gray-50 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={actionLoading === "remove"}
                onClick={async () => {
                  setActionLoading("remove");
                  const contentPreview = (workflowReport.questionTitle || workflowReport.answerContent || workflowReport.fullContent || "Reported content").slice(0, 120);
                  try {
                    const res = await postAction({
                      action: "delete_post",
                      reportId: workflowReport.id,
                      source: workflowReport.source,
                      questionId: workflowReport.questionId,
                      answerId: workflowReport.answerId,
                      messageId: workflowReport.messageId,
                      conversationId: workflowReport.conversationId,
                      userId: workflowReport.authorId,
                      contentPreview,
                      authorName: workflowReport.authorName,
                      reporterName: workflowReport.reporterName,
                      reason: removeReason || workflowReport.reason || "Content violation",
                      notifyAuthor,
                    });
                    if (!res.success) throw new Error(res.message);
                    setShowWorkflow(false);
                    setWorkflowReport(null);
                    setRemoveReason("");
                    await fetchData();
                  } catch (e: any) {
                    setActionErrorMsg(e?.message || "Failed to remove content.");
                  } finally { setActionLoading(null); }
                }}
                className="flex-1 h-11 rounded-xl bg-red-600 hover:bg-red-700 disabled:bg-red-300 disabled:cursor-not-allowed text-white font-bold text-sm transition shadow-sm"
              >
                {actionLoading === "remove" ? "Removing…" : "Remove Content"}
              </button>
            </div>
          </div>

          {/* WARN USER CARD */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 flex flex-col justify-between">
            <div>
              <div className="mb-3">
                <h3 className="text-xl font-extrabold text-[#1A1C1C]">Warn User</h3>
                <p className="text-base font-bold text-[#7004DC]">{workflowReport.authorName || "Unknown author"}</p>
                {workflowReport.authorEmail && (
                  <p className="text-xs text-[#7D7387]">{workflowReport.authorEmail}</p>
                )}
              </div>

              <div className="bg-amber-50 rounded-xl p-3 mb-4 border border-amber-200">
                <p className="text-xs font-bold text-amber-800">Community Safety Standard</p>
                <div className="grid grid-cols-2 gap-2 mt-1.5">
                  <div className="bg-white rounded-lg p-2 border border-amber-100">
                    <p className="text-[10px] font-bold uppercase text-slate-400">Warning Action</p>
                    <p className="text-xs font-semibold text-[#4B4355]">7-day suspension</p>
                  </div>
                  <div className="bg-white rounded-lg p-2 border border-amber-100">
                    <p className="text-[10px] font-bold uppercase text-slate-400">Repeated Violation</p>
                    <p className="text-xs font-semibold text-[#4B4355]">Account ban</p>
                  </div>
                </div>
              </div>

              <div className="mb-4">
                <p className="text-xs font-bold uppercase tracking-wider text-[#1A1C1C] mb-2">Violation Category</p>
                <div className="flex flex-wrap gap-2">
                  {["Harassment", "Spam", "Misinformation", "Inappropriate Content", "Custom"].map(cat => (
                    <button
                      type="button"
                      key={cat}
                      onClick={() => setWarnCategory(cat)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold border-2 transition ${
                        warnCategory === cat
                          ? "border-[#7004DC] bg-violet-50 text-[#7004DC]"
                          : "border-transparent bg-[#F3F3F3] text-[#4B4355] hover:bg-[#EBEBEB]"
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mb-4">
                <label className="block text-xs font-bold uppercase tracking-wider text-[#1A1C1C] mb-2">Custom Message to User</label>
                <textarea
                  value={warnMessage}
                  onChange={e => setWarnMessage(e.target.value)}
                  rows={3}
                  placeholder="Write a brief explanation of why the user is being warned..."
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-[#8A38F5] resize-none"
                />
              </div>

              <div className="space-y-2 mb-4">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-[#4B4355]">
                  <input
                    type="checkbox"
                    checked={triggerSuspend}
                    onChange={e => setTriggerSuspend(e.target.checked)}
                    className="w-4 h-4 rounded accent-[#7004DC]"
                  />
                  Trigger automatic 7-day suspension
                </label>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => { setShowWorkflow(false); setWorkflowReport(null); }}
                className="flex-1 h-11 rounded-xl border border-gray-200 text-[#4B4355] font-bold text-sm hover:bg-gray-50 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleWarn}
                disabled={!workflowReport.authorId || actionLoading === "warn"}
                className="flex-1 h-11 rounded-xl bg-[#D2A500] hover:bg-[#b89300] disabled:bg-[#e6d488] disabled:cursor-not-allowed text-[#4F3D00] font-bold text-sm transition shadow-sm"
              >
                {actionLoading === "warn" ? "Sending…" : "Send Warning"}
              </button>
            </div>
          </div>
        </div>

        {/* BAN USER CARD */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-xl font-extrabold text-red-600">Ban User Account?</h3>
              <p className="text-sm text-[#7D7387]">Impact for: <span className="font-bold text-[#1A1C1C]">{workflowReport.authorName || "Unknown author"}</span></p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-red-100 flex items-center justify-center text-red-600">
              <UserX className="w-6 h-6" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4 items-start">
            <div className="bg-red-50 rounded-xl p-4 border border-red-100">
              <p className="text-xs font-extrabold text-red-600 mb-2">⚠ Critical Safety Action</p>
              <ul className="space-y-1.5 text-xs text-red-700 font-medium">
                <li>• Immediate restriction from all community and chat features</li>
                <li>• Previous messages/posts hidden from community feed</li>
                <li>• Security record logged in audit trail</li>
              </ul>
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[#1A1C1C] mb-2">Internal Explanation / Notes</label>
              <textarea
                value={banInternalNotes}
                onChange={e => setBanInternalNotes(e.target.value)}
                rows={3}
                placeholder="Detailed notes for audit logs..."
                className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-red-400 resize-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4 items-start">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[#1A1C1C] mb-2">Ban Reason</label>
              <div className="relative">
                <select
                  value={banReason}
                  onChange={e => setBanReason(e.target.value)}
                  className="w-full h-11 rounded-xl border border-gray-200 px-4 text-sm outline-none focus:border-red-400 bg-white appearance-none pr-8 font-semibold"
                >
                  {["Severe Community Violation", "Repeated Harassment", "Fraud/Scam", "Illegal Activity", "Other"].map(r => <option key={r}>{r}</option>)}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[#1A1C1C] mb-2">Duration</label>
              <div className="flex gap-4 h-11 items-center">
                {["Permanent", "30 Days", "90 Days"].map(d => (
                  <label key={d} className="flex items-center gap-2 cursor-pointer text-sm font-semibold text-[#4B4355]">
                    <div onClick={() => setBanDuration(d)} className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${banDuration === d ? "border-[#7004DC]" : "border-gray-300"}`}>
                      {banDuration === d && <div className="w-2 h-2 rounded-full bg-[#7004DC]" />}
                    </div>
                    {d}
                  </label>
                ))}
              </div>
            </div>
          </div>

          <label className="flex items-center gap-2 cursor-pointer text-sm font-medium text-[#4B4355] mb-5">
            <input type="checkbox" checked={banConfirm} onChange={e => setBanConfirm(e.target.checked)} className="w-4 h-4 rounded accent-[#7004DC]" />
            I confirm this suspension/ban is necessary and justified according to safety guidelines.
          </label>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => { setShowWorkflow(false); setWorkflowReport(null); }}
              className="flex-1 h-11 rounded-xl border border-gray-200 text-[#4B4355] font-bold text-sm hover:bg-gray-50 transition"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleBan}
              disabled={!banConfirm || !workflowReport.authorId || actionLoading === "ban"}
              className="flex-1 h-11 rounded-xl bg-red-600 hover:bg-red-700 disabled:bg-red-200 disabled:cursor-not-allowed text-white font-bold text-sm transition shadow-sm"
            >
              {actionLoading === "ban" ? "Banning…" : (banDuration === "Permanent" ? "Ban User Permanently" : `Suspend for ${banDuration}`)}
            </button>
          </div>
        </div>

        <ConfirmModal
          open={!!actionErrorMsg}
          title="Action failed"
          message={actionErrorMsg}
          confirmLabel="OK"
          hideCancel
          destructive
          onConfirm={() => setActionErrorMsg("")}
          onCancel={() => setActionErrorMsg("")}
        />
      </div>
    );
  }

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 space-y-6 w-full max-w-full overflow-x-hidden">

      {/* HEADER */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-[#7004DC]" />
          <h1 className="text-xl font-extrabold text-[#7004DC]">Moderation Panel</h1>
        </div>
        <button onClick={fetchData} className="h-9 px-4 rounded-xl bg-[#F3F3F3] hover:bg-[#EBEBEB] transition flex items-center gap-2 text-sm font-semibold text-[#4B4355]">
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      {/* TAB BAR */}
      <div className="flex gap-1 mb-6 border-b border-gray-100 pb-0">
        {([
          { id: "queue" as const, label: "Review Queue", count: reports.length },
          { id: "forum-reports" as const, label: "Forum Reports", count: forumReports.length },
          { id: "ai-flags" as const, label: "AI Flags", count: aiFlags.length },
          { id: "history" as const, label: "History", count: history.length },
        ] as const).map((tab) => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2.5 text-sm font-semibold rounded-t-lg transition -mb-px border-b-2 flex items-center gap-2 ${
              activeTab === tab.id
                ? "border-[#7004DC] text-[#7004DC] bg-violet-50/50"
                : "border-transparent text-[#7D7387] hover:text-[#1A1C1C]"
            }`}>
            <span>{tab.label}</span>
            {tab.count > 0 && (
              <span className={`px-2 py-0.5 rounded-full text-[11px] font-extrabold ${
                activeTab === tab.id
                  ? "bg-[#7004DC] text-white"
                  : "bg-slate-100 text-slate-600"
              }`}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* REVIEW QUEUE TAB */}
      {activeTab === "queue" && <ReviewQueue onOpenWorkflow={handleOpenWorkflow} />}

      {/* HISTORY TAB */}
      {activeTab === "history" && (() => {
        const filteredHistory = history.filter(entry => isWithinDateRange(entry.resolvedAt, historyDateFrom, historyDateTo));
        return (
        <div>
          <div className="flex items-center gap-2 mb-5 flex-wrap">
            <History className="w-5 h-5 text-[#7004DC]" />
            <h2 className="text-lg font-extrabold text-[#1A1C1C]">Resolved Reports History</h2>
            <span className="ml-2 px-2 py-0.5 rounded-full bg-violet-100 text-violet-700 text-xs font-bold">{filteredHistory.length} records</span>
            <div className="ml-auto">
              <DateRangePicker
                from={historyDateFrom}
                to={historyDateTo}
                onFromChange={setHistoryDateFrom}
                onToChange={setHistoryDateTo}
                className="h-9 rounded-lg border border-gray-200 text-xs font-semibold text-[#4B4355] bg-white outline-none focus:border-[#7004DC]"
              />
            </div>
          </div>

          {filteredHistory.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-6 py-12 text-center">
              <Clock className="w-10 h-10 mx-auto mb-3 text-slate-300" />
              <p className="text-sm font-semibold text-slate-400">{history.length === 0 ? "No resolved reports yet" : "No resolved reports in this date range"}</p>
              <p className="text-xs text-slate-300 mt-1">{history.length === 0 ? "Resolved reports will appear here with the action taken" : "Try widening or clearing the date filter"}</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-xs text-[#7D7387] font-semibold uppercase tracking-wide">
                    <th className="text-left px-4 py-3">Content Preview</th>
                    <th className="text-left px-4 py-3">Source</th>
                    <th className="text-left px-4 py-3">Author</th>
                    <th className="text-left px-4 py-3">Reason</th>
                    <th className="text-left px-4 py-3">Action Taken</th>
                    <th className="text-left px-4 py-3">Admin Notes</th>
                    <th className="text-left px-4 py-3">Resolved At</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredHistory.map((entry) => {
                    const badge = actionBadge(entry.actionTaken);
                    return (
                      <tr
                        key={entry.id}
                        onClick={() => setSelectedHistoryEntry(entry)}
                        className="border-b border-gray-50 hover:bg-gray-50 cursor-pointer"
                      >
                        <td className="px-4 py-3 max-w-[200px]">
                          <p className="text-xs text-[#4B4355] truncate">{entry.contentPreview || "—"}</p>
                          <p className="text-[10px] text-[#9A93A8] mt-0.5 capitalize">{entry.contentType || "—"}</p>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${entry.source === "chat" ? "bg-blue-100 text-blue-700" : "bg-amber-100 text-amber-700"}`}>
                            {entry.source}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-[#4B4355]">{entry.authorName || "—"}</td>
                        <td className="px-4 py-3 text-xs text-[#7D7387] max-w-[120px] truncate">{entry.reason || "—"}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${badge.cls}`}>
                            {badge.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-[#7D7387] max-w-[160px]">
                          <p className="truncate">{entry.adminNotes || "—"}</p>
                        </td>
                        <td className="px-4 py-3 text-xs text-[#9A93A8] whitespace-nowrap">{entry.resolvedAtDisplay}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
        );
      })()}

      {/* FORUM REPORTS TAB */}
      {activeTab === "forum-reports" && (
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_260px] gap-6 items-start">
        {/* LEFT: FORUM REPORTS QUEUE */}
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <div className="flex items-center gap-2 mb-4">
              <Shield className="w-5 h-5 text-[#7004DC]" />
              <h3 className="text-lg font-extrabold text-[#1A1C1C]">Forum Reports</h3>
              <span className="ml-2 px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-xs font-bold">{forumReports.length} pending</span>
            </div>
            <p className="text-sm text-[#7D7387] mb-4">User-submitted reports on forum questions and answers. Select one to open the review workflow.</p>

            {loading ? (
              <div className="flex items-center justify-center py-10">
                <div className="w-8 h-8 border-4 border-[#7004DC] border-t-transparent rounded-full animate-spin" />
              </div>
            ) : forumReports.length === 0 ? (
              <div className="text-center py-10 text-slate-400">
                <Shield className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                <p className="font-semibold">No pending forum reports</p>
              </div>
            ) : (
              <div className="space-y-2">
                {forumReports.slice(0, 10).map(report => {
                  const isUrgent = report.reason.toLowerCase().includes("harassment") || report.reason.toLowerCase().includes("spam");
                  return (
                    <div
                      key={report.id}
                      onClick={() => handleOpenWorkflow(report)}
                      className="flex items-center gap-4 p-4 rounded-xl cursor-pointer transition bg-[#F7F5FA] hover:bg-[#F0EDFA] hover:border hover:border-violet-200"
                    >
                      <div className="w-9 h-9 rounded-full bg-[#EDDCFF] flex items-center justify-center text-[#7004DC] text-xs font-bold shrink-0">
                        {(report.reporterName || "?").charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-bold text-[#1A1C1C]">{report.reporterName}</p>
                          <span className="text-xs text-slate-400">{report.createdAt}</span>
                        </div>
                        <p className="text-xs text-[#7D7387] truncate mt-0.5">
                          "{(report.questionTitle || report.answerContent || report.fullContent || "Reported content").substring(0, 45)}..."
                        </p>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase shrink-0 ${isUrgent ? "bg-red-100 text-red-600" : "bg-yellow-100 text-yellow-700"}`}>
                        {isUrgent ? "URGENT" : "PENDING"}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT: STATS + REVIEW */}
        <div className="space-y-4">
          {/* PENDING COUNT */}
          <div className="bg-[#7004DC] rounded-2xl p-6 text-white text-center shadow-lg shadow-violet-200/50">
            <p className="text-sm font-semibold text-white/70 mb-1">Pending Reports</p>
            <h2 className="text-5xl font-extrabold">{stats.totalReports}</h2>
            {/* This total spans forum AND chat reports, so it can read 2 while
                the forum-only tab badge reads 0. Show where it comes from. */}
            <p className="mt-1.5 text-xs font-semibold text-white/70">
              Forum {stats.pendingForum ?? "0"} · Chat {stats.pendingChat ?? "0"}
            </p>
            {Number(stats.reportsToday) > 0 && (
              <span className="mt-2 inline-block px-3 py-1 rounded-full bg-white/20 text-xs font-bold uppercase">
                {/* Numeric compare — this was a string compare, so "10" > "3" was false. */}
                {Number(stats.reportsToday) > 3 ? "URGENT" : "PENDING"}
              </span>
            )}
          </div>

          {/* MINI STATS */}
          <div className="grid grid-cols-1 gap-3">
            {[
              { label: "Reports Today", value: stats.reportsToday, color: "text-orange-600", bg: "bg-orange-50" },
              { label: "Deleted Posts", value: stats.deletedPosts, color: "text-red-600", bg: "bg-red-50" },
              { label: "Suspended Users", value: stats.suspendedUsers, color: "text-[#7004DC]", bg: "bg-violet-50" },
            ].map(stat => (
              <div key={stat.label} className="bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-3 flex items-center gap-3">
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${stat.bg}`}>
                  <AlertTriangle className={`w-4 h-4 ${stat.color}`} />
                </div>
                <div>
                  <p className="text-xs text-[#7D7387]">{stat.label}</p>
                  <p className={`text-xl font-extrabold ${stat.color}`}>{stat.value}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      )}

      {/* AI FLAGS TAB */}
      {activeTab === "ai-flags" && (
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Bot className="w-5 h-5 text-[#7004DC]" />
            <h2 className="text-lg font-extrabold text-[#1A1C1C]">AI Classification Flags</h2>
            <span className="ml-2 px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-xs font-bold">{aiFlags.length} pending</span>
          </div>
          <button onClick={fetchFlags} className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 text-[#7D7387]">
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>

        <p className="text-sm text-[#7D7387] mb-4">AI-generated flags from the async moderation worker. Use the Review Queue tab for unified actions.</p>

        {/* Auto-blocked messages (Tier A — screener counts) */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-3 mb-4">
          <p className="text-[10px] font-bold uppercase text-[#7D7387] mb-2 tracking-wide">Auto-blocked today</p>
          <div className="flex gap-6">
            <div>
              <p className="text-xs text-[#7D7387]">Chat</p>
              <p className="text-xl font-extrabold text-slate-800">{stats.blockedChatToday ?? 0}</p>
            </div>
            <div className="w-px bg-gray-100" />
            <div>
              <p className="text-xs text-[#7D7387]">Forum</p>
              <p className="text-xl font-extrabold text-slate-800">{stats.blockedForumToday ?? 0}</p>
            </div>
            <div className="w-px bg-gray-100" />
            <div>
              <p className="text-xs text-[#7D7387]">Total</p>
              <p className="text-xl font-extrabold text-red-600">{stats.blockedToday ?? 0}</p>
            </div>
          </div>
        </div>

        {flagsLoading ? (
          <div className="py-12 text-center text-sm text-[#7D7387]">Loading flags…</div>
        ) : aiFlags.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-6 py-12 text-center">
            <Bot className="w-10 h-10 mx-auto mb-3 text-slate-300" />
            <p className="text-sm font-semibold text-slate-400">No pending AI flags. All clear.</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-xs text-[#7D7387] font-semibold uppercase tracking-wide">
                  <th className="text-left px-4 py-3">Content Preview</th>
                  <th className="text-left px-4 py-3">Type</th>
                  <th className="text-left px-4 py-3">Score</th>
                  <th className="text-left px-4 py-3">Categories</th>
                  <th className="text-left px-4 py-3">Status</th>
                  <th className="text-center px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {aiFlags.map((flag) => (
                  <tr key={flag.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="px-4 py-3 max-w-xs">
                      <p className="text-xs text-[#4B4355] truncate">{flag.text || "(no preview)"}</p>
                      <p className="text-[10px] text-[#9A93A8] mt-0.5 font-mono">{flag.contentId.slice(-8)}</p>
                    </td>
                    <td className="px-4 py-3 text-xs text-[#7D7387]">{flag.contentType}</td>
                    <td className="px-4 py-3">
                      <span className={`text-sm font-bold ${flag.score >= 0.8 ? "text-red-600" : flag.score >= 0.5 ? "text-amber-600" : "text-gray-500"}`}>
                        {(flag.score * 100).toFixed(0)}%
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {flag.categories.map((c) => (
                          <span key={c} className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-gray-100 text-gray-700">
                            {c}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${FLAG_STATUS_COLORS[flag.status] ?? "bg-gray-100 text-gray-500"}`}>
                        {flag.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 justify-center">
                        <button
                          onClick={() => updateFlagStatus(flag.id, "DISMISSED")}
                          disabled={flagActionId === flag.id}
                          title="Dismiss (false positive)"
                          className="text-green-500 hover:text-green-700 disabled:opacity-40"
                        >
                          <CheckCheck className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => updateFlagStatus(flag.id, "ACTIONED")}
                          disabled={flagActionId === flag.id}
                          title="Action taken (content removed)"
                          className="text-red-500 hover:text-red-700 disabled:opacity-40"
                        >
                          <XCircle className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      )}

      {/* HISTORY ENTRY DETAIL MODAL */}
      {selectedHistoryEntry && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          onClick={() => setSelectedHistoryEntry(null)}
        >
          <div
            className="bg-white rounded-3xl w-full max-w-lg shadow-2xl max-h-[85vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div>
                <h3 className="text-lg font-extrabold text-[#1A1C1C]">Resolved Report Details</h3>
                <p className="text-xs text-slate-500 mt-0.5">Full record of this report and the action taken</p>
              </div>
              <button
                onClick={() => setSelectedHistoryEntry(null)}
                className="w-8 h-8 rounded-full hover:bg-gray-200 flex items-center justify-center transition"
                aria-label="Close"
              >
                <X className="w-4 h-4 text-slate-500" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${selectedHistoryEntry.source === "chat" ? "bg-blue-100 text-blue-700" : "bg-amber-100 text-amber-700"}`}>
                  {selectedHistoryEntry.source}
                </span>
                {(() => {
                  const badge = actionBadge(selectedHistoryEntry.actionTaken);
                  return (
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${badge.cls}`}>
                      {badge.label}
                    </span>
                  );
                })()}
                {selectedHistoryEntry.contentType && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-slate-100 text-slate-600">
                    {selectedHistoryEntry.contentType}
                  </span>
                )}
              </div>

              <DetailField label="Content Preview" value={selectedHistoryEntry.contentPreview} />
              <DetailField label="Reason" value={selectedHistoryEntry.reason} />

              <div className="grid grid-cols-2 gap-4">
                <DetailField label="Author" value={selectedHistoryEntry.authorName} sub={selectedHistoryEntry.authorId} />
                <DetailField label="Reporter" value={selectedHistoryEntry.reporterName} sub={selectedHistoryEntry.reporterId} />
              </div>

              <DetailField label="Admin Notes" value={selectedHistoryEntry.adminNotes} />

              <div className="grid grid-cols-2 gap-4">
                <DetailField label="Resolved At" value={selectedHistoryEntry.resolvedAtDisplay} />
                <DetailField label="Report ID" value={selectedHistoryEntry.reportId} />
              </div>
            </div>

            <div className="flex justify-end p-4 border-t border-slate-100">
              <button
                onClick={() => setSelectedHistoryEntry(null)}
                className="h-10 px-5 rounded-xl border border-slate-200 text-[#4B4355] font-semibold text-sm hover:bg-slate-50 transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DetailField({ label, value, sub }: { label: string; value: string | null | undefined; sub?: string | null }) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">{label}</p>
      <p className="text-sm text-[#1A1C1C] break-words whitespace-pre-wrap">{value || "—"}</p>
      {sub && <p className="text-[10px] text-slate-400 mt-0.5 font-mono">{sub}</p>}
    </div>
  );
}
