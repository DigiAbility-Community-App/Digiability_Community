"use client";

import { useEffect, useState, useCallback } from "react";
import { Plus, Trash2, ToggleLeft, ToggleRight, RefreshCw, AlertTriangle } from "lucide-react";

// ─────────────────────────────────────────────────────
// Banned Keyword Management
// Non-developers can manage the real-time content filter
// without touching code. Changes take effect within seconds
// via Redis pub/sub → service reload.
// ─────────────────────────────────────────────────────

type Action = "block" | "flag";
type Severity = "LOW" | "MEDIUM" | "HIGH";
type Category = "PROFANITY" | "HATE_SPEECH" | "HARASSMENT" | "SPAM" | "SELF_HARM" | "MISINFORMATION" | "OTHER";
type MatchType = "EXACT" | "CONTAINS";

interface Keyword {
  id: string;
  phrase: string;
  severity: Severity;
  action: Action;
  category: Category;
  matchType: MatchType;
  isActive: boolean;
  createdBy: string | null;
  createdAt: string;
}

const ACTION_BADGE: Record<Action, string> = {
  block: "bg-red-100 text-red-700",
  flag:  "bg-amber-100 text-amber-700",
};
const SEV_BADGE: Record<Severity, string> = {
  LOW:    "bg-green-100 text-green-700",
  MEDIUM: "bg-orange-100 text-orange-700",
  HIGH:   "bg-red-100 text-red-700",
};
const CATEGORIES: Category[] = ["PROFANITY","HATE_SPEECH","HARASSMENT","SPAM","SELF_HARM","MISINFORMATION","OTHER"];
const SEVERITIES: Severity[] = ["LOW","MEDIUM","HIGH"];
const MATCH_TYPES: MatchType[] = ["CONTAINS","EXACT"];

export default function KeywordFiltersPage() {
  const [keywords, setKeywords] = useState<Keyword[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterCategory, setFilterCategory] = useState("");
  const [filterActive, setFilterActive] = useState("true");
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // New keyword form state
  const [newPhrase, setNewPhrase] = useState("");
  const [newAction, setNewAction] = useState<Action>("block");
  const [newSeverity, setNewSeverity] = useState<Severity>("MEDIUM");
  const [newCategory, setNewCategory] = useState<Category>("OTHER");
  const [newMatchType, setNewMatchType] = useState<MatchType>("CONTAINS");

  const fetchKeywords = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams();
      if (filterCategory) qs.set("category", filterCategory);
      if (filterActive) qs.set("isActive", filterActive);
      const res = await fetch(`/api/moderation/keywords?${qs}`);
      const data = await res.json() as { success: boolean; data?: { keywords: Keyword[] }; message?: string };
      if (data.success) {
        setKeywords(data.data?.keywords ?? []);
      } else {
        setError(data.message ?? "Failed to load keywords");
      }
    } catch {
      setError("Network error loading keywords");
    } finally {
      setLoading(false);
    }
  }, [filterCategory, filterActive]);

  useEffect(() => { fetchKeywords(); }, [fetchKeywords]);

  const handleAdd = async () => {
    if (!newPhrase.trim()) { setError("Phrase cannot be empty."); return; }
    setSaving(true); setError(null);
    try {
      const res = await fetch("/api/moderation/keywords", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phrase: newPhrase.trim(), action: newAction, severity: newSeverity, category: newCategory, matchType: newMatchType }),
      });
      const data = await res.json() as { success: boolean; message?: string };
      if (!data.success) throw new Error(data.message ?? "Failed");
      setShowAdd(false);
      setNewPhrase("");
      await fetchKeywords();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to add keyword");
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (kw: Keyword) => {
    setActionId(kw.id); setError(null);
    try {
      const res = await fetch(`/api/moderation/keywords/${kw.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !kw.isActive }),
      });
      const data = await res.json() as { success: boolean; message?: string };
      if (!data.success) throw new Error(data.message ?? "Failed");
      await fetchKeywords();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Toggle failed");
    } finally {
      setActionId(null);
    }
  };

  const handleDelete = async (kw: Keyword) => {
    if (!confirm(`Permanently delete "${kw.phrase}"? This cannot be undone.`)) return;
    setActionId(kw.id); setError(null);
    try {
      const res = await fetch(`/api/moderation/keywords/${kw.id}`, { method: "DELETE" });
      const data = await res.json() as { success: boolean; message?: string };
      if (!data.success) throw new Error(data.message ?? "Failed");
      await fetchKeywords();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setActionId(null);
    }
  };

  return (
    <div className="px-8 py-8 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-[#1A1C1C]">Keyword Filters</h1>
          <p className="text-sm text-[#7D7387] mt-1">
            Changes take effect across chat and forum within seconds via live cache reload.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={fetchKeywords}
            className="p-2 rounded-xl border border-gray-200 hover:bg-gray-50 text-[#7D7387]" title="Refresh">
            <RefreshCw className="w-4 h-4" />
          </button>
          <button onClick={() => { setShowAdd(true); setError(null); }}
            className="flex items-center gap-2 bg-[#7004DC] text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-[#5e03bb] transition">
            <Plus className="w-4 h-4" /> Add Keyword
          </button>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="mb-4 flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
          <AlertTriangle className="w-4 h-4 shrink-0" /> {error}
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-3 mb-5">
        <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}
          className="h-9 rounded-lg border border-gray-200 text-sm px-3 text-[#4B4355] focus:outline-none">
          <option value="">All categories</option>
          {CATEGORIES.map((c) => <option key={c} value={c}>{c.replace(/_/g," ")}</option>)}
        </select>
        <select value={filterActive} onChange={(e) => setFilterActive(e.target.value)}
          className="h-9 rounded-lg border border-gray-200 text-sm px-3 text-[#4B4355] focus:outline-none">
          <option value="true">Active only</option>
          <option value="false">Inactive only</option>
          <option value="">All</option>
        </select>
        <span className="ml-auto text-sm text-[#7D7387] self-center">
          {keywords.length} keyword{keywords.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Add form */}
      {showAdd && (
        <div className="mb-5 bg-white border border-[#7004DC]/20 rounded-2xl p-5 shadow-sm">
          <h3 className="text-base font-bold text-[#1A1C1C] mb-4">Add New Keyword</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-xs font-semibold text-[#7D7387] mb-1">Phrase *</label>
              <input value={newPhrase} onChange={(e) => setNewPhrase(e.target.value)}
                placeholder="e.g. scam offer"
                className="w-full h-10 rounded-xl border border-gray-200 px-3 text-sm focus:outline-none focus:border-[#7004DC]" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#7D7387] mb-1">Action</label>
              <select value={newAction} onChange={(e) => setNewAction(e.target.value as Action)}
                className="w-full h-10 rounded-xl border border-gray-200 px-3 text-sm focus:outline-none">
                <option value="block">Block (reject immediately)</option>
                <option value="flag">Flag (allow, queue for review)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#7D7387] mb-1">Category</label>
              <select value={newCategory} onChange={(e) => setNewCategory(e.target.value as Category)}
                className="w-full h-10 rounded-xl border border-gray-200 px-3 text-sm focus:outline-none">
                {CATEGORIES.map((c) => <option key={c} value={c}>{c.replace(/_/g," ")}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#7D7387] mb-1">Severity</label>
              <select value={newSeverity} onChange={(e) => setNewSeverity(e.target.value as Severity)}
                className="w-full h-10 rounded-xl border border-gray-200 px-3 text-sm focus:outline-none">
                {SEVERITIES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#7D7387] mb-1">Match type</label>
              <select value={newMatchType} onChange={(e) => setNewMatchType(e.target.value as MatchType)}
                className="w-full h-10 rounded-xl border border-gray-200 px-3 text-sm focus:outline-none">
                {MATCH_TYPES.map((m) => (
                  <option key={m} value={m}>{m === "CONTAINS" ? "Contains (substring)" : "Exact word boundary"}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={() => setShowAdd(false)}
              className="flex-1 h-10 rounded-xl border border-gray-200 text-sm text-[#4B4355] hover:bg-gray-50">
              Cancel
            </button>
            <button onClick={handleAdd} disabled={saving}
              className="flex-1 h-10 rounded-xl bg-[#7004DC] text-white text-sm font-bold hover:bg-[#5e03bb] disabled:opacity-60 transition">
              {saving ? "Adding…" : "Add Keyword"}
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-sm text-[#7D7387]">Loading…</div>
        ) : keywords.length === 0 ? (
          <div className="py-16 text-center text-sm text-[#7D7387]">No keywords match the current filters.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-xs text-[#7D7387] font-semibold uppercase tracking-wide">
                <th className="text-left px-4 py-3">Phrase</th>
                <th className="text-left px-4 py-3">Action</th>
                <th className="text-left px-4 py-3">Category</th>
                <th className="text-left px-4 py-3">Severity</th>
                <th className="text-left px-4 py-3">Match</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {keywords.map((kw) => (
                <tr key={kw.id}
                  className={`border-b border-gray-50 hover:bg-gray-50 ${!kw.isActive ? "opacity-50" : ""}`}>
                  <td className="px-4 py-3 font-mono text-[#1A1C1C]">{kw.phrase}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-bold uppercase ${ACTION_BADGE[kw.action]}`}>
                      {kw.action}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[#4B4355]">{kw.category.replace(/_/g," ")}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${SEV_BADGE[kw.severity]}`}>
                      {kw.severity}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[#7D7387] text-xs">{kw.matchType}</td>
                  <td className="px-4 py-3">
                    <button onClick={() => toggleActive(kw)} disabled={actionId === kw.id}
                      className="flex items-center gap-1 text-xs font-semibold text-[#4B4355] disabled:opacity-50"
                      title={kw.isActive ? "Deactivate" : "Activate"}>
                      {kw.isActive
                        ? <ToggleRight className="w-4 h-4 text-[#7004DC]" />
                        : <ToggleLeft className="w-4 h-4 text-gray-400" />}
                      {kw.isActive ? "Active" : "Inactive"}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => handleDelete(kw)} disabled={actionId === kw.id}
                      className="text-red-400 hover:text-red-600 disabled:opacity-40" title="Delete permanently">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <p className="mt-3 text-xs text-[#7D7387]">
        ⚡ Keyword changes are pushed to all services via Redis pub/sub — no restart required.
      </p>
    </div>
  );
}
