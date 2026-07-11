"use client";

import { useEffect, useState, useCallback } from "react";
import { RefreshCw, ClipboardList } from "lucide-react";

interface AuditEntry {
  id: string;
  adminEmail: string;
  action: string;
  targetType: string;
  targetId: string;
  reason: string | null;
  createdAt: string;
}

const ACTION_COLORS: Record<string, string> = {
  dismiss:        "bg-green-100 text-green-700",
  remove_content: "bg-red-100 text-red-700",
  warn_user:      "bg-amber-100 text-amber-700",
  ban_user:       "bg-red-200 text-red-900",
  suspend:        "bg-orange-100 text-orange-700",
  unsuspend:      "bg-blue-100 text-blue-700",
  keyword_add:    "bg-purple-100 text-purple-700",
  keyword_delete: "bg-gray-100 text-gray-600",
};

function fmt(dateStr: string): string {
  return new Date(dateStr).toLocaleString("en-GB", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

const PAGE_SIZE = 50;

export default function AuditLogPage() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLog = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch(`/api/moderation/audit?limit=${PAGE_SIZE}&offset=${page * PAGE_SIZE}`);
      const data = await res.json() as {
        success: boolean;
        data?: { entries: AuditEntry[]; total: number };
        message?: string;
      };
      if (data.success) {
        setEntries(data.data?.entries ?? []);
        setTotal(data.data?.total ?? 0);
      } else {
        setError(data.message ?? "Failed to load audit log");
      }
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => { fetchLog(); }, [fetchLog]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="px-8 py-8 max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <ClipboardList className="w-5 h-5 text-[#7004DC]" />
          <h1 className="text-2xl font-extrabold text-[#1A1C1C]">Admin Audit Log</h1>
          <span className="ml-2 text-sm text-[#7D7387]">{total} entries</span>
        </div>
        <button onClick={fetchLog}
          className="p-2 rounded-xl border border-gray-200 hover:bg-gray-50 text-[#7D7387]">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
          {error}
        </div>
      )}

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-sm text-[#7D7387]">Loading…</div>
        ) : entries.length === 0 ? (
          <div className="py-16 text-center text-sm text-[#7D7387]">No audit entries yet.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-xs text-[#7D7387] font-semibold uppercase tracking-wide">
                <th className="text-left px-4 py-3">When</th>
                <th className="text-left px-4 py-3">Admin</th>
                <th className="text-left px-4 py-3">Action</th>
                <th className="text-left px-4 py-3">Target</th>
                <th className="text-left px-4 py-3">Reason</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-4 py-3 text-xs text-[#7D7387] whitespace-nowrap">{fmt(e.createdAt)}</td>
                  <td className="px-4 py-3 text-xs text-[#4B4355] truncate max-w-[130px]">{e.adminEmail}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${ACTION_COLORS[e.action] ?? "bg-gray-100 text-gray-600"}`}>
                      {e.action.replace(/_/g, " ")}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs text-[#7D7387]">{e.targetType.replace(/_/g, " ")}</span>
                    <span className="ml-1 text-[10px] font-mono opacity-50">{e.targetId.slice(-6)}</span>
                  </td>
                  <td className="px-4 py-3 text-xs text-[#4B4355] max-w-xs truncate">{e.reason ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0}
            className="px-4 py-2 rounded-xl border border-gray-200 text-sm font-semibold text-[#4B4355] disabled:opacity-40 hover:bg-gray-50">
            ← Previous
          </button>
          <span className="text-sm text-[#7D7387]">Page {page + 1} of {totalPages}</span>
          <button onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}
            className="px-4 py-2 rounded-xl border border-gray-200 text-sm font-semibold text-[#4B4355] disabled:opacity-40 hover:bg-gray-50">
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
