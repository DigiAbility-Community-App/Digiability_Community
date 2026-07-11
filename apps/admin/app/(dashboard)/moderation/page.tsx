"use client";

import { useEffect, useState } from "react";
import {
  Shield, CheckCircle2, Trash2, AlertTriangle, UserX,
  RefreshCw, X, ChevronDown, Bot, CheckCheck, XCircle,
} from "lucide-react";
import { ReviewQueue } from "./ReviewQueue";

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
  reporterName: string;
  reporterEmail: string;
  authorId?: string | null;
  authorName?: string | null;
  authorEmail?: string | null;
  messageId?: string | null;
  conversationId?: string | null;
  messageSequence?: string | null;
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

export default function ModerationPage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [stats, setStats] = useState<ModerationStats>({ totalReports: "0", deletedPosts: "0", suspendedUsers: "0", reportsToday: "0" });
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Report | null>(null);
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
  const [banEmail, setBanEmail] = useState("");
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
    try {
      await postAction({ action: effectiveAction, reportId: report.id, questionId: report.questionId });
      await fetchData();
      if (selected?.id === report.id) setSelected(null);
    } finally { setActionLoading(null); }
  };

  const [activeTab, setActiveTab] = useState<"queue" | "forum-reports" | "ai-flags">("queue");

  // Send a warning to the offending user (the reported content's author).
  const handleWarn = async () => {
    if (!workflowReport?.authorId) { alert("This report has no identifiable author to warn."); return; }
    setActionLoading("warn");
    try {
      const data = await postAction({
        action: "warn",
        userId: workflowReport.authorId,
        category: warnCategory,
        message: warnMessage,
        triggerSuspend,
      });
      if (!data.success) throw new Error(data.message);
      setShowWorkflow(false);
      setSelected(null);
      setWarnMessage("");
      await fetchData();
    } catch (e: any) {
      alert(e?.message || "Failed to send warning.");
    } finally { setActionLoading(null); }
  };

  // Ban (suspend) the offending user.
  const handleBan = async () => {
    if (!workflowReport?.authorId) { alert("This report has no identifiable author to ban."); return; }
    setActionLoading("ban");
    try {
      const data = await postAction({
        action: "ban",
        userId: workflowReport.authorId,
        reason: banReason,
        duration: banDuration,
        message: banEmail,
      });
      if (!data.success) throw new Error(data.message);
      setShowWorkflow(false);
      setSelected(null);
      setBanConfirm(false);
      setBanEmail("");
      await fetchData();
    } catch (e: any) {
      alert(e?.message || "Failed to ban user.");
    } finally { setActionLoading(null); }
  };

  const urgentReports = reports.filter(r => r.reason.toLowerCase().includes("harassment") || r.reason.toLowerCase().includes("spam"));
  const pendingReports = reports.filter(r => !urgentReports.includes(r));

  if (showWorkflow && workflowReport) {
    return (
      <div className="px-8 py-8 max-w-5xl">
        <div className="mb-6">
          <h1 className="text-xl font-extrabold text-[#1A1C1C]">Review Workflow</h1>
          <p className="text-sm text-[#7D7387] mt-0.5">Manage content flags and user safety measures with DigiAbility's Guardian Moderation system.</p>
        </div>

        {workflowReport.source === "chat" && workflowReport.conversationId && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-6">
            <h3 className="text-sm font-extrabold text-[#1A1C1C] mb-3">Conversation Context</h3>
            {contextLoading && (
              <p className="text-sm text-[#7D7387]">Loading surrounding messages…</p>
            )}
            {!contextLoading && contextMessages && contextMessages.length === 0 && (
              <p className="text-sm text-[#7D7387]">
                No surrounding messages found — the conversation may have been deleted since this report was filed.
              </p>
            )}
            {!contextLoading && contextMessages && contextMessages.length > 0 && (
              <div className="space-y-2 max-h-72 overflow-y-auto">
                {contextMessages.map((m) => {
                  const isReported = m.sequenceNo === workflowReport.messageSequence;
                  return (
                    <div
                      key={m.id}
                      className={`rounded-lg p-3 text-sm ${isReported ? "bg-red-50 border border-red-200" : "bg-gray-50"}`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-semibold text-[#1A1C1C]">{m.senderName || "Unknown"}</span>
                        <span className="text-xs text-[#9A93A8]">{new Date(m.createdAt).toLocaleString("en-GB")}</span>
                      </div>
                      <p className={`leading-5 ${m.deletedAt ? "italic text-[#9A93A8]" : "text-[#4B4355]"}`}>
                        {m.deletedAt ? "(message deleted)" : m.content}
                      </p>
                      {isReported && (
                        <span className="inline-block mt-1 text-[11px] font-bold text-red-600 uppercase tracking-wide">
                          Reported message
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {/* REMOVE CONTENT */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <div className="flex items-center gap-2 mb-4">
              <AlertTriangle className="w-5 h-5 text-red-600" />
              <h3 className="text-xl font-extrabold text-red-600">Remove This Content?</h3>
            </div>
            <div className="border-l-4 border-[#7004DC] pl-4 mb-4">
              <p className="text-sm text-[#4B4355] leading-5 italic">
                "{workflowReport.questionTitle || workflowReport.answerContent || "The reported content appears to violate community guidelines."}"
              </p>
            </div>
            <div className="bg-red-50 rounded-xl p-4 mb-4 space-y-2">
              {["Content will be permanently deleted", "The author will be notified", "This action cannot be undone"].map(item => (
                <div key={item} className="flex items-center gap-2 text-sm text-red-600">
                  <span className="shrink-0">⊗</span> {item}
                </div>
              ))}
            </div>
            <div className="mb-4">
              <label className="block text-sm font-semibold text-[#1A1C1C] mb-2">Reason for Removal</label>
              <input value={removeReason} onChange={e => setRemoveReason(e.target.value)} placeholder="Select or type reason..." className="w-full h-11 rounded-xl border border-gray-200 px-4 text-sm outline-none focus:border-red-400" />
            </div>
            <div className="flex items-center justify-between mb-5">
              <span className="text-sm text-[#4B4355]">Notify author of removal</span>
              <button onClick={() => setNotifyAuthor(v => !v)} className={`w-12 h-6 rounded-full transition relative ${notifyAuthor ? "bg-[#7004DC]" : "bg-gray-200"}`}>
                <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${notifyAuthor ? "right-1" : "left-1"}`} />
              </button>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowWorkflow(false)} className="flex-1 h-11 rounded-xl border border-gray-200 text-[#4B4355] font-semibold text-sm hover:bg-gray-50">Cancel</button>
              <button onClick={() => { handleAction("delete_post", workflowReport); setShowWorkflow(false); }} disabled={!workflowReport.questionId} className="flex-1 h-11 rounded-xl bg-red-600 hover:bg-red-700 disabled:bg-red-200 disabled:cursor-not-allowed text-white font-bold text-sm transition">Remove Content</button>
            </div>
          </div>

          {/* WARN USER */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <div className="mb-2">
              <h3 className="text-xl font-extrabold text-[#1A1C1C]">Warn User</h3>
              <p className="text-base font-bold text-[#7004DC]">{workflowReport.authorName || "Unknown author"}</p>
              {!workflowReport.authorId && (
                <p className="text-xs text-red-500 mt-1">No identifiable author for this report — warning is disabled.</p>
              )}
            </div>
            <div className="bg-violet-50 rounded-xl p-3 mb-4 border border-violet-100">
              <p className="text-sm font-bold text-[#7004DC]">This is their 2nd warning</p>
              <div className="grid grid-cols-2 gap-3 mt-2">
                <div className="bg-white rounded-lg p-2">
                  <p className="text-[10px] font-bold uppercase text-slate-400">3 Warnings</p>
                  <p className="text-xs font-semibold text-[#4B4355]">7-day suspension</p>
                </div>
                <div className="bg-white rounded-lg p-2">
                  <p className="text-[10px] font-bold uppercase text-slate-400">5 Warnings</p>
                  <p className="text-xs font-semibold text-[#4B4355]">Account ban</p>
                </div>
              </div>
            </div>
            <div className="mb-4">
              <p className="text-sm font-semibold text-[#1A1C1C] mb-2">Violation Category</p>
              <div className="flex flex-wrap gap-2">
                {["Harassment", "Spam", "Misinformation", "Custom"].map(cat => (
                  <button key={cat} onClick={() => setWarnCategory(cat)} className={`px-4 py-2 rounded-xl text-sm font-bold border-2 transition ${warnCategory === cat ? "border-[#7004DC] bg-violet-50 text-[#7004DC]" : "border-transparent bg-[#F3F3F3] text-[#4B4355] hover:bg-[#EBEBEB]"}`}>
                    {cat}
                  </button>
                ))}
              </div>
            </div>
            <div className="mb-4">
              <label className="block text-sm font-semibold text-[#1A1C1C] mb-2">Custom Message to User</label>
              <textarea value={warnMessage} onChange={e => setWarnMessage(e.target.value)} rows={3} placeholder="Write a brief explanation of why the user is being warned..." className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-[#8A38F5] resize-none" />
            </div>
            <div className="space-y-2 mb-4">
              <label className="flex items-center gap-2 cursor-pointer text-sm text-[#4B4355]">
                <input type="checkbox" checked={triggerSuspend} onChange={e => setTriggerSuspend(e.target.checked)} className="w-4 h-4 rounded accent-[#7004DC]" />
                Trigger automatic 7-day suspension
              </label>
              <label className="flex items-center gap-2 cursor-pointer text-sm text-[#4B4355]">
                <input type="checkbox" checked={escalate} onChange={e => setEscalate(e.target.checked)} className="w-4 h-4 rounded accent-[#7004DC]" />
                Escalate to manual senior review
              </label>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowWorkflow(false)} className="flex-1 h-11 rounded-xl border border-gray-200 text-[#4B4355] font-semibold text-sm hover:bg-gray-50">Cancel</button>
              <button
                onClick={handleWarn}
                disabled={!workflowReport.authorId || actionLoading === "warn"}
                className="flex-1 h-11 rounded-xl bg-[#D2A500] hover:bg-[#b89300] disabled:bg-[#e6d488] disabled:cursor-not-allowed text-[#4F3D00] font-bold text-sm transition"
              >
                {actionLoading === "warn" ? "Sending…" : "Send Warning"}
              </button>
            </div>
          </div>
        </div>

        {/* BAN USER */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mt-6 max-w-xl">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-xl font-extrabold text-red-600">Ban User Account?</h3>
              <p className="text-sm text-[#7D7387]">Impact for: {workflowReport.authorName || "Unknown author"}</p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-red-100 flex items-center justify-center">
              <UserX className="w-6 h-6 text-red-600" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="bg-red-50 rounded-xl p-4 border border-red-100">
              <p className="text-xs font-extrabold text-red-600 mb-2">⚠ Critical Impact</p>
              <ul className="space-y-1 text-xs text-red-600">
                <li>• Permanent loss of all account data</li>
                <li>• Previous posts hidden from public</li>
                <li>• Email block on domain @gmail.com</li>
              </ul>
            </div>
            <div>
              <label className="block text-sm font-semibold text-[#1A1C1C] mb-2">Internal Email Explanation</label>
              <textarea value={banEmail} onChange={e => setBanEmail(e.target.value)} rows={4} placeholder="Detailed notes for audit logs and user notification email..." className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-red-400 resize-none h-full" />
            </div>
          </div>
          <div className="mb-4">
            <label className="block text-sm font-semibold text-[#1A1C1C] mb-2">Ban Reason</label>
            <div className="relative">
              <select value={banReason} onChange={e => setBanReason(e.target.value)} className="w-full h-11 rounded-xl border border-gray-200 px-4 text-sm outline-none focus:border-red-400 bg-white appearance-none pr-8">
                {["Severe Community Violation", "Repeated Harassment", "Fraud/Scam", "Illegal Activity", "Other"].map(r => <option key={r}>{r}</option>)}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            </div>
          </div>
          <div className="mb-4">
            <label className="block text-sm font-semibold text-[#1A1C1C] mb-2">Duration</label>
            <div className="flex gap-4">
              {["Permanent", "30 Days", "90 Days"].map(d => (
                <label key={d} className="flex items-center gap-2 cursor-pointer text-sm text-[#4B4355]">
                  <div onClick={() => setBanDuration(d)} className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${banDuration === d ? "border-[#7004DC]" : "border-gray-300"}`}>
                    {banDuration === d && <div className="w-2 h-2 rounded-full bg-[#7004DC]" />}
                  </div>
                  {d}
                </label>
              ))}
            </div>
          </div>
          <label className="flex items-center gap-2 cursor-pointer text-sm text-[#4B4355] mb-5">
            <input type="checkbox" checked={banConfirm} onChange={e => setBanConfirm(e.target.checked)} className="w-4 h-4 rounded accent-[#7004DC]" />
            I confirm this ban is necessary and justified according to the safety guidelines.
          </label>
          <div className="flex gap-3">
            <button onClick={() => setShowWorkflow(false)} className="flex-1 h-11 rounded-xl border border-gray-200 text-[#4B4355] font-semibold text-sm hover:bg-gray-50">Cancel</button>
            <button
              onClick={handleBan}
              disabled={!banConfirm || !workflowReport.authorId || actionLoading === "ban"}
              className="flex-1 h-11 rounded-xl bg-red-600 hover:bg-red-700 disabled:bg-red-200 disabled:cursor-not-allowed text-white font-bold text-sm transition"
            >
              {actionLoading === "ban" ? "Banning…" : (banDuration === "Permanent" ? "Ban User Permanently" : `Suspend for ${banDuration}`)}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="px-8 py-8">

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
          { id: "queue" as const, label: "Review Queue" },
          { id: "forum-reports" as const, label: "Forum Reports" },
          { id: "ai-flags" as const, label: "AI Flags" },
        ] as const).map((tab) => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 text-sm font-semibold rounded-t-lg transition -mb-px border-b-2 ${
              activeTab === tab.id
                ? "border-[#7004DC] text-[#7004DC] bg-violet-50/50"
                : "border-transparent text-[#7D7387] hover:text-[#1A1C1C]"
            }`}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* REVIEW QUEUE TAB */}
      {activeTab === "queue" && <ReviewQueue />}

      {/* FORUM REPORTS + AI FLAGS TABS */}
      {(activeTab === "forum-reports" || activeTab === "ai-flags") && <>
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_260px] gap-6 items-start">
        {activeTab === "ai-flags" && <div className="xl:col-span-2"><p className="text-sm text-[#7D7387] mb-4">AI-generated flags from the async moderation worker. Use the Review Queue tab for unified actions.</p></div>}

        {/* LEFT: QUEUE */}
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <h3 className="text-lg font-extrabold text-[#1A1C1C] mb-4">Queue Overview</h3>

            {loading ? (
              <div className="flex items-center justify-center py-10">
                <div className="w-8 h-8 border-4 border-[#7004DC] border-t-transparent rounded-full animate-spin" />
              </div>
            ) : reports.length === 0 ? (
              <div className="text-center py-10 text-slate-400">
                <Shield className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                <p className="font-semibold">No pending reports</p>
              </div>
            ) : (
              <div className="space-y-2">
                {reports.slice(0, 10).map(report => {
                  const isUrgent = report.reason.toLowerCase().includes("harassment") || report.reason.toLowerCase().includes("spam");
                  return (
                    <div
                      key={report.id}
                      onClick={() => setSelected(selected?.id === report.id ? null : report)}
                      className={`flex items-center gap-4 p-4 rounded-xl cursor-pointer transition ${selected?.id === report.id ? "bg-violet-50 border border-violet-200" : "bg-[#F7F5FA] hover:bg-[#F0EDFA]"}`}
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
                          "{(report.questionTitle || report.answerContent || "Reported content").substring(0, 45)}..."
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
            {Number(stats.reportsToday) > 0 && (
              <span className="mt-2 inline-block px-3 py-1 rounded-full bg-white/20 text-xs font-bold uppercase">
                {stats.reportsToday > "3" ? "URGENT" : "PENDING"}
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
            {/* Auto-blocked messages (Tier A — screener counts) */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-3">
              <p className="text-[10px] font-bold uppercase text-[#7D7387] mb-2 tracking-wide">Auto-blocked today</p>
              <div className="flex gap-4">
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
          </div>
        </div>
      </div>

      {/* AI FLAGS SECTION */}
      <div className="mt-8">
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

        {flagsLoading ? (
          <p className="text-sm text-[#7D7387] py-4">Loading AI flags…</p>
        ) : aiFlags.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-6 py-8 text-center text-sm text-[#7D7387]">
            No pending AI flags. All clear.
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-xs text-[#7D7387] font-semibold uppercase tracking-wide">
                  <th className="text-left px-4 py-3">Content</th>
                  <th className="text-left px-4 py-3">Type</th>
                  <th className="text-left px-4 py-3">Score</th>
                  <th className="text-left px-4 py-3">Categories</th>
                  <th className="text-left px-4 py-3">Status</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {aiFlags.map((flag) => (
                  <tr key={flag.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="px-4 py-3 max-w-xs">
                      <p className="text-xs text-[#4B4355] truncate">{flag.text ?? "(no preview)"}</p>
                      <p className="text-[10px] text-[#7D7387] mt-0.5 font-mono">{flag.contentId.slice(-8)}</p>
                    </td>
                    <td className="px-4 py-3 text-xs text-[#4B4355]">
                      {flag.contentType.replace(/_/g, " ")}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-sm font-bold ${flag.score >= 0.8 ? "text-red-600" : flag.score >= 0.5 ? "text-amber-600" : "text-gray-500"}`}>
                        {(flag.score * 100).toFixed(0)}%
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {flag.categories.slice(0, 3).map((c) => (
                          <span key={c} className="px-1.5 py-0.5 bg-red-50 text-red-600 text-[10px] rounded-full font-semibold">
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
      </>}

      {/* CONTENT REVIEW PANEL */}
      {selected && (
        <div className="fixed right-0 top-0 h-full w-[380px] bg-white border-l border-gray-100 shadow-2xl z-40 flex flex-col overflow-y-auto">
          <div className="flex items-center justify-between p-5 border-b border-gray-100">
            <div>
              <h3 className="font-extrabold text-base text-[#1A1C1C]">Content Review</h3>
              <p className="text-xs text-[#7D7387] mt-0.5">Report ID: #{selected.id.slice(-4)}</p>
            </div>
            <button onClick={() => setSelected(null)} className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center"><X className="w-4 h-4 text-slate-500" /></button>
          </div>

          <div className="p-5 space-y-4 flex-1">
            <span className="px-3 py-1 rounded-full bg-orange-50 text-orange-600 border border-orange-200 text-[10px] font-bold uppercase">PENDING REVIEW</span>
            <div className="flex items-center gap-2 text-xs text-[#7D7387]">
              <span>📄</span> Content type: {selected.type === "question" ? "Post" : "Answer"}
            </div>
            <div className="bg-[#F7F5FA] rounded-xl p-4">
              <p className="text-sm text-[#1A1C1C] leading-5">"{selected.questionTitle || selected.answerContent || "Reported content"}"</p>
              <button className="text-xs font-bold text-[#7004DC] mt-2 hover:underline">View full content ↓</button>
            </div>

            <div className="bg-[#F7F5FA] rounded-xl p-3 flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-[#EDDCFF] flex items-center justify-center text-[#7004DC] text-xs font-bold">{selected.reporterName?.[0]}</div>
              <div>
                <p className="text-sm font-bold text-[#1A1C1C]">{selected.reporterName}</p>
                <p className="text-xs text-green-600 font-semibold">✓ Trustworthy</p>
              </div>
            </div>

            <div>
              <span className={`inline-block px-3 py-1 rounded-full text-[10px] font-bold uppercase ${selected.reason.toLowerCase().includes("spam") ? "bg-orange-100 text-orange-700" : "bg-red-100 text-red-700"}`}>
                {selected.reason}
              </span>
              <p className="text-sm text-[#7D7387] mt-2">User reported potential violation of community guidelines.</p>
            </div>

            <div className="bg-[#F7F5FA] rounded-xl p-3">
              <p className="text-sm font-bold text-[#1A1C1C]">{selected.reporterName}</p>
              <p className="text-xs text-[#7D7387]">Community Member • Reporter</p>
              <div className="mt-2 text-xs text-red-500 font-semibold flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" /> 2 Previous Warnings
                <span className="text-[#7D7387] font-normal ml-2">2 warnings in 30 days</span>
              </div>
            </div>

            {/* ACTION BUTTONS */}
            <div className="space-y-2 pt-1">
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => handleAction("dismiss", selected)}
                  disabled={actionLoading === selected.id + "dismiss"}
                  className="h-11 rounded-xl bg-green-500 hover:bg-green-600 text-white font-bold text-sm transition flex items-center justify-center gap-2"
                >
                  <CheckCircle2 className="w-4 h-4" /> Approve
                </button>
                <button
                  onClick={() => handleAction("delete_post", selected)}
                  disabled={actionLoading === selected.id + "delete_post" || !selected.questionId}
                  className="h-11 rounded-xl bg-red-600 hover:bg-red-700 disabled:bg-red-200 text-white font-bold text-sm transition flex items-center justify-center gap-2"
                >
                  <Trash2 className="w-4 h-4" /> Remove
                </button>
              </div>
              <button
                onClick={() => { setWorkflowReport(selected); setShowWorkflow(true); }}
                className="w-full h-11 rounded-xl bg-[#D2A500] hover:bg-[#b89300] text-[#4F3D00] font-bold text-sm transition flex items-center justify-center gap-2"
              >
                ⚠ Warn User
              </button>
              <button
                onClick={() => handleAction("dismiss", selected)}
                disabled={actionLoading === selected.id + "dismiss"}
                className="w-full h-11 rounded-xl border border-gray-200 text-[#4B4355] font-bold text-sm hover:bg-gray-50 transition"
              >
                No Action Required
              </button>
              <button
                onClick={() => { setWorkflowReport(selected); setShowWorkflow(true); }}
                className="w-full h-11 rounded-xl bg-[#1A1C1C] hover:bg-black text-white font-bold text-sm transition flex items-center justify-center gap-2"
              >
                🚫 Ban User Account
              </button>
            </div>

            <div className="bg-violet-50 rounded-xl p-4 border border-violet-100">
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#7004DC] mb-1">MODERATION TIP</p>
              <p className="text-xs text-[#4B4355] leading-4">Accounts with more than 3 warnings in a 30-day period are automatically flagged for permanent suspension. Review the author's history before taking final action.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
