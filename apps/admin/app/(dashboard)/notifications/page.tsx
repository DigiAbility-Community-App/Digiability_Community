"use client";

import { useEffect, useState } from "react";
import {
  Bell, Send, Users, CheckCircle2, AlertTriangle, Info,
  Megaphone, Loader2, RefreshCw, Clock, X,
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
    <div className="px-8 py-8 space-y-8 max-w-[1300px]">

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

      {/* ── NOTIFICATION SETTINGS CARD ── */}
      <NotificationSettingsCard />
    </div>
  );
}

// ─────────────────────────────────────────────
// NOTIFICATION SETTINGS CARD
// ─────────────────────────────────────────────
function NotificationSettingsCard() {
  const [emailSettings, setEmailSettings] = useState({
    newUsers: true, contentReports: true, failedTransactions: true,
    systemErrors: true, weeklyDigest: true,
  });
  const [pushEnabled, setPushEnabled] = useState(true);
  const [pushSettings, setPushSettings] = useState({
    moderationQueue: true, userMilestones: true,
    communityHighlights: true, systemMaintenance: true,
  });
  const [smsSettings, setSmsSettings] = useState({
    criticalOnly: true, dailySummary: true, promotionalCampaigns: false,
  });
  const [phoneNumber, setPhoneNumber] = useState("");
  const [frequency, setFrequency] = useState("Real-time");
  const [quietStart, setQuietStart] = useState("20:00");
  const [quietEnd, setQuietEnd] = useState("08:00");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState("");

  // Load settings on mount
  useEffect(() => {
    fetch("/api/settings/notifications")
      .then(r => r.json())
      .then(data => {
        if (!data.success) return;
        const s = data.settings;
        setEmailSettings({
          newUsers: s.email_new_users,
          contentReports: s.email_content_reports,
          failedTransactions: s.email_failed_transactions,
          systemErrors: s.email_system_errors,
          weeklyDigest: s.email_weekly_digest,
        });
        setPushEnabled(s.push_enabled);
        setPushSettings({
          moderationQueue: s.push_moderation_queue,
          userMilestones: s.push_user_milestones,
          communityHighlights: s.push_community_highlights,
          systemMaintenance: s.push_system_maintenance,
        });
        setSmsSettings({
          criticalOnly: s.sms_critical_only,
          dailySummary: s.sms_daily_summary,
          promotionalCampaigns: s.sms_promotional,
        });
        setPhoneNumber(s.phone_number ?? "");
        setFrequency(s.frequency ?? "Real-time");
        setQuietStart(s.quiet_start ?? "20:00");
        setQuietEnd(s.quiet_end ?? "08:00");
      })
      .catch(() => {});
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setSaveError("");
    try {
      const res = await fetch("/api/settings/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          emailNewUsers: emailSettings.newUsers,
          emailContentReports: emailSettings.contentReports,
          emailFailedTransactions: emailSettings.failedTransactions,
          emailSystemErrors: emailSettings.systemErrors,
          emailWeeklyDigest: emailSettings.weeklyDigest,
          pushEnabled,
          pushModerationQueue: pushSettings.moderationQueue,
          pushUserMilestones: pushSettings.userMilestones,
          pushCommunityHighlights: pushSettings.communityHighlights,
          pushSystemMaintenance: pushSettings.systemMaintenance,
          smsCriticalOnly: smsSettings.criticalOnly,
          smsDailySummary: smsSettings.dailySummary,
          smsPromotional: smsSettings.promotionalCampaigns,
          phoneNumber,
          frequency,
          quietStart,
          quietEnd,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSaved(true);
        setTimeout(() => setSaved(false), 2500);
      } else {
        setSaveError("Failed to save settings.");
      }
    } catch {
      setSaveError("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const Toggle = ({ checked, onChange }: { checked: boolean; onChange: () => void }) => (
    <button
      type="button" onClick={onChange}
      className={`w-5 h-5 rounded flex items-center justify-center border-2 transition ${
        checked ? "bg-[#7004DC] border-[#7004DC]" : "bg-white border-gray-300"
      }`}
    >
      {checked && <CheckCircle2 className="w-3 h-3 text-white" strokeWidth={3} />}
    </button>
  );

  return (
    <div className="bg-white rounded-[28px] border border-gray-100 shadow-sm overflow-hidden">
      {/* TOP NAV */}
      <div className="flex items-center justify-between px-8 py-4 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-[#7004DC] flex items-center justify-center">
            <Bell className="w-4 h-4 text-white" />
          </div>
          <span className="text-sm font-extrabold text-[#1A1C1C]">DigiAbility Admin</span>
        </div>
        <div className="flex gap-6 text-sm font-semibold">
          {["General", "Roles", "Notifications", "Security"].map(tab => (
            <span key={tab} className={`pb-1 cursor-pointer transition ${tab === "Notifications" ? "text-[#7004DC] border-b-2 border-[#7004DC]" : "text-[#7D7387] hover:text-[#1A1C1C]"}`}>{tab}</span>
          ))}
        </div>
        <div className="flex items-center gap-3">
          {saveError && (
            <span className="text-xs text-red-500 font-semibold">{saveError}</span>
          )}
          <button
            onClick={handleSave} disabled={saving}
            className="h-9 px-5 rounded-xl bg-[#D2A500] hover:bg-[#b89300] disabled:bg-yellow-200 text-white font-bold text-sm flex items-center gap-2 transition"
          >
            {saving ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving...</> : saved ? <><CheckCircle2 className="w-3.5 h-3.5" /> Saved!</> : "Save Changes"}
          </button>
        </div>
      </div>

      {/* HEADING */}
      <div className="px-8 pt-7 pb-5">
        <h2 className="text-3xl font-extrabold text-[#1A1C1C]">Notification Settings</h2>
        <p className="text-sm text-[#7D7387] mt-1 max-w-lg">
          Configure how you receive alerts and notifications across all channels to keep your team informed and your community safe.
        </p>
      </div>

      <div className="px-8 pb-8 grid grid-cols-1 xl:grid-cols-[1fr_340px] gap-6">

        {/* LEFT: Email + Push */}
        <div className="space-y-6">

          {/* EMAIL NOTIFICATIONS */}
          <div className="bg-[#F7F5FA] rounded-2xl p-6 border border-[#ECE7F2]">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shadow-sm">
                <span className="text-lg">✉</span>
              </div>
              <div>
                <h4 className="font-extrabold text-sm text-[#1A1C1C]">Email Notifications</h4>
                <p className="text-xs text-[#7D7387]">Stay updated via your primary email address</p>
              </div>
            </div>
            <div className="space-y-4">
              {([
                { key: "newUsers",           label: "New user registrations" },
                { key: "contentReports",     label: "Content reports",           badge: "Urgent" },
                { key: "failedTransactions", label: "Failed transactions" },
                { key: "systemErrors",       label: "System errors" },
                { key: "weeklyDigest",       label: "Weekly digest" },
              ] as { key: keyof typeof emailSettings; label: string; badge?: string }[]).map(item => (
                <div key={item.key} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Toggle
                      checked={emailSettings[item.key]}
                      onChange={() => setEmailSettings(prev => ({ ...prev, [item.key]: !prev[item.key] }))}
                    />
                    <span className="text-sm font-semibold text-[#1A1C1C]">{item.label}</span>
                  </div>
                  {item.badge && (
                    <span className="px-2.5 py-0.5 rounded-full bg-red-100 text-red-600 text-[10px] font-bold uppercase">{item.badge}</span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* PUSH NOTIFICATIONS */}
          <div className="bg-[#F7F5FA] rounded-2xl p-6 border border-[#ECE7F2]">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shadow-sm">
                  <Bell className="w-5 h-5 text-[#7004DC]" />
                </div>
                <div>
                  <h4 className="font-extrabold text-sm text-[#1A1C1C]">Push Notifications</h4>
                  <p className="text-xs text-[#7D7387]">Alerts delivered directly to your device</p>
                </div>
              </div>
              <button
                onClick={() => setPushEnabled(v => !v)}
                className={`w-12 h-6 rounded-full relative transition ${pushEnabled ? "bg-[#7004DC]" : "bg-gray-200"}`}
              >
                <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${pushEnabled ? "right-1" : "left-1"}`} />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {([
                { key: "moderationQueue",    label: "Moderation queue updates" },
                { key: "userMilestones",     label: "User milestones" },
                { key: "communityHighlights",label: "Community highlights" },
                { key: "systemMaintenance",  label: "System maintenance alerts" },
              ] as { key: keyof typeof pushSettings; label: string }[]).map(item => (
                <div key={item.key} className={`flex items-start gap-3 transition ${pushEnabled ? "" : "opacity-40 pointer-events-none"}`}>
                  <Toggle
                    checked={pushSettings[item.key]}
                    onChange={() => setPushSettings(prev => ({ ...prev, [item.key]: !prev[item.key] }))}
                  />
                  <span className="text-sm font-semibold text-[#1A1C1C] leading-5">{item.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* RIGHT: SMS + Frequency + Quiet Hours */}
        <div className="space-y-5">

          {/* SMS */}
          <div className="bg-[#F7F5FA] rounded-2xl p-5 border border-[#ECE7F2]">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-base">💬</span>
              <h4 className="font-extrabold text-sm text-[#1A1C1C]">SMS Notifications</h4>
            </div>
            <div className="mb-4">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">PHONE NUMBER</p>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm">📱</span>
                <input
                  value={phoneNumber} onChange={e => setPhoneNumber(e.target.value)}
                  className="w-full h-10 rounded-xl bg-white pl-8 pr-3 text-sm outline-none border border-gray-200 focus:border-[#8A38F5]"
                />
              </div>
            </div>
            <div className="space-y-3">
              {([
                { key: "criticalOnly",          label: "Critical alerts only" },
                { key: "dailySummary",           label: "Daily summary" },
                { key: "promotionalCampaigns",   label: "Promotional campaigns" },
              ] as { key: keyof typeof smsSettings; label: string }[]).map(item => (
                <div key={item.key} className="flex items-center gap-3">
                  <Toggle
                    checked={smsSettings[item.key]}
                    onChange={() => setSmsSettings(prev => ({ ...prev, [item.key]: !prev[item.key] }))}
                  />
                  <span className="text-sm font-semibold text-[#4B4355]">{item.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* GLOBAL FREQUENCY */}
          <div className="bg-[#7004DC] rounded-2xl p-5 text-white">
            <h4 className="font-extrabold text-base mb-4">Global Frequency</h4>
            <div className="space-y-3">
              {["Real-time", "Daily digest", "Weekly digest", "None"].map(opt => (
                <div key={opt} className="flex items-center justify-between cursor-pointer" onClick={() => setFrequency(opt)}>
                  <span className={`text-sm font-semibold ${frequency === opt ? "text-white" : "text-white/70"}`}>{opt}</span>
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition ${frequency === opt ? "border-white bg-white" : "border-white/50"}`}>
                    {frequency === opt && <div className="w-2.5 h-2.5 rounded-full bg-[#7004DC]" />}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* QUIET HOURS */}
          <div className="bg-[#F7F5FA] rounded-2xl p-5 border border-[#ECE7F2]">
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-extrabold text-sm text-[#1A1C1C]">Quiet Hours</h4>
              <span className="text-lg">🌙</span>
            </div>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">START TIME</p>
                <input
                  value={quietStart} onChange={e => setQuietStart(e.target.value)}
                  className="w-full h-10 rounded-xl bg-white px-3 text-sm font-semibold outline-none border border-gray-200 focus:border-[#8A38F5] text-center"
                />
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">END TIME</p>
                <input
                  value={quietEnd} onChange={e => setQuietEnd(e.target.value)}
                  className="w-full h-10 rounded-xl bg-white px-3 text-sm font-semibold outline-none border border-gray-200 focus:border-[#8A38F5] text-center"
                />
              </div>
            </div>
            <div className="flex items-start gap-2 bg-blue-50 rounded-xl p-3">
              <Info className="w-3.5 h-3.5 text-blue-400 shrink-0 mt-0.5" />
              <p className="text-[10px] text-blue-600">Disable notifications during these hours. Critical system alerts will bypass this schedule.</p>
            </div>
          </div>
        </div>
      </div>

      {/* BOTTOM BANNER */}
      <div className="mx-8 mb-8 bg-gradient-to-r from-[#7004DC] to-[#9B30FF] rounded-2xl p-7 flex items-center justify-between gap-6">
        <div>
          <h3 className="text-xl font-extrabold text-white">Your Team's Peace of Mind Matters</h3>
          <p className="text-sm text-white/80 mt-1 max-w-md">
            Manage notification density to reduce digital fatigue and ensure that when an alert does come through, it truly matters.
          </p>
        </div>
        <button className="shrink-0 h-11 px-6 rounded-xl bg-white text-[#7004DC] font-bold text-sm hover:bg-violet-50 transition whitespace-nowrap">
          View Alert Logs
        </button>
      </div>
    </div>
  );
}
