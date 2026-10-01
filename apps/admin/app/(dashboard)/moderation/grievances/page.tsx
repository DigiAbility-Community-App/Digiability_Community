"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Clock, RefreshCw, Mail } from "lucide-react";

// ─────────────────────────────────────────────────────
// Grievance Redressal queue — IT Rules 2021 Rule 3(2)
//
// Terms §15 publishes: acknowledged within 24 hours, resolved within 15 days.
// This queue exists so those are visible and therefore meetable — an SLA
// nobody can see is one nobody meets. Breached tickets sort to the top.
// ─────────────────────────────────────────────────────

interface Sla {
  acknowledgementDueAt: string;
  resolutionDueAt: string;
  acknowledgementOverdue: boolean;
  resolutionOverdue: boolean;
}

interface Grievance {
  id: string;
  referenceCode: string;
  category: string;
  subject: string;
  body: string;
  status: string;
  contactEmail: string;
  receivedAt: string;
  acknowledgedAt: string | null;
  resolvedAt: string | null;
  resolutionNote: string | null;
  assignedTo: string | null;
  user: { id: string; name: string; email: string } | null;
  sla: Sla;
}

interface Summary {
  open: number;
  acknowledgementOverdue: number;
  resolutionOverdue: number;
}

const STATUSES = ["ALL", "RECEIVED", "ACKNOWLEDGED", "IN_PROGRESS", "RESOLVED", "CLOSED"];

export default function GrievancesPage() {
  const [items, setItems] = useState<Grievance[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [status, setStatus] = useState("ALL");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [noteFor, setNoteFor] = useState<string | null>(null);
  const [note, setNote] = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/moderation/grievances?status=${status}`);
      const data = (await res.json()) as {
        success: boolean;
        data?: { tickets: Grievance[]; summary: Summary };
        message?: string;
      };
      if (!data.success) throw new Error(data.message || "Failed to load grievances");
      setItems(data.data?.tickets ?? []);
      setSummary(data.data?.summary ?? null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load grievances");
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const act = async (id: string, action: "acknowledge" | "resolve", resolutionNote?: string) => {
    setBusyId(id);
    try {
      const res = await fetch(`/api/moderation/grievances/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, resolutionNote }),
      });
      const data = (await res.json()) as { success: boolean; message?: string };
      if (!data.success) throw new Error(data.message || "Action failed");
      setNoteFor(null);
      setNote("");
      await fetchData();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Action failed");
    } finally {
      setBusyId(null);
    }
  };

  const fmt = (iso: string | null) =>
    iso ? new Date(iso).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "—";

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-[#1A1C1C]">Grievance Redressal</h1>
          <p className="text-sm text-[#7D7387] mt-1">
            Acknowledge within <strong>24 hours</strong>, resolve within <strong>15 days</strong> —
            the commitment published in our Terms of Use.
          </p>
        </div>
        <button
          onClick={fetchData}
          className="h-9 px-3 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-xs font-bold text-[#4B4355] flex items-center gap-1.5"
        >
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      {summary && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <p className="text-xs font-bold uppercase text-[#7D7387]">Open</p>
            <p className="text-2xl font-extrabold text-[#1A1C1C] mt-1">{summary.open}</p>
          </div>
          <div
            className={`rounded-2xl border p-5 ${
              summary.acknowledgementOverdue > 0
                ? "bg-red-50 border-red-200"
                : "bg-white border-gray-100"
            }`}
          >
            <p className="text-xs font-bold uppercase text-[#7D7387]">Past 24h, unacknowledged</p>
            <p
              className={`text-2xl font-extrabold mt-1 ${
                summary.acknowledgementOverdue > 0 ? "text-red-700" : "text-[#1A1C1C]"
              }`}
            >
              {summary.acknowledgementOverdue}
            </p>
          </div>
          <div
            className={`rounded-2xl border p-5 ${
              summary.resolutionOverdue > 0 ? "bg-amber-50 border-amber-200" : "bg-white border-gray-100"
            }`}
          >
            <p className="text-xs font-bold uppercase text-[#7D7387]">Past 15 days, unresolved</p>
            <p
              className={`text-2xl font-extrabold mt-1 ${
                summary.resolutionOverdue > 0 ? "text-amber-700" : "text-[#1A1C1C]"
              }`}
            >
              {summary.resolutionOverdue}
            </p>
          </div>
        </div>
      )}

      <div className="flex gap-2 flex-wrap">
        {STATUSES.map((s) => (
          <button
            key={s}
            onClick={() => setStatus(s)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition ${
              status === s
                ? "bg-[#7004DC] text-white border-[#7004DC]"
                : "bg-white text-[#4B4355] border-gray-200 hover:bg-gray-50"
            }`}
          >
            {s.replace(/_/g, " ")}
          </button>
        ))}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">{error}</div>
      )}

      {loading ? (
        <p className="text-sm text-[#7D7387]">Loading…</p>
      ) : items.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center">
          <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
          <p className="mt-3 font-bold text-[#1A1C1C]">Nothing here</p>
          <p className="text-sm text-[#7D7387]">No grievances match this filter.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {items.map((g) => (
            <div
              key={g.id}
              className={`bg-white rounded-2xl border p-6 ${
                g.sla.acknowledgementOverdue
                  ? "border-red-300 shadow-sm"
                  : g.sla.resolutionOverdue
                    ? "border-amber-300"
                    : "border-gray-100"
              }`}
            >
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-xs font-bold text-[#7004DC]">
                      {g.referenceCode}
                    </span>
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase bg-slate-100 text-slate-700 border border-slate-200">
                      {g.category}
                    </span>
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase bg-slate-50 text-slate-600 border border-slate-200">
                      {g.status.replace(/_/g, " ")}
                    </span>
                    {g.sla.acknowledgementOverdue && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase bg-red-600 text-white">
                        <AlertTriangle className="w-3 h-3" /> SLA breached — unacknowledged
                      </span>
                    )}
                    {!g.sla.acknowledgementOverdue && g.sla.resolutionOverdue && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase bg-amber-500 text-white">
                        <Clock className="w-3 h-3" /> Overdue for resolution
                      </span>
                    )}
                  </div>

                  <h3 className="font-bold text-[#1A1C1C] mt-2">{g.subject}</h3>
                  <p className="text-sm text-[#4B4355] mt-1 whitespace-pre-wrap">{g.body}</p>

                  <div className="text-xs text-[#7D7387] mt-3 space-y-0.5">
                    <p className="flex items-center gap-1.5">
                      <Mail className="w-3 h-3" />
                      {g.user ? `${g.user.name} · ${g.contactEmail}` : g.contactEmail}
                    </p>
                    <p>Received {fmt(g.receivedAt)}</p>
                    <p>
                      Acknowledge by {fmt(g.sla.acknowledgementDueAt)} · Resolve by{" "}
                      {fmt(g.sla.resolutionDueAt)}
                    </p>
                    {g.acknowledgedAt && <p>Acknowledged {fmt(g.acknowledgedAt)}</p>}
                    {g.resolvedAt && (
                      <p>
                        Resolved {fmt(g.resolvedAt)} — {g.resolutionNote}
                      </p>
                    )}
                    {g.assignedTo && <p>Handled by {g.assignedTo}</p>}
                  </div>
                </div>

                <div className="flex flex-col gap-2 shrink-0">
                  {!g.acknowledgedAt && (
                    <button
                      disabled={busyId === g.id}
                      onClick={() => act(g.id, "acknowledge")}
                      className="h-9 px-4 rounded-xl bg-[#7004DC] hover:bg-[#5c03b4] disabled:bg-purple-300 text-white text-xs font-bold"
                    >
                      {busyId === g.id ? "Working…" : "Acknowledge"}
                    </button>
                  )}
                  {!g.resolvedAt && (
                    <button
                      disabled={busyId === g.id}
                      onClick={() => {
                        setNoteFor(noteFor === g.id ? null : g.id);
                        setNote("");
                      }}
                      className="h-9 px-4 rounded-xl border border-gray-200 hover:bg-gray-50 text-xs font-bold text-[#4B4355]"
                    >
                      Resolve…
                    </button>
                  )}
                </div>
              </div>

              {noteFor === g.id && (
                <div className="mt-4 border-t border-gray-100 pt-4">
                  <label className="text-xs font-bold text-[#4B4355]" htmlFor={`note-${g.id}`}>
                    Resolution note — what was decided and why. Recorded against the ticket.
                  </label>
                  <textarea
                    id={`note-${g.id}`}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    rows={3}
                    className="mt-2 w-full rounded-xl border border-gray-200 p-3 text-sm"
                    placeholder="e.g. Content removed and the reporter notified by email on 12 Sept."
                  />
                  <div className="flex gap-2 mt-2">
                    <button
                      disabled={busyId === g.id || !note.trim()}
                      onClick={() => act(g.id, "resolve", note)}
                      className="h-9 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-300 text-white text-xs font-bold"
                    >
                      {busyId === g.id ? "Saving…" : "Mark resolved"}
                    </button>
                    <button
                      onClick={() => setNoteFor(null)}
                      className="h-9 px-4 rounded-xl border border-gray-200 text-xs font-bold text-[#4B4355]"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
