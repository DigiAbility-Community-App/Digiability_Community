"use client";

import { useCallback, useEffect, useState } from "react";
import { Eye, RefreshCw, MessageCircle, ListFilter } from "lucide-react";

// ─────────────────────────────────────────────────────
// Message Access Log — Terms of Use §7
//
// "We are technically able to access message content, and we do so only to
//  investigate a report, comply with a legal obligation, or respond to a
//  credible risk to someone's safety. Every such access is logged."
//
// This page is that log. Append-only: there is no edit or delete endpoint,
// because a trail the covered people can rewrite is not a trail.
// ─────────────────────────────────────────────────────

interface AccessEntry {
  id: string;
  adminEmail: string;
  accessType: string;
  conversationId: string | null;
  conversationName: string | null;
  conversationType: string | null;
  messageIds: string[];
  messageCount: number;
  sequenceFrom: string | null;
  sequenceTo: string | null;
  justification: string;
  reportId: string | null;
  ipAddress: string | null;
  accessedAt: string;
}

const TYPES = [
  { key: "ALL", label: "All access" },
  { key: "context_view", label: "Conversation reads" },
  { key: "queue_listing", label: "Queue listings" },
];

const TYPE_STYLE: Record<string, string> = {
  context_view: "bg-red-50 text-red-700 border-red-200",
  queue_listing: "bg-slate-50 text-slate-600 border-slate-200",
  report_detail: "bg-amber-50 text-amber-700 border-amber-200",
};

export default function MessageAccessPage() {
  const [entries, setEntries] = useState<AccessEntry[]>([]);
  const [type, setType] = useState("context_view");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/moderation/message-access?type=${type}`);
      const data = (await res.json()) as {
        success: boolean;
        data?: { entries: AccessEntry[] };
        message?: string;
      };
      if (!data.success) throw new Error(data.message || "Failed to load");
      setEntries(data.data?.entries ?? []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [type]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const fmt = (iso: string) =>
    new Date(iso).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });

  return (
    <div className="px-8 py-8 max-w-5xl space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-[#1A1C1C]">Message Access Log</h1>
          <p className="text-sm text-[#7D7387] mt-1 max-w-2xl">
            Every time an administrator was shown private message content. Our Terms of Use commit
            to recording this, and to accessing messages only to investigate a report, meet a legal
            obligation, or respond to a risk to someone&apos;s safety. This log is append-only.
          </p>
        </div>
        <button
          onClick={fetchData}
          className="h-9 px-3 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-xs font-bold text-[#4B4355] flex items-center gap-1.5 shrink-0"
        >
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      <div className="flex gap-2 flex-wrap">
        {TYPES.map((t) => (
          <button
            key={t.key}
            onClick={() => setType(t.key)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition ${
              type === t.key
                ? "bg-[#7004DC] text-white border-[#7004DC]"
                : "bg-white text-[#4B4355] border-gray-200 hover:bg-gray-50"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-[#7D7387]">Loading…</p>
      ) : entries.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center">
          <Eye className="w-8 h-8 text-[#7004DC] mx-auto" />
          <p className="mt-3 font-bold text-[#1A1C1C]">No access recorded</p>
          <p className="text-sm text-[#7D7387]">
            Nobody has viewed message content of this kind yet.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-[#F9F7FC] text-left">
              <tr className="text-[11px] uppercase font-extrabold text-[#7D7387]">
                <th className="px-5 py-3">When</th>
                <th className="px-5 py-3">Administrator</th>
                <th className="px-5 py-3">Kind</th>
                <th className="px-5 py-3">What was shown</th>
                <th className="px-5 py-3">Why</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {entries.map((e) => (
                <tr key={e.id} className="align-top">
                  <td className="px-5 py-3 whitespace-nowrap text-xs text-[#4B4355]">
                    {fmt(e.accessedAt)}
                  </td>
                  <td className="px-5 py-3 text-xs font-semibold text-[#1A1C1C]">
                    {e.adminEmail}
                    {e.ipAddress && (
                      <span className="block font-normal text-[#7D7387]">{e.ipAddress}</span>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase border ${
                        TYPE_STYLE[e.accessType] ?? "bg-slate-50 text-slate-600 border-slate-200"
                      }`}
                    >
                      {e.accessType === "context_view" ? (
                        <MessageCircle className="w-3 h-3" />
                      ) : (
                        <ListFilter className="w-3 h-3" />
                      )}
                      {e.accessType.replace(/_/g, " ")}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-xs text-[#4B4355]">
                    {e.conversationId ? (
                      <>
                        <span className="font-semibold">
                          {e.conversationName || (e.conversationType === "DIRECT" ? "Direct message" : "Conversation")}
                        </span>
                        <span className="block text-[#7D7387]">
                          {e.messageCount} message{e.messageCount === 1 ? "" : "s"}
                          {e.sequenceFrom && e.sequenceTo
                            ? ` (#${e.sequenceFrom}–#${e.sequenceTo})`
                            : ""}
                        </span>
                      </>
                    ) : (
                      <span className="text-[#7D7387]">
                        {e.messageCount} reported message{e.messageCount === 1 ? "" : "s"} across
                        the queue
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-xs text-[#4B4355]">{e.justification}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
