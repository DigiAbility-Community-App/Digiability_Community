"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Scale, AlertTriangle, RefreshCw, ShieldCheck, Clock } from "lucide-react";

// ─────────────────────────────────────────────────────
// Appeals — Community Guidelines "Appeals"
//
// This page used to be the ReviewQueue filtered to DISMISSED, which showed
// moderator dismissals rather than user appeals — there was no appeal to see,
// because users had no way to file one.
//
// Published commitments: appeal within 30 days; we respond within 14 days, or
// 7 where the account is suspended; reviewed by someone not involved in the
// original decision. That last one is enforced server-side — the API refuses a
// decision from the admin who took the original action — and mirrored here so
// the reason is visible rather than just a failed request.
// ─────────────────────────────────────────────────────

interface Appeal {
  id: string;
  referenceCode: string;
  grounds: string;
  status: string;
  submittedAt: string;
  dueBy: string;
  respondedAt: string | null;
  decisionNote: string | null;
  reviewedBy: string | null;
  appellant: { id: string; name: string; email: string } | null;
  originalDecisionBy: string | null;
  originalAction: string | null;
  originalReason: string | null;
  responseOverdue: boolean;
}

const STATUSES = ["ALL", "SUBMITTED", "UNDER_REVIEW", "UPHELD", "OVERTURNED", "REJECTED"];

export default function AppealsPage() {
  const [appeals, setAppeals] = useState<Appeal[]>([]);
  const [me, setMe] = useState<string | null>(null);
  const [status, setStatus] = useState("SUBMITTED");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [appealRes, meRes] = await Promise.all([
        fetch(`/api/moderation/appeals?status=${status}`),
        fetch("/api/auth/session"),
      ]);
      const data = (await appealRes.json()) as {
        success: boolean;
        data?: { appeals: Appeal[] };
        message?: string;
      };
      if (!data.success) throw new Error(data.message || "Failed to load appeals");
      setAppeals(data.data?.appeals ?? []);

      // Used only to explain WHY an appeal is locked before the request is made.
      // The server is the authority on this.
      try {
        const meData = (await meRes.json()) as { email?: string | null };
        setMe(meData.email ?? null);
      } catch {
        setMe(null);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load appeals");
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Marks the appeal UNDER_REVIEW so another admin can see it's being worked
  // on. Subject to the same conflict-of-interest rule as deciding.
  const claim = async (id: string) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/moderation/appeals/${id}/claim`, { method: "POST" });
      const data = (await res.json()) as { success: boolean; message?: string };
      if (!data.success) throw new Error(data.message || "Failed to claim appeal");
      await fetchData();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to claim appeal");
    } finally {
      setBusy(false);
    }
  };

  const decide = async (id: string, outcome: "UPHELD" | "OVERTURNED" | "REJECTED") => {
    if (!note.trim()) {
      setError("A decision note is required so the outcome is on record.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/moderation/appeals/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ outcome, decisionNote: note }),
      });
      const data = (await res.json()) as { success: boolean; message?: string };
      if (!data.success) throw new Error(data.message || "Failed to decide appeal");
      setOpenId(null);
      setNote("");
      await fetchData();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to decide appeal");
    } finally {
      setBusy(false);
    }
  };

  const fmt = (iso: string | null) =>
    iso ? new Date(iso).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "—";

  return (
    <div className="px-8 py-8 max-w-5xl space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link
            href="/moderation"
            className="text-xs font-bold text-[#7004DC] hover:underline inline-flex items-center gap-1"
          >
            ← Back to Moderation
          </Link>
          <h1 className="text-2xl font-extrabold text-[#1A1C1C] mt-1">Appeals</h1>
          <p className="text-sm text-[#7D7387] mt-1">
            Respond within <strong>14 days</strong>, or <strong>7 days</strong> where the account is
            suspended. An appeal must be reviewed by someone who was not involved in the original
            decision.
          </p>
        </div>
        <button
          onClick={fetchData}
          className="h-9 px-3 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-xs font-bold text-[#4B4355] flex items-center gap-1.5"
        >
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

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
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-[#7D7387]">Loading…</p>
      ) : appeals.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center">
          <Scale className="w-8 h-8 text-[#7004DC] mx-auto" />
          <p className="mt-3 font-bold text-[#1A1C1C]">No appeals</p>
          <p className="text-sm text-[#7D7387]">Nothing matches this filter.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {appeals.map((a) => {
            const isOwnDecision =
              !!me && !!a.originalDecisionBy &&
              me.toLowerCase() === a.originalDecisionBy.toLowerCase();
            const decided = !!a.respondedAt;

            return (
              <div
                key={a.id}
                className={`bg-white rounded-2xl border p-6 ${
                  a.responseOverdue ? "border-red-300" : "border-gray-100"
                }`}
              >
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs font-bold text-[#7004DC]">
                        {a.referenceCode}
                      </span>
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase bg-slate-100 text-slate-700 border border-slate-200">
                        {a.status.replace(/_/g, " ")}
                      </span>
                      {a.responseOverdue && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase bg-red-600 text-white">
                          <Clock className="w-3 h-3" /> Response overdue
                        </span>
                      )}
                    </div>

                    <p className="text-sm text-[#4B4355] mt-3 whitespace-pre-wrap">{a.grounds}</p>

                    <div className="text-xs text-[#7D7387] mt-3 space-y-0.5">
                      <p>
                        From {a.appellant?.name ?? "Unknown"} ({a.appellant?.email ?? "—"})
                      </p>
                      <p>
                        Appealing: <strong>{a.originalAction ?? "unknown action"}</strong>
                        {a.originalReason ? ` — ${a.originalReason}` : ""}
                      </p>
                      <p>Original decision by {a.originalDecisionBy ?? "unknown"}</p>
                      <p>
                        Submitted {fmt(a.submittedAt)} · Respond by {fmt(a.dueBy)}
                      </p>
                      {decided && (
                        <p className="text-emerald-700">
                          {a.status} by {a.reviewedBy} on {fmt(a.respondedAt)} — {a.decisionNote}
                        </p>
                      )}
                    </div>
                  </div>

                  {!decided && (
                    <div className="shrink-0">
                      {isOwnDecision ? (
                        <div className="max-w-[220px] rounded-xl bg-amber-50 border border-amber-200 p-3">
                          <p className="text-[11px] font-bold text-amber-800 flex items-center gap-1.5">
                            <AlertTriangle className="w-3.5 h-3.5" /> You made this decision
                          </p>
                          <p className="text-[11px] text-amber-700 mt-1">
                            Another admin must review this appeal.
                          </p>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-2 items-end">
                          <button
                            onClick={() => {
                              setOpenId(openId === a.id ? null : a.id);
                              setNote("");
                              setError(null);
                            }}
                            className="h-9 px-4 rounded-xl bg-[#7004DC] hover:bg-[#5c03b4] text-white text-xs font-bold"
                          >
                            Review…
                          </button>
                          {a.status === "SUBMITTED" && (
                            <button
                              onClick={() => claim(a.id)}
                              disabled={busy}
                              className="h-8 px-3 rounded-xl border border-gray-200 hover:bg-gray-50 disabled:opacity-50 text-[11px] font-bold text-[#4B4355]"
                            >
                              Mark under review
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {openId === a.id && !decided && !isOwnDecision && (
                  <div className="mt-4 border-t border-gray-100 pt-4">
                    <label className="text-xs font-bold text-[#4B4355]" htmlFor={`note-${a.id}`}>
                      Decision note — what you concluded and why. Recorded against the appeal.
                    </label>
                    <textarea
                      id={`note-${a.id}`}
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      rows={3}
                      className="mt-2 w-full rounded-xl border border-gray-200 p-3 text-sm"
                      placeholder="e.g. Re-reviewed the original message; it does not breach the guideline cited. Warning withdrawn."
                    />
                    <div className="flex gap-2 mt-2 flex-wrap">
                      <button
                        disabled={busy || !note.trim()}
                        onClick={() => decide(a.id, "OVERTURNED")}
                        className="h-9 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-300 text-white text-xs font-bold inline-flex items-center gap-1.5"
                      >
                        <ShieldCheck className="w-3.5 h-3.5" /> Overturn
                      </button>
                      <button
                        disabled={busy || !note.trim()}
                        onClick={() => decide(a.id, "UPHELD")}
                        className="h-9 px-4 rounded-xl border border-gray-200 hover:bg-gray-50 disabled:opacity-50 text-xs font-bold text-[#4B4355]"
                      >
                        Uphold original decision
                      </button>
                      <button
                        disabled={busy || !note.trim()}
                        onClick={() => decide(a.id, "REJECTED")}
                        className="h-9 px-4 rounded-xl border border-gray-200 hover:bg-gray-50 disabled:opacity-50 text-xs font-bold text-[#4B4355]"
                      >
                        Reject (out of scope)
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
