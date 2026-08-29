"use client";

import { useEffect, useState, useCallback } from "react";
import {
  AlertTriangle, Bot, CheckCheck, UserX, Trash2, RefreshCw, ChevronDown,
  MessageSquare, MessageCircle, HelpCircle, ChevronLeft, ChevronRight,
  Shield, CheckCircle2, Clock, Eye,
} from "lucide-react";

export type ItemKind = "user_report" | "chat_report" | "ai_flag";
export type ActionType = "dismiss" | "remove_content" | "warn_user" | "ban_user";

export interface QueueItem {
  id: string;
  kind: ItemKind;
  source: "chat" | "forum" | "ai";
  contentType: string;
  contentId: string;
  messageId?: string;
  conversationId?: string;
  messageSequence?: string | null;
  questionId?: string;
  answerId?: string;
  userId: string;
  userEmail: string;
  userName: string;
  reporterId: string;
  reporterEmail: string;
  reporterName: string;
  summary: string;
  contentPreview: string;
  imageUrl?: string | null;
  score: number | null;
  status: string;
  createdAt: string;
}

export function ReviewQueue({
  defaultStatus = "PENDING",
  onOpenWorkflow,
}: {
  defaultStatus?: string;
  onOpenWorkflow?: (item: QueueItem) => void;
}) {
  const [items, setItems] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState(defaultStatus);
  const [typeFilter, setTypeFilter] = useState("all");
  const [error, setError] = useState<string | null>(null);

  // Pagination
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 10;

  const fetchQueue = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/moderation/review?status=${statusFilter}&type=${typeFilter}`);
      const data = (await res.json()) as { success: boolean; data?: { items: QueueItem[] }; message?: string };
      if (data.success) {
        setItems(data.data?.items ?? []);
        setPage(1);
      } else {
        setError(data.message ?? "Failed to load queue");
      }
    } catch {
      setError("Network error connecting to moderation queue");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, typeFilter]);

  useEffect(() => {
    fetchQueue();
  }, [fetchQueue]);

  const totalPages = Math.ceil(items.length / PAGE_SIZE) || 1;
  const safePage = Math.min(Math.max(1, page), totalPages);
  const pagedItems = items.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  return (
    <div className="space-y-4">
      {/* FILTER & CONTROLS BAR */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-10 rounded-xl border border-gray-200 text-sm font-semibold px-3.5 bg-[#F7F5FA] text-[#1A1C1C] outline-none focus:border-[#7004DC]"
          >
            <option value="PENDING">Pending Review</option>
            <option value="ACTIONED">Actioned / Resolved</option>
            <option value="DISMISSED">Dismissed</option>
          </select>

          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="h-10 rounded-xl border border-gray-200 text-sm font-semibold px-3.5 bg-[#F7F5FA] text-[#1A1C1C] outline-none focus:border-[#7004DC]"
          >
            <option value="all">All Channels (Chat, Forum, AI)</option>
            <option value="chat">Chat & DM Messages Only</option>
            <option value="forum">Forum Questions & Answers Only</option>
            <option value="flag">AI Moderation Flags Only</option>
          </select>

          <button
            onClick={fetchQueue}
            title="Refresh queue"
            className="h-10 px-3.5 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-[#4B4355] text-xs font-bold flex items-center gap-1.5 transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-[#7004DC]" : ""}`} />
            <span>Refresh</span>
          </button>
        </div>

        <div className="text-xs font-extrabold text-[#7D7387] bg-violet-50 border border-violet-100 px-3 py-1.5 rounded-xl">
          {items.length} {items.length === 1 ? "Item" : "Items"} in Queue
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded-2xl px-4 py-3 text-sm font-semibold">
          <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* QUEUE TABLE */}
      <div className="bg-white rounded-2xl border border-[#ECE7F2] shadow-sm overflow-hidden w-full">
        {loading && items.length === 0 ? (
          <div className="py-20 text-center text-sm font-semibold text-[#7D7387] flex flex-col items-center justify-center gap-2">
            <RefreshCw className="w-6 h-6 animate-spin text-[#7004DC]" />
            <span>Streaming reported items from database...</span>
          </div>
        ) : items.length === 0 ? (
          <div className="py-20 text-center flex flex-col items-center justify-center gap-2">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CheckCheck className="w-6 h-6" />
            </div>
            <p className="font-bold text-sm text-[#1A1C1C]">Nothing in the queue. All clear!</p>
            <p className="text-xs text-[#7D7387]">All reported messages and forum content have been moderated.</p>
          </div>
        ) : (
          <div className="overflow-x-auto w-full">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#F7F5FA] border-b border-[#ECE7F2]">
                  <th className="px-6 py-4 text-[11px] font-extrabold uppercase tracking-wider text-[#7D7387] w-44">
                    Source & Channel
                  </th>
                  <th className="px-6 py-4 text-[11px] font-extrabold uppercase tracking-wider text-[#7D7387]">
                    Reported Content & Reason
                  </th>
                  <th className="px-6 py-4 text-[11px] font-extrabold uppercase tracking-wider text-[#7D7387] w-48">
                    Offender & Reporter
                  </th>
                  <th className="px-6 py-4 text-[11px] font-extrabold uppercase tracking-wider text-[#7D7387] w-36">
                    Timestamp
                  </th>
                  <th className="px-6 py-4 text-[11px] font-extrabold uppercase tracking-wider text-[#7D7387] text-right pr-6 w-36">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F0EDF5]">
                {pagedItems.map((item) => (
                  <tr
                    key={`${item.kind}-${item.id}`}
                    onClick={() => onOpenWorkflow?.(item)}
                    className="hover:bg-[#F9F7FC] cursor-pointer transition group"
                  >
                    {/* SOURCE & CHANNEL */}
                    <td className="px-6 py-4 align-middle whitespace-nowrap">
                      {item.source === "chat" ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-extrabold bg-blue-50 text-blue-700 border border-blue-200">
                          <MessageCircle className="w-3.5 h-3.5 text-blue-600" />
                          Chat Message
                        </span>
                      ) : item.source === "ai" ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-extrabold bg-purple-50 text-purple-700 border border-purple-200">
                          <Bot className="w-3.5 h-3.5 text-purple-600" />
                          AI Flag
                        </span>
                      ) : item.contentType === "question" ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-extrabold bg-amber-50 text-amber-800 border border-amber-200">
                          <HelpCircle className="w-3.5 h-3.5 text-amber-600" />
                          Forum Question
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-extrabold bg-emerald-50 text-emerald-800 border border-emerald-200">
                          <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
                          Forum Answer
                        </span>
                      )}
                    </td>

                    {/* CONTENT & REASON */}
                    <td className="px-6 py-4">
                      <div className="max-w-lg">
                        <p className="text-sm font-bold text-[#1A1C1C] leading-snug line-clamp-2 group-hover:text-[#7004DC] transition">
                          "{item.contentPreview}"
                        </p>
                        <div className="mt-1.5 flex items-center gap-2">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-red-50 text-red-700 text-[10px] font-extrabold border border-red-100">
                            <AlertTriangle className="w-3 h-3" />
                            {item.summary}
                          </span>
                          {item.score !== null && (
                            <span className="text-[10px] font-bold text-purple-700 bg-purple-50 border border-purple-100 px-1.5 py-0.5 rounded">
                              Score: {(item.score * 100).toFixed(0)}%
                            </span>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* OFFENDER & REPORTER */}
                    <td className="px-6 py-4 align-middle">
                      <div className="text-xs space-y-1">
                        <div>
                          <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">Offender</span>
                          <span className="font-bold text-[#1A1C1C] truncate block max-w-[170px]">{item.userName || "Unknown"}</span>
                        </div>
                        <div>
                          <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">Reported By</span>
                          <span className="font-semibold text-[#7D7387] truncate block max-w-[170px]">{item.reporterName || "System"}</span>
                        </div>
                      </div>
                    </td>

                    {/* TIMESTAMP */}
                    <td className="px-6 py-4 align-middle whitespace-nowrap text-xs text-[#4B4355] font-semibold">
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        <span>{new Date(item.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}</span>
                      </div>
                    </td>

                    {/* ACTION BUTTON */}
                    <td className="px-6 py-4 align-middle text-right pr-6 whitespace-nowrap">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenWorkflow?.(item);
                        }}
                        className="h-8 px-3.5 rounded-xl bg-[#7004DC] hover:bg-[#5c03b7] text-white text-xs font-bold inline-flex items-center gap-1.5 transition shadow-xs"
                      >
                        <Shield className="w-3.5 h-3.5" /> Review
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* PAGINATION FOOTER */}
            {items.length > 0 && (
              <div className="px-6 py-4 border-t border-[#ECE7F2] bg-[#FAFAFC] flex flex-col sm:flex-row items-center justify-between gap-4">
                <p className="text-xs text-[#7D7387] font-semibold">
                  Showing <span className="font-bold text-[#1A1C1C]">{(safePage - 1) * PAGE_SIZE + 1}</span> to{" "}
                  <span className="font-bold text-[#1A1C1C]">{Math.min(safePage * PAGE_SIZE, items.length)}</span> of{" "}
                  <span className="font-bold text-[#1A1C1C]">{items.length}</span> items
                </p>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                    disabled={safePage === 1}
                    className="h-9 px-3 rounded-xl border border-gray-200 bg-white text-xs font-bold text-[#4B4355] hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center gap-1"
                  >
                    <ChevronLeft className="w-4 h-4" /> Previous
                  </button>
                  {Array.from({ length: totalPages }, (_, idx) => idx + 1)
                    .filter((p) => p === 1 || p === totalPages || Math.abs(p - safePage) <= 1)
                    .map((p, idx, arr) => {
                      const prev = arr[idx - 1];
                      return (
                        <span key={p} className="flex items-center">
                          {prev && p - prev > 1 && <span className="px-2 text-xs text-slate-400">...</span>}
                          <button
                            type="button"
                            onClick={() => setPage(p)}
                            className={`w-9 h-9 rounded-xl text-xs font-bold transition ${
                              safePage === p
                                ? "bg-[#7004DC] text-white shadow-sm"
                                : "border border-gray-200 bg-white text-[#4B4355] hover:bg-gray-50"
                            }`}
                          >
                            {p}
                          </button>
                        </span>
                      );
                    })}
                  <button
                    type="button"
                    onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                    disabled={safePage === totalPages}
                    className="h-9 px-3 rounded-xl border border-gray-200 bg-white text-xs font-bold text-[#4B4355] hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center gap-1"
                  >
                    Next <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <p className="text-xs text-[#7D7387]">
        Clicking on any report opens the full Review Workflow with conversation context, removal, warning, and ban controls.
      </p>
    </div>
  );
}
