"use client";

import { useEffect, useState, useCallback } from "react";
import {
  AlertTriangle, Bot, CheckCheck, XCircle, UserX, Trash2, RefreshCw, ChevronDown,
} from "lucide-react";

// ─────────────────────────────────────────────────────
// Unified Review Queue Component (Tier E)
//
// Shows UserReports and ModerationFlags in a single sorted
// list. Each item can be dismissed, have its content removed,
// or have the author warned / banned. All actions are recorded
// in admin_audit_log via the review API.
// ─────────────────────────────────────────────────────

type ItemKind = "user_report" | "ai_flag";
type ActionType = "dismiss" | "remove_content" | "warn_user" | "ban_user";

interface QueueItem {
  id: string;
  kind: ItemKind;
  contentType: string;
  contentId: string;
  userId: string;
  userEmail: string;
  userName: string;
  summary: string;
  score: number | null;
  status: string;
  createdAt: string;
}

const KIND_BADGE: Record<ItemKind, string> = {
  user_report: "bg-blue-100 text-blue-700",
  ai_flag: "bg-purple-100 text-purple-700",
};

const SCORE_COLOR = (s: number | null): string => {
  if (!s) return "text-gray-400";
  if (s >= 0.8) return "text-red-600 font-bold";
  if (s >= 0.5) return "text-amber-600 font-bold";
  return "text-gray-500";
};

const ACTIONS: { value: ActionType; label: string; icon: React.ReactNode; cls: string }[] = [
  { value: "dismiss",        label: "Dismiss (false positive)", icon: <CheckCheck className="w-3.5 h-3.5" />, cls: "text-green-700 hover:bg-green-50" },
  { value: "remove_content", label: "Remove content",           icon: <Trash2 className="w-3.5 h-3.5" />,    cls: "text-red-600 hover:bg-red-50" },
  { value: "warn_user",      label: "Warn user (7-day ban)",    icon: <AlertTriangle className="w-3.5 h-3.5" />, cls: "text-amber-700 hover:bg-amber-50" },
  { value: "ban_user",       label: "Permanent ban",            icon: <UserX className="w-3.5 h-3.5" />,     cls: "text-red-900 hover:bg-red-50" },
];

interface ReviewQueueProps {
  defaultStatus?: string;
}

export function ReviewQueue({ defaultStatus = "PENDING" }: ReviewQueueProps) {
  const [items, setItems] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState(defaultStatus);
  const [typeFilter, setTypeFilter] = useState("all");
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [acting, setActing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchQueue = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch(`/api/moderation/review?status=${statusFilter}&type=${typeFilter}`);
      const data = await res.json() as { success: boolean; data?: { items: QueueItem[] }; message?: string };
      if (data.success) setItems(data.data?.items ?? []);
      else setError(data.message ?? "Failed to load queue");
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, typeFilter]);

  useEffect(() => { fetchQueue(); }, [fetchQueue]);
  // Close action menu on outside click
  useEffect(() => {
    const close = () => setOpenMenu(null);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, []);

  const executeAction = async (item: QueueItem, action: ActionType) => {
    setOpenMenu(null);
    setActing(item.id);
    setError(null);
    try {
      const reason = action === "ban_user"
        ? "Admin-initiated ban from review queue"
        : undefined;
      const res = await fetch("/api/moderation/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: item.id,
          kind: item.kind,
          action,
          contentType: item.contentType,
          contentId: item.contentId,
          userId: item.userId,
          reason,
        }),
      });
      const data = await res.json() as { success: boolean; message?: string };
      if (!data.success) throw new Error(data.message ?? "Action failed");
      await fetchQueue();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed");
    } finally {
      setActing(null);
    }
  };

  return (
    <div>
      {/* Controls */}
      <div className="flex items-center gap-3 mb-5">
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
          className="h-9 rounded-lg border border-gray-200 text-sm px-3 text-[#4B4355] focus:outline-none">
          <option value="PENDING">Pending</option>
          <option value="ACTIONED">Actioned</option>
          <option value="DISMISSED">Dismissed</option>
        </select>
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}
          className="h-9 rounded-lg border border-gray-200 text-sm px-3 text-[#4B4355] focus:outline-none">
          <option value="all">All types</option>
          <option value="report">User reports only</option>
          <option value="flag">AI flags only</option>
        </select>
        <button onClick={fetchQueue}
          className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 text-[#7D7387]">
          <RefreshCw className="w-4 h-4" />
        </button>
        <span className="ml-auto text-sm text-[#7D7387]">
          {items.length} item{items.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
          <AlertTriangle className="w-4 h-4 shrink-0" /> {error}
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-visible">
        {loading ? (
          <div className="py-16 text-center text-sm text-[#7D7387]">Loading…</div>
        ) : items.length === 0 ? (
          <div className="py-16 text-center">
            <CheckCheck className="w-8 h-8 text-green-400 mx-auto mb-2" />
            <p className="text-sm text-[#7D7387]">Nothing in the queue. All clear.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-xs text-[#7D7387] font-semibold uppercase tracking-wide">
                <th className="text-left px-4 py-3">Source</th>
                <th className="text-left px-4 py-3">Content</th>
                <th className="text-left px-4 py-3">Type</th>
                <th className="text-left px-4 py-3">Score</th>
                <th className="text-left px-4 py-3">Date</th>
                <th className="text-right px-4 py-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={`${item.kind}-${item.id}`}
                  className="border-b border-gray-50 hover:bg-gray-50 relative">
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold ${KIND_BADGE[item.kind]}`}>
                      {item.kind === "ai_flag"
                        ? <Bot className="w-3 h-3" />
                        : <AlertTriangle className="w-3 h-3" />}
                      {item.kind === "ai_flag" ? "AI Flag" : "User Report"}
                    </span>
                  </td>
                  <td className="px-4 py-3 max-w-xs">
                    <p className="text-xs text-[#4B4355] truncate">{item.summary}</p>
                    <p className="text-[10px] text-[#7D7387] mt-0.5 font-mono">{item.contentId.slice(-8)}</p>
                  </td>
                  <td className="px-4 py-3 text-xs text-[#7D7387]">
                    {item.contentType.replace(/_/g, " ")}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-sm ${SCORE_COLOR(item.score)}`}>
                      {item.score !== null ? `${(item.score * 100).toFixed(0)}%` : "—"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-[#7D7387] whitespace-nowrap">
                    {new Date(item.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}
                  </td>
                  <td className="px-4 py-3 text-right relative">
                    {acting === item.id ? (
                      <span className="text-xs text-[#7D7387]">Working…</span>
                    ) : (
                      <div className="inline-block relative">
                        <button
                          onClick={(e) => { e.stopPropagation(); setOpenMenu(openMenu === item.id ? null : item.id); }}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-semibold text-[#4B4355] hover:bg-gray-50"
                        >
                          Act <ChevronDown className="w-3 h-3" />
                        </button>
                        {openMenu === item.id && (
                          <div
                            onClick={(e) => e.stopPropagation()}
                            className="absolute right-0 top-full mt-1 w-52 bg-white border border-gray-100 rounded-xl shadow-lg z-50 overflow-hidden"
                          >
                            {ACTIONS.map((a) => (
                              <button
                                key={a.value}
                                onClick={() => executeAction(item, a.value)}
                                className={`w-full flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-left transition ${a.cls}`}
                              >
                                {a.icon} {a.label}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <p className="mt-3 text-xs text-[#7D7387]">
        All actions are recorded in the audit log.
      </p>
    </div>
  );
}
