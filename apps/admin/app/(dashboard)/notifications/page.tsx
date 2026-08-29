"use client";

import { useEffect, useState } from "react";
import {
  Bell, Send, Users, CheckCircle2, AlertTriangle, Info,
  Megaphone, Loader2, RefreshCw, Clock, X, Trash2,
} from "lucide-react";

// ─────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────
const AUDIENCE_OPTIONS = [
  { value: "ALL",       label: "All Users",    desc: "Every registered user on the platform" },
  { value: "pwd",       label: "PwD Users",    desc: "Users with Person with Disability role" },
  { value: "caregiver", label: "Caregivers",   desc: "Users with Caregiver role" },
  { value: "therapist", label: "Therapists",   desc: "Verified therapists" },
  { value: "ngo",       label: "NGO Workers",  desc: "NGO registered users" },
  { value: "volunteer", label: "Volunteers",   desc: "Active volunteers" },
  { value: "student",   label: "Students",     desc: "Student community members" },
];

const TYPE_OPTIONS = [
  { value: "INFO",         label: "Info",         icon: <Info className="w-4 h-4" />,         color: "bg-blue-100 text-blue-700"   },
  { value: "ALERT",        label: "Alert",        icon: <AlertTriangle className="w-4 h-4" />, color: "bg-orange-100 text-orange-700"},
  { value: "ANNOUNCEMENT", label: "Announcement", icon: <Megaphone className="w-4 h-4" />,    color: "bg-violet-100 text-violet-700"},
];

interface LogEntry {
  id: string;
  title: string;
  message: string;
  type: string;
  audience: string;
  sentCount: number;
  sentAt: string;
}

// ─────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────
export default function NotificationsPage() {
  // Form state
  const [title, setTitle]       = useState("");
  const [message, setMessage]   = useState("");
  const [audience, setAudience] = useState("ALL");
  const [type, setType]         = useState("INFO");
  const [charCount, setCharCount] = useState(0);
  const MAX_CHARS = 200;

  // Request state
  const [sending, setSending]       = useState(false);
  const [success, setSuccess]       = useState<{ sent: number } | null>(null);
  const [error, setError]           = useState("");

  // History
  const [history, setHistory]       = useState<LogEntry[]>([]);
  const [histLoading, setHistLoading] = useState(true);
  const [histError, setHistError]   = useState(false);

  // ── Load history on mount ──
  const fetchHistory = async () => {
    setHistLoading(true);
    setHistError(false);
    try {
      const res  = await fetch("/api/notifications");
      const data = await res.json();
      if (data.success) setHistory(data.logs);
      else setHistError(true);
    } catch { setHistError(true); }
    finally   { setHistLoading(false); }
  };

  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this notification broadcast? It will also be removed from users' notification feeds.")) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/notifications?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (data.success) {
        setHistory(prev => prev.filter(h => h.id !== id));
      } else {
        alert(data.message || "Failed to delete notification");
      }
    } catch {
      alert("Network error");
    } finally {
      setDeletingId(null);
    }
  };

  useEffect(() => { fetchHistory(); }, []);

  // ── Send ──
  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !message.trim()) return;
    setSending(true);
    setError("");
    setSuccess(null);

    try {
      const res  = await fetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), message: message.trim(), type, audience }),
      });
      const data = await res.json();

      if (data.success) {
        setSuccess({ sent: data.sentTo });
        setTitle("");
        setMessage("");
        setCharCount(0);
        setAudience("ALL");
        setType("INFO");
        fetchHistory(); // refresh history
      } else {
        setError(data.message || "Failed to send notification.");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSending(false);
    }
  };

  const audienceLabel = AUDIENCE_OPTIONS.find(a => a.value === audience)?.label ?? audience;
  const typeInfo      = TYPE_OPTIONS.find(t => t.value === type);

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 space-y-6 w-full max-w-full overflow-x-hidden">

      {/* HEADER */}
      <div>
        <h1 className="text-2xl font-extrabold text-[#1A1C1C] tracking-tight">Notifications</h1>
        <p className="text-sm text-[#7D7387] mt-1">
          Broadcast push notifications directly to community members in real-time.
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_420px] gap-8 items-start">

        {/* ── LEFT: COMPOSE ── */}
        <div className="bg-white rounded-[28px] p-8 shadow-sm border border-gray-100">

          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center text-[#7004DC]">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-extrabold text-[#1A1C1C]">Compose Notification</h3>
              <p className="text-xs text-[#7D7387] mt-0.5">Fill in details and choose recipients</p>
            </div>
          </div>

          <form onSubmit={handleSend} className="space-y-5">

            {/* SUCCESS BANNER */}
            {success && (
              <div className="flex items-start gap-3 bg-green-50 border border-green-200 text-green-700 rounded-xl p-4">
                <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-bold">Notification sent successfully!</p>
                  <p className="text-xs mt-0.5">Delivered to <strong>{success.sent.toLocaleString()}</strong> user{success.sent !== 1 ? "s" : ""}.</p>
                </div>
                <button type="button" onClick={() => setSuccess(null)} className="ml-auto text-green-500 hover:text-green-700">
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* ERROR BANNER */}
            {error && (
              <div className="flex items-center gap-3 bg-red-50 border border-red-200 text-red-600 rounded-xl p-4">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <p className="text-sm font-semibold">{error}</p>
                <button type="button" onClick={() => setError("")} className="ml-auto"><X className="w-4 h-4" /></button>
              </div>
            )}

            {/* TITLE */}
            <div>
              <label className="block text-xs font-extrabold uppercase tracking-[0.15em] text-slate-500 mb-2">
                Notification Title *
              </label>
              <input
                type="text" value={title} required
                onChange={e => setTitle(e.target.value)}
                placeholder="e.g. New Feature Available"
                className="w-full h-12 rounded-xl bg-[#F7F5FA] px-4 text-sm outline-none border border-transparent focus:border-[#8A38F5] transition"
              />
            </div>

            {/* MESSAGE */}
            <div>
              <label className="block text-xs font-extrabold uppercase tracking-[0.15em] text-slate-500 mb-2">
                Message * <span className="normal-case font-normal text-slate-400">(max {MAX_CHARS} chars)</span>
              </label>
              <textarea
                value={message} required rows={4}
                onChange={e => { setMessage(e.target.value); setCharCount(e.target.value.length); }}
                maxLength={MAX_CHARS}
                placeholder="Write your notification message here..."
                className={`w-full rounded-xl bg-[#F7F5FA] px-4 py-3 text-sm outline-none border resize-none transition ${
                  charCount > MAX_CHARS * 0.9 ? "border-orange-300 focus:border-orange-400" : "border-transparent focus:border-[#8A38F5]"
                }`}
              />
              <p className={`text-xs mt-1 text-right font-medium ${charCount >= MAX_CHARS ? "text-red-500" : charCount > MAX_CHARS * 0.8 ? "text-orange-500" : "text-slate-400"}`}>
                {charCount}/{MAX_CHARS}
              </p>
            </div>

            {/* TYPE */}
            <div>
              <label className="block text-xs font-extrabold uppercase tracking-[0.15em] text-slate-500 mb-2">
                Notification Type
              </label>
              <div className="flex gap-2 flex-wrap">
                {TYPE_OPTIONS.map((t) => (
                  <button
                    type="button" key={t.value}
                    onClick={() => setType(t.value)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold border-2 transition ${
                      type === t.value
                        ? "border-[#8A38F5] bg-violet-50 text-[#7004DC]"
                        : "border-transparent bg-[#F3F3F3] text-[#4B4355] hover:bg-[#EBEBEB]"
                    }`}
                  >
                    {t.icon} {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* AUDIENCE */}
            <div>
              <label className="block text-xs font-extrabold uppercase tracking-[0.15em] text-slate-500 mb-2">
                Target Audience
              </label>
              <div className="grid grid-cols-1 gap-2 max-h-52 overflow-y-auto pr-1">
                {AUDIENCE_OPTIONS.map((opt) => (
                  <button
                    type="button" key={opt.value}
                    onClick={() => setAudience(opt.value)}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl text-left transition border-2 ${
                      audience === opt.value
                        ? "border-[#8A38F5] bg-violet-50"
                        : "border-transparent bg-[#F3F3F3] hover:bg-[#EBEBEB]"
                    }`}
                  >
                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                      audience === opt.value ? "border-[#8A38F5]" : "border-slate-300"
                    }`}>
                      {audience === opt.value && <div className="w-2 h-2 rounded-full bg-[#8A38F5]" />}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-[#1A1C1C]">{opt.label}</p>
                      <p className="text-xs text-[#7D7387]">{opt.desc}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* PREVIEW STRIP */}
            {title && message && (
              <div className="bg-[#F7F5FA] rounded-xl p-4 border border-[#ECE7F2]">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">PREVIEW</p>
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-[#7004DC] flex items-center justify-center shrink-0">
                    <Bell className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-[#1A1C1C]">{title}</p>
                    <p className="text-xs text-[#7D7387] mt-0.5 line-clamp-2">{message}</p>
                    <div className="flex items-center gap-2 mt-1.5">
                      {typeInfo && (
                        <span className={`px-2 py-0.5 rounded-md text-[9px] font-bold uppercase ${typeInfo.color}`}>
                          {typeInfo.label}
                        </span>
                      )}
                      <span className="text-[10px] text-slate-400">→ {audienceLabel}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* SEND BUTTON */}
            <button
              type="submit"
              disabled={sending || !title.trim() || !message.trim()}
              className="w-full h-13 py-3.5 rounded-xl bg-[#7004DC] hover:bg-[#5c03b7] disabled:bg-violet-200 text-white font-bold flex items-center justify-center gap-2 transition shadow-lg shadow-violet-300/20"
            >
              {sending ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Sending...</>
              ) : (
                <><Send className="w-4 h-4" /> Send Notification</>
              )}
            </button>
          </form>
        </div>

        {/* ── RIGHT: HISTORY ── */}
        <div className="bg-white rounded-[28px] p-8 shadow-sm border border-gray-100">

          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-extrabold text-[#1A1C1C]">Sent History</h3>
              <p className="text-xs text-[#7D7387] mt-0.5">Real notifications delivered to users</p>
            </div>
            <button
              onClick={fetchHistory}
              className="w-9 h-9 rounded-xl bg-[#F3F3F3] hover:bg-[#EBEBEB] flex items-center justify-center transition"
              title="Refresh history"
            >
              <RefreshCw className="w-4 h-4 text-[#7D7387]" />
            </button>
          </div>

          {histLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-8 h-8 animate-spin text-[#7004DC]" />
            </div>
          ) : histError ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400 gap-3">
              <AlertTriangle className="w-8 h-8 text-red-300" />
              <p className="text-sm font-semibold">Failed to load history</p>
              <button onClick={fetchHistory} className="text-xs font-bold text-[#7004DC] hover:underline">Try again</button>
            </div>
          ) : history.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400 gap-3">
              <Bell className="w-10 h-10 text-slate-300" />
              <p className="text-sm font-semibold">No notifications sent yet</p>
              <p className="text-xs text-center max-w-[200px]">Compose and send your first broadcast to see it here.</p>
            </div>
          ) : (
            <div className="space-y-4 max-h-[600px] overflow-y-auto pr-1">
              {history.map((item) => {
                const tInfo = TYPE_OPTIONS.find(t => t.value === item.type || item.type.includes(t.value));
                const aInfo = AUDIENCE_OPTIONS.find(a => a.value === item.audience);
                return (
                  <div key={item.id} className="bg-[#F7F5FA] rounded-2xl p-5 border border-[#ECE7F2]">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        {tInfo && (
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold uppercase ${tInfo.color}`}>
                            {tInfo.icon} {tInfo.label}
                          </span>
                        )}
                        {!tInfo && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold uppercase bg-gray-100 text-gray-600">
                            {item.type.replace("ADMIN_", "")}
                          </span>
                        )}
                        <span className="text-[10px] font-bold text-[#7D7387] uppercase tracking-wide">
                          → {aInfo?.label ?? item.audience}
                        </span>
                      </div>
                      <button
                        onClick={() => handleDelete(item.id)}
                        disabled={deletingId === item.id}
                        className="p-1 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-600 transition disabled:opacity-40"
                        title="Delete notification broadcast"
                      >
                        {deletingId === item.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-red-600" />
                        ) : (
                          <Trash2 className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                    <h4 className="font-bold text-sm text-[#1A1C1C]">{item.title}</h4>
                    <p className="text-xs text-[#7D7387] mt-1 line-clamp-2">{item.message}</p>
                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-[#ECE7F2]">
                      <div className="flex items-center gap-1.5 text-xs text-slate-400 font-semibold">
                        <Users className="w-3.5 h-3.5" />
                        <span>{item.sentCount.toLocaleString()} recipients</span>
                      </div>
                      <div className="flex items-center gap-1 text-xs text-slate-400">
                        <Clock className="w-3 h-3" /> {item.sentAt}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
