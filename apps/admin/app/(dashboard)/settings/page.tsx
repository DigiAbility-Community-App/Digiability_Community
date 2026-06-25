"use client";

import { useState, useEffect } from "react";
import {
  ChevronRight,
  Plus,
  Pencil,
  Trash2,
  Check,
  Settings,
  Users,
  Database,
  Bell,
  Shield,
  Palette,
  Phone,
  Mail,
  Monitor,
  RefreshCw,
  X,
  Edit2,
  Wifi,
  WifiOff,
  AlertCircle,
  Moon,
  MessageSquare,
  Smartphone,
} from "lucide-react";

// ─────────────────────────────────────
// TYPES
// ─────────────────────────────────────

type Tab = "General" | "User Roles" | "Master Data" | "Notifications" | "Security" | "Appearance";

interface DisabilityType {
  id: string;
  code: string;
  name: string;
  status: string;
}

const MENU_ITEMS: { label: Tab; icon: React.ReactNode }[] = [
  { label: "General",       icon: <Settings className="w-4 h-4" /> },
  { label: "User Roles",    icon: <Users className="w-4 h-4" /> },
  { label: "Master Data",   icon: <Database className="w-4 h-4" /> },
  { label: "Notifications", icon: <Bell className="w-4 h-4" /> },
  { label: "Security",      icon: <Shield className="w-4 h-4" /> },
  { label: "Appearance",    icon: <Palette className="w-4 h-4" /> },
];

const GOVERNMENT_SCHEMES = [
  { title: "UDID Registration", subtitle: "Central Government" },
  { title: "ADIP Scheme",       subtitle: "Aid to Disabled Persons" },
  { title: "Niramaya Insurance", subtitle: "National Trust" },
];

const RESOURCE_CATEGORIES = [
  { icon: "📚", title: "Educational Guides", subtitle: "42 Articles" },
  { icon: "⚖️", title: "Legal Rights",       subtitle: "18 Documents" },
  { icon: "🏥", title: "Therapy Centers",    subtitle: "256 Locations" },
];

const AUDIT_LOG = [
  { action: "Password Policy Updated", detail: "Changed min length to 12", admin: "Alex Rivers",  ip: "192.168.1.1",  date: "Oct 24, 2023 14:22:10 GMT", status: "Success" },
  { action: "Failed Login Attempt",    detail: "3 consecutive failures",    admin: "System-wide", ip: "45.22.190.11", date: "Oct 24, 2023 12:05:44 GMT", status: "Blocked" },
  { action: "New Admin Invited",       detail: "Sarah Mitchell (Editor)",   admin: "Alex Rivers",  ip: "192.168.1.1",  date: "Oct 23, 2023 09:12:01 GMT", status: "Success" },
];

// ─────────────────────────────────────
// PAGE
// ─────────────────────────────────────

export default function AdminSettingsPage() {
  const [activeTab, setActiveTab] = useState<Tab>("General");
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  return (
    <div className="min-h-screen bg-[#F4F1F8]">
      {/* SAVE TOAST */}
      {saved && (
        <div className="fixed top-6 right-6 z-50 flex items-center gap-3 bg-green-600 text-white px-5 py-3 rounded-xl shadow-lg font-semibold text-sm">
          <Check className="w-4 h-4" /> Changes saved successfully
        </div>
      )}

      <div className="px-10 py-8 max-w-[1450px] mx-auto">
        <div className="grid grid-cols-1 xl:grid-cols-[280px_minmax(0,1fr)] gap-6 items-start">

          {/* LEFT PANEL */}
          <div className="space-y-6">
            <div className="bg-white rounded-[28px] border border-[#ECE7F2] shadow-sm p-7">
              <p className="text-xs font-extrabold tracking-[0.2em] uppercase text-slate-400 mb-5">
                System Settings
              </p>
              <div className="space-y-1">
                {MENU_ITEMS.map(({ label, icon }) => {
                  const active = activeTab === label;
                  return (
                    <button
                      key={label}
                      onClick={() => setActiveTab(label)}
                      className={`w-full h-12 rounded-xl px-4 flex items-center justify-between transition-all ${
                        active
                          ? "bg-[#7004DC] text-white font-bold shadow-md"
                          : "hover:bg-[#F3F3F3] text-[#4B4355]"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className={active ? "text-white" : "text-slate-400"}>{icon}</span>
                        <span className="text-sm">{label}</span>
                      </div>
                      <ChevronRight className={`w-4 h-4 ${active ? "text-white" : "text-slate-300"}`} />
                    </button>
                  );
                })}
              </div>
            </div>

            {/* SYNC CARD */}
            <div className="relative overflow-hidden bg-[#7004DC] rounded-2xl p-6 text-white">
              <div className="absolute -right-6 -bottom-6 w-24 h-24 rounded-full bg-white/10" />
              <div className="absolute -right-2 -bottom-2 w-12 h-12 rounded-full bg-white/10" />
              <div className="relative z-10">
                <p className="text-sm text-white/70">Last Synchronized</p>
                <h2 className="text-2xl font-extrabold mt-1">2 minutes ago</h2>
                <button className="mt-4 inline-flex items-center gap-2 bg-white/20 hover:bg-white/30 rounded-lg px-3 py-1.5 text-xs font-semibold transition">
                  <RefreshCw className="w-3 h-3" />
                  Auto-sync enabled
                </button>
              </div>
            </div>
          </div>

          {/* RIGHT CONTENT */}
          <div>
            {activeTab === "General"       && <GeneralTab onSave={handleSave} />}
            {activeTab === "Master Data"   && <MasterDataTab />}
            {activeTab === "Notifications" && <NotificationsTab onSave={handleSave} />}
            {activeTab === "Security"      && <SecurityTab onSave={handleSave} />}
            {activeTab === "User Roles"    && <StubTab title="User Roles"  description="Configure admin roles and permissions for the platform." />}
            {activeTab === "Appearance"    && <StubTab title="Appearance"  description="Customise the look and feel of the admin portal." />}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────
// GENERAL TAB
// ─────────────────────────────────────

function GeneralTab({ onSave }: { onSave: () => void }) {
  const [maintenance, setMaintenance] = useState(false);
  const [langs, setLangs] = useState(["English", "Hindi", "Marathi"]);
  const allLangs = ["English", "Hindi", "Marathi", "Tamil"];

  const toggle = (l: string) =>
    setLangs((prev) => prev.includes(l) ? prev.filter((x) => x !== l) : [...prev, l]);

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-[28px] border border-[#ECE7F2] shadow-sm p-8">
        <h2 className="text-2xl font-extrabold text-[#1A1C1C]">General Settings</h2>
        <p className="text-sm text-[#4B4355]/70 mt-1">
          Update your platform identification and accessibility preferences
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
          <IconInput label="Platform Name"      icon={<Monitor className="w-4 h-4" />} defaultValue="DigiAbility Admin Portal" />
          <IconInput label="Support Phone"      icon={<Phone   className="w-4 h-4" />} defaultValue="+91 88000 12345" />
          <div className="md:col-span-2">
            <IconInput label="Email Configuration" icon={<Mail className="w-4 h-4" />} defaultValue="admin@digiability.org" />
          </div>
        </div>

        {/* MAINTENANCE MODE */}
        <div className="mt-6 border border-[#E8E8E8] rounded-2xl p-5 flex items-center justify-between">
          <div>
            <p className="font-bold text-[#1A1C1C]">Maintenance Mode</p>
            <p className="text-sm text-[#4B4355]/70 mt-0.5">
              Prevent users from accessing the platform during updates.
            </p>
          </div>
          <Toggle value={maintenance} onChange={setMaintenance} />
        </div>

        {/* LANGUAGES */}
        <div className="mt-8 pt-8 border-t border-[#E8E8E8]">
          <p className="text-xs font-extrabold uppercase tracking-[0.15em] text-slate-500 mb-4">
            Supported Languages
          </p>
          <div className="flex flex-wrap gap-3">
            {allLangs.map((l) => {
              const active = langs.includes(l);
              return (
                <button
                  key={l}
                  onClick={() => toggle(l)}
                  className={`h-11 px-5 rounded-xl border flex items-center gap-2.5 font-semibold text-sm transition-all ${
                    active
                      ? "bg-[#EEDBFF] border-[#8A38F5]/30 text-[#1A1C1C]"
                      : "bg-[#F3F3F3] border-transparent text-[#4B4355]/60"
                  }`}
                >
                  <div className={`w-5 h-5 rounded-md flex items-center justify-center transition-all ${
                    active ? "bg-[#7004DC]" : "border-2 border-slate-300 bg-white"
                  }`}>
                    {active && <Check className="w-3 h-3 text-white" />}
                  </div>
                  {l}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ACCESSIBILITY STANDARD */}
      <div className="relative overflow-hidden bg-[#7004DC] rounded-2xl p-7 text-white">
        <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full bg-white/10" />
        <div className="relative z-10 flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-white/60 mb-2">Accessibility</p>
            <h3 className="text-xl font-extrabold">Accessibility Standard</h3>
            <p className="text-sm text-white/70 mt-2 max-w-md">
              The platform is currently adhering to WCAG 2.1 AA standards.
              Ensure all changes to the UI maintain this compliance score.
            </p>
          </div>
          <button className="flex-shrink-0 h-10 px-6 rounded-xl bg-white/20 hover:bg-white/30 text-sm font-bold transition">
            View Compliance Report
          </button>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          onClick={onSave}
          className="h-11 px-8 rounded-xl bg-[#D2A500] hover:bg-[#b89300] text-white font-bold text-sm transition shadow-md"
        >
          Save Changes
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────
// MASTER DATA TAB  (real DB)
// ─────────────────────────────────────

function MasterDataTab() {
  const [types, setTypes] = useState<DisabilityType[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [saving, setSaving] = useState(false);

  const loadTypes = async () => {
    setLoading(true);
    setFetchError("");
    try {
      const res = await fetch("/api/settings/disability-types");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.success) {
        setTypes(data.types);
      } else {
        setFetchError(data.message || "Failed to load types");
      }
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : "Network error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadTypes(); }, []);  // eslint-disable-line react-hooks/exhaustive-deps

  const addType = async () => {
    if (!newName.trim() || saving) return;
    setSaving(true);
    try {
      const res = await fetch("/api/settings/disability-types", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName }),
      });
      const data = await res.json();
      if (data.success) {
        setTypes((prev) => [...prev, data.type]);
        setNewName("");
        setShowAdd(false);
      }
    } finally {
      setSaving(false);
    }
  };

  const saveEdit = async (id: string) => {
    if (!editName.trim() || saving) return;
    setSaving(true);
    try {
      const res = await fetch("/api/settings/disability-types", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, name: editName }),
      });
      const data = await res.json();
      if (data.success) {
        setTypes((prev) => prev.map((t) => (t.id === id ? data.type : t)));
        setEditId(null);
      }
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (t: DisabilityType) => {
    const newStatus = t.status === "Active" ? "Inactive" : "Active";
    const res = await fetch("/api/settings/disability-types", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: t.id, status: newStatus }),
    });
    const data = await res.json();
    if (data.success) setTypes((prev) => prev.map((x) => (x.id === t.id ? data.type : x)));
  };

  const deleteType = async (id: string) => {
    await fetch(`/api/settings/disability-types?id=${id}`, { method: "DELETE" });
    setTypes((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <div className="space-y-6">
      {/* DISABILITY TYPES */}
      <div className="bg-white rounded-2xl border border-[#ECE7F2] shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-8 py-6 border-b border-[#E8E8E8]">
          <div>
            <h3 className="text-xl font-extrabold text-[#1A1C1C]">Disability Types</h3>
            <p className="text-sm text-[#4B4355]/70 mt-1">
              Master list of recognised disabilities for profiling. Changes apply to all user profile dropdowns.
            </p>
          </div>
          <button
            onClick={() => setShowAdd(true)}
            className="h-10 px-5 rounded-xl bg-[#D2A500] hover:bg-[#b89300] transition flex items-center gap-2 font-bold text-white text-sm shadow-sm"
          >
            <Plus className="w-4 h-4" /> Add New
          </button>
        </div>

        {/* TABLE HEADER */}
        <div className="grid grid-cols-[140px_1fr_160px_140px] bg-[#F7F5FA]">
          <Th>ID</Th><Th>Category Name</Th><Th>Status</Th><Th>Actions</Th>
        </div>

        {loading ? (
          <div className="px-8 py-8 text-sm text-slate-400 flex items-center gap-2">
            <svg className="w-4 h-4 animate-spin text-[#7004DC]" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
            </svg>
            Loading from database…
          </div>
        ) : fetchError ? (
          <div className="px-8 py-8 flex items-center gap-3">
            <span className="text-sm text-red-500 font-semibold">Error: {fetchError}</span>
            <button onClick={loadTypes} className="text-sm text-[#7004DC] font-bold hover:underline">Retry</button>
          </div>
        ) : (
          types.map((t, i) => (
            <div
              key={t.id}
              className={`grid grid-cols-[140px_1fr_160px_140px] items-center ${i < types.length - 1 ? "border-b border-[#F0F0F0]" : ""}`}
            >
              <Td mono>{t.code}</Td>
              <Td>
                {editId === t.id ? (
                  <div className="flex items-center gap-2">
                    <input
                      autoFocus
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && saveEdit(t.id)}
                      className="flex-1 h-8 bg-[#F7F5FA] rounded-lg px-3 text-sm border border-[#8A38F5]/30 outline-none"
                    />
                    <button onClick={() => saveEdit(t.id)} disabled={saving} className="w-7 h-7 rounded-lg bg-[#7004DC] flex items-center justify-center">
                      <Check className="w-3.5 h-3.5 text-white" />
                    </button>
                    <button onClick={() => setEditId(null)} className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center">
                      <X className="w-3.5 h-3.5 text-slate-500" />
                    </button>
                  </div>
                ) : (
                  t.name
                )}
              </Td>
              <Td>
                <button
                  onClick={() => toggleStatus(t)}
                  className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold transition ${
                    t.status === "Active"
                      ? "bg-green-100 text-green-700 hover:bg-green-200"
                      : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                  }`}
                >
                  {t.status}
                </button>
              </Td>
              <div className="px-6 flex items-center gap-2">
                <button
                  onClick={() => { setEditId(t.id); setEditName(t.name); }}
                  className="w-8 h-8 rounded-lg hover:bg-violet-50 flex items-center justify-center text-[#7004DC] transition"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => deleteType(t.id)}
                  className="w-8 h-8 rounded-lg hover:bg-red-50 flex items-center justify-center text-red-500 transition"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))
        )}

        {/* ADD ROW */}
        {showAdd && (
          <div className="grid grid-cols-[140px_1fr_160px_140px] items-center border-t border-[#E8E8E8] bg-[#FAFAFA]">
            <div className="px-6 py-4 text-sm font-mono text-slate-400">AUTO</div>
            <div className="px-4 py-4">
              <input
                autoFocus
                placeholder="Disability type name…"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addType()}
                className="w-full h-9 bg-[#F7F5FA] rounded-lg px-3 text-sm border border-[#8A38F5]/30 outline-none"
              />
            </div>
            <div className="px-4 py-4">
              <span className="inline-flex px-3 py-1 rounded-full text-xs font-bold bg-green-100 text-green-700">Active</span>
            </div>
            <div className="px-6 py-4 flex items-center gap-2">
              <button onClick={addType} disabled={saving} className="h-8 px-3 rounded-lg bg-[#7004DC] text-white text-xs font-bold hover:bg-[#5a03b0] transition">
                {saving ? "…" : "Add"}
              </button>
              <button onClick={() => setShowAdd(false)} className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center">
                <X className="w-3.5 h-3.5 text-slate-500" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* SCHEMES + RESOURCES */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SmallSection  title="Government Schemes"   icon="⊕" items={GOVERNMENT_SCHEMES} />
        <ResourceSection title="Resource Categories" items={RESOURCE_CATEGORIES} />
      </div>
    </div>
  );
}

// ─────────────────────────────────────
// NOTIFICATIONS TAB  (matching Figma)
// ─────────────────────────────────────

function NotificationsTab({ onSave }: { onSave: () => void }) {
  // Email
  const [email, setEmail] = useState({
    newUsers: true, contentReports: true, failedTx: true,
    sysErrors: true, weeklyDigest: true,
  });
  // SMS
  const [phone, setPhone] = useState("+91 98765 43210");
  const [sms, setSms] = useState({ critical: true, daily: true, promo: false });
  // Push
  const [pushEnabled, setPushEnabled] = useState(true);
  const [push, setPush] = useState({ modQueue: true, milestones: true, community: true, sysAlerts: true });
  // Frequency
  const [freq, setFreq] = useState<"realtime" | "daily" | "weekly" | "none">("realtime");
  // Quiet hours
  const [quietStart, setQuietStart] = useState("20:00");
  const [quietEnd, setQuietEnd] = useState("08:00");

  const toggleEmail = (k: keyof typeof email) => setEmail((p) => ({ ...p, [k]: !p[k] }));
  const toggleSms   = (k: keyof typeof sms)   => setSms((p)   => ({ ...p, [k]: !p[k] }));
  const togglePush  = (k: keyof typeof push)  => setPush((p)  => ({ ...p, [k]: !p[k] }));

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-extrabold text-[#1A1C1C]">Notification Settings</h2>
        <p className="text-sm text-[#4B4355]/70 mt-1">
          Configure how you receive alerts and notifications across all channels to keep your team
          informed and your community safe.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6">
        {/* LEFT COLUMN */}
        <div className="space-y-5">
          {/* EMAIL NOTIFICATIONS */}
          <div className="bg-white rounded-2xl border border-[#ECE7F2] shadow-sm p-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-xl bg-[#F3EEFF] flex items-center justify-center">
                <Mail className="w-5 h-5 text-[#7004DC]" />
              </div>
              <div>
                <h3 className="font-extrabold text-[#1A1C1C]">Email Notifications</h3>
                <p className="text-xs text-[#4B4355]/60">Stay updated via your primary email address</p>
              </div>
            </div>
            <div className="space-y-3">
              <NotiCheck label="New user registrations"   checked={email.newUsers}       onChange={() => toggleEmail("newUsers")} />
              <NotiCheck label="Content reports"          checked={email.contentReports} onChange={() => toggleEmail("contentReports")} urgent />
              <NotiCheck label="Failed transactions"      checked={email.failedTx}       onChange={() => toggleEmail("failedTx")} />
              <NotiCheck label="System errors"            checked={email.sysErrors}      onChange={() => toggleEmail("sysErrors")} />
              <NotiCheck label="Weekly digest"            checked={email.weeklyDigest}   onChange={() => toggleEmail("weeklyDigest")} />
            </div>
          </div>

          {/* PUSH NOTIFICATIONS */}
          <div className="bg-white rounded-2xl border border-[#ECE7F2] shadow-sm p-6">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#F3EEFF] flex items-center justify-center">
                  <Smartphone className="w-5 h-5 text-[#7004DC]" />
                </div>
                <div>
                  <h3 className="font-extrabold text-[#1A1C1C]">Push Notifications</h3>
                  <p className="text-xs text-[#4B4355]/60">Alerts delivered directly to your device</p>
                </div>
              </div>
              <Toggle value={pushEnabled} onChange={setPushEnabled} />
            </div>
            <div className={`grid grid-cols-2 gap-3 transition-opacity ${pushEnabled ? "opacity-100" : "opacity-40 pointer-events-none"}`}>
              <NotiCheck label="Moderation queue updates" checked={push.modQueue}   onChange={() => togglePush("modQueue")} />
              <NotiCheck label="User milestones"          checked={push.milestones} onChange={() => togglePush("milestones")} />
              <NotiCheck label="Community highlights"     checked={push.community}  onChange={() => togglePush("community")} />
              <NotiCheck label="System maintenance alerts" checked={push.sysAlerts} onChange={() => togglePush("sysAlerts")} />
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN */}
        <div className="space-y-5">
          {/* SMS */}
          <div className="bg-white rounded-2xl border border-[#ECE7F2] shadow-sm p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-xl bg-[#F3EEFF] flex items-center justify-center">
                <MessageSquare className="w-4 h-4 text-[#7004DC]" />
              </div>
              <h3 className="font-extrabold text-[#1A1C1C]">SMS Notifications</h3>
            </div>
            <div className="mb-4">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Phone Number</p>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full h-10 bg-[#F7F5FA] rounded-xl pl-9 pr-3 text-sm border border-transparent focus:border-[#8A38F5]/30 outline-none"
                />
              </div>
            </div>
            <div className="space-y-2.5">
              <NotiCheck label="Critical alerts only"  checked={sms.critical} onChange={() => toggleSms("critical")} />
              <NotiCheck label="Daily summary"         checked={sms.daily}    onChange={() => toggleSms("daily")} />
              <NotiCheck label="Promotional campaigns" checked={sms.promo}    onChange={() => toggleSms("promo")} />
            </div>
          </div>

          {/* GLOBAL FREQUENCY */}
          <div className="bg-[#7004DC] rounded-2xl p-5 text-white">
            <h3 className="font-extrabold mb-4">Global Frequency</h3>
            <div className="space-y-3">
              {(["realtime","daily","weekly","none"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFreq(f)}
                  className="w-full flex items-center justify-between"
                >
                  <span className="text-sm capitalize">{f === "realtime" ? "Real-time" : f === "daily" ? "Daily digest" : f === "weekly" ? "Weekly digest" : "None"}</span>
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition ${
                    freq === f ? "border-white bg-white" : "border-white/40"
                  }`}>
                    {freq === f && <div className="w-2.5 h-2.5 rounded-full bg-[#7004DC]" />}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* QUIET HOURS */}
          <div className="bg-white rounded-2xl border border-[#ECE7F2] shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-extrabold text-[#1A1C1C]">Quiet Hours</h3>
              <Moon className="w-5 h-5 text-slate-400" />
            </div>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Start Time</p>
                <input
                  type="time"
                  value={quietStart}
                  onChange={(e) => setQuietStart(e.target.value)}
                  className="w-full h-10 bg-[#F7F5FA] rounded-xl px-3 text-sm font-semibold border border-transparent focus:border-[#8A38F5]/30 outline-none"
                />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">End Time</p>
                <input
                  type="time"
                  value={quietEnd}
                  onChange={(e) => setQuietEnd(e.target.value)}
                  className="w-full h-10 bg-[#F7F5FA] rounded-xl px-3 text-sm font-semibold border border-transparent focus:border-[#8A38F5]/30 outline-none"
                />
              </div>
            </div>
            <div className="flex items-start gap-2 p-3 bg-[#F7F5FA] rounded-xl">
              <AlertCircle className="w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-[#4B4355]/70 leading-relaxed">
                Disable notifications during these hours. Critical system alerts will bypass this schedule.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* BANNER */}
      <div className="relative overflow-hidden bg-gradient-to-r from-[#7004DC] to-[#9A3FF5] rounded-2xl p-8 flex items-center justify-between">
        <div className="absolute -right-10 -top-10 w-40 h-40 rounded-full bg-white/10" />
        <div className="absolute -right-4 bottom-0 w-24 h-24 rounded-full bg-white/5" />
        <div className="relative z-10">
          <h3 className="text-2xl font-extrabold text-white max-w-xs leading-snug">
            Your Team&apos;s Peace of Mind Matters
          </h3>
          <p className="text-white/70 text-sm mt-2 max-w-sm">
            Manage notification density to reduce digital fatigue and ensure that when an alert
            does come through, it truly matters.
          </p>
        </div>
        <button className="relative z-10 flex-shrink-0 h-12 px-7 bg-white text-[#7004DC] font-extrabold rounded-xl text-sm hover:bg-[#F3EEFF] transition shadow-lg">
          View Alert Logs
        </button>
      </div>

      <div className="flex justify-end">
        <button
          onClick={onSave}
          className="h-11 px-8 rounded-xl bg-[#D2A500] hover:bg-[#b89300] text-white font-bold text-sm transition shadow-md"
        >
          Save Changes
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────
// SECURITY TAB
// ─────────────────────────────────────

function SecurityTab({ onSave }: { onSave: () => void }) {
  const [twoFa, setTwoFa] = useState(true);
  const [minLen, setMinLen] = useState(12);
  const [upperCase, setUpperCase] = useState(true);
  const [numbers, setNumbers] = useState(true);
  const [special, setSpecial] = useState(true);
  const [maxAttempts, setMaxAttempts] = useState("5");
  const [lockout, setLockout] = useState("15");
  const [ipWhitelist, setIpWhitelist] = useState(false);
  const [ipInput, setIpInput] = useState("");
  const [ips, setIps] = useState(["10.0.0.42"]);
  const [auditFilter, setAuditFilter] = useState("");

  const addIp = () => {
    const v = ipInput.trim();
    if (v && /^[\d.]+$/.test(v)) { setIps((p) => [...p, v]); setIpInput(""); }
  };

  const filtered = AUDIT_LOG.filter(
    (l) =>
      !auditFilter ||
      l.action.toLowerCase().includes(auditFilter.toLowerCase()) ||
      l.admin.toLowerCase().includes(auditFilter.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-extrabold text-[#1A1C1C]">Security Settings</h2>
        <p className="text-sm text-[#4B4355]/70 mt-1">
          Manage security policies and access control for the DigiAbility infrastructure.
        </p>
      </div>

      {/* 2FA + PASSWORD POLICY */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-[#ECE7F2] shadow-sm p-6">
          <div className="flex items-start justify-between mb-4">
            <div className="w-12 h-12 rounded-xl bg-[#7004DC]/10 flex items-center justify-center">
              <Shield className="w-6 h-6 text-[#7004DC]" />
            </div>
            <span className={`px-3 py-1 rounded-full text-xs font-bold ${twoFa ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"}`}>
              {twoFa ? "ENABLED" : "DISABLED"}
            </span>
          </div>
          <h3 className="text-lg font-extrabold text-[#1A1C1C]">Two-Factor Authentication</h3>
          <p className="text-sm text-[#4B4355]/70 mt-2">Google Authenticator is currently your primary verification method.</p>
          <div className="mt-5 flex items-center gap-3 p-3 bg-[#F7F5FA] rounded-xl">
            <AlertCircle className="w-4 h-4 text-[#7004DC]" />
            <span className="text-sm font-semibold text-[#1A1C1C]">8 Backup Codes Remaining</span>
          </div>
          <button
            onClick={() => setTwoFa(!twoFa)}
            className={`mt-5 w-full h-10 rounded-xl font-bold text-sm transition ${twoFa
              ? "bg-red-50 hover:bg-red-100 text-red-600 border border-red-200"
              : "bg-[#7004DC] hover:bg-[#5a03b0] text-white"}`}
          >
            {twoFa ? "Disable 2FA" : "Enable 2FA"}
          </button>
        </div>

        <div className="bg-white rounded-2xl border border-[#ECE7F2] shadow-sm p-6">
          <h3 className="text-lg font-extrabold text-[#1A1C1C] mb-5">Password Policy</h3>
          <div className="space-y-5">
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-semibold text-[#4B4355]">Minimum Length</span>
                <span className="text-lg font-extrabold text-[#7004DC]">{minLen}</span>
              </div>
              <input type="range" min={8} max={20} value={minLen} onChange={(e) => setMinLen(Number(e.target.value))} className="w-full accent-[#7004DC]" />
              <div className="flex justify-between text-xs text-slate-400 mt-1"><span>8 CHARS</span><span>20 CHARS</span></div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: "UPPERCASE", value: upperCase, set: setUpperCase },
                { label: "NUMBERS",   value: numbers,   set: setNumbers },
                { label: "SPECIAL",   value: special,   set: setSpecial },
              ].map(({ label, value, set }) => (
                <div key={label} className="flex flex-col items-center gap-2 p-3 bg-[#F7F5FA] rounded-xl">
                  <span className="text-[10px] font-extrabold text-slate-500 tracking-wider">{label}</span>
                  <Toggle value={value} onChange={set} small />
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-[#F0F0F0]">
              <button className="text-sm font-bold text-[#7004DC] hover:underline">View Codes</button>
              <div className="flex items-center gap-2">
                <span className="text-sm text-[#4B4355]/70">Password Expiry</span>
                <span className="font-bold text-[#1A1C1C]">90 days</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* LOGIN ATTEMPTS + IP WHITELIST */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-[#ECE7F2] shadow-sm p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-9 h-9 rounded-xl bg-orange-100 flex items-center justify-center">
              <AlertCircle className="w-5 h-5 text-orange-500" />
            </div>
            <h3 className="text-lg font-extrabold text-[#1A1C1C]">Login Attempts</h3>
          </div>
          <div className="space-y-4">
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Max Failed Attempts</label>
              <div className="mt-2 flex items-center gap-3">
                <input type="number" value={maxAttempts} onChange={(e) => setMaxAttempts(e.target.value)}
                  className="w-20 h-11 bg-[#F7F5FA] rounded-xl px-3 text-center font-bold text-[#1A1C1C] border border-transparent focus:border-[#8A38F5]/30 focus:outline-none" />
                <span className="text-sm text-[#4B4355]">attempts</span>
              </div>
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Lockout Duration</label>
              <div className="mt-2 flex items-center gap-3">
                <input type="number" value={lockout} onChange={(e) => setLockout(e.target.value)}
                  className="w-20 h-11 bg-[#F7F5FA] rounded-xl px-3 text-center font-bold text-[#1A1C1C] border border-transparent focus:border-[#8A38F5]/30 focus:outline-none" />
                <span className="text-sm text-[#4B4355]">minutes</span>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-[#ECE7F2] shadow-sm p-6">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center">
                {ipWhitelist ? <Wifi className="w-5 h-5 text-blue-500" /> : <WifiOff className="w-5 h-5 text-slate-400" />}
              </div>
              <h3 className="text-lg font-extrabold text-[#1A1C1C]">IP Whitelist</h3>
            </div>
            <Toggle value={ipWhitelist} onChange={setIpWhitelist} />
          </div>
          <div className="flex gap-2 mb-4">
            <input type="text" placeholder="192.168.1.1" value={ipInput} onChange={(e) => setIpInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addIp()}
              className="flex-1 h-10 bg-[#F7F5FA] rounded-xl px-3 text-sm border border-transparent focus:border-[#8A38F5]/30 focus:outline-none" />
            <button onClick={addIp} className="h-10 px-4 bg-[#7004DC] hover:bg-[#5a03b0] text-white rounded-xl text-sm font-bold transition">
              Add IP
            </button>
          </div>
          <div className="space-y-2">
            {ips.map((ip) => (
              <div key={ip} className="flex items-center justify-between h-10 px-3 bg-[#F7F5FA] rounded-xl">
                <span className="text-sm font-mono text-[#1A1C1C]">{ip}</span>
                <div className="flex items-center gap-1">
                  <button className="w-7 h-7 rounded-lg hover:bg-violet-100 flex items-center justify-center text-[#7004DC] transition">
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => setIps((p) => p.filter((x) => x !== ip))}
                    className="w-7 h-7 rounded-lg hover:bg-red-50 flex items-center justify-center text-red-400 transition">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ACTIVE SESSIONS */}
      <div className="bg-white rounded-2xl border border-[#ECE7F2] shadow-sm p-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="text-lg font-extrabold text-[#1A1C1C]">Active Sessions</h3>
            <p className="text-sm text-[#4B4355]/70 mt-0.5">Monitor and manage currently logged-in devices.</p>
          </div>
          <button className="h-9 px-5 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-bold transition">
            Sign out all other sessions
          </button>
        </div>
        <div className="space-y-3">
          {[
            { device: "Chrome / macOS Sonoma", location: "London, United Kingdom", ip: "192.168.1.1", current: true,  duration: "2 hours ago" },
            { device: "Safari / iPhone 15 Pro",  location: "Manchester, UK",            ip: "81.123.45.67", current: false, duration: "15 mins ago" },
          ].map((s, i) => (
            <div key={i} className="flex items-center justify-between p-4 bg-[#F7F5FA] rounded-xl">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-[#7004DC]/10 flex items-center justify-center">
                  <Monitor className="w-5 h-5 text-[#7004DC]" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-[#1A1C1C] text-sm">{s.device}</span>
                    {s.current && <span className="px-2 py-0.5 rounded bg-[#7004DC] text-white text-[10px] font-bold">CURRENT</span>}
                  </div>
                  <p className="text-xs text-[#4B4355]/60 mt-0.5">{s.location} • {s.ip}</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className="text-xs text-slate-400 uppercase tracking-wider">Duration</p>
                  <p className="text-sm font-bold text-[#1A1C1C]">{s.duration}</p>
                </div>
                {!s.current && (
                  <button className="h-8 px-4 rounded-lg border border-[#E8E8E8] hover:bg-red-50 hover:border-red-200 text-sm font-bold text-[#1A1C1C] hover:text-red-600 transition">
                    Sign Out
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* SECURITY AUDIT LOG */}
      <div className="bg-white rounded-2xl border border-[#ECE7F2] shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-6 py-5 border-b border-[#F0F0F0]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#F7F5FA] flex items-center justify-center">
              <Database className="w-4 h-4 text-[#7004DC]" />
            </div>
            <h3 className="text-lg font-extrabold text-[#1A1C1C]">Security Audit Log</h3>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <input type="text" placeholder="Filter actions…" value={auditFilter} onChange={(e) => setAuditFilter(e.target.value)}
                className="h-9 w-48 bg-[#F7F5FA] rounded-xl pl-9 pr-3 text-sm border border-transparent focus:border-[#8A38F5]/30 focus:outline-none" />
              <svg className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" strokeLinecap="round" />
              </svg>
            </div>
            <button className="h-9 px-4 rounded-xl border border-[#E8E8E8] hover:bg-[#F7F5FA] text-sm font-semibold flex items-center gap-2 transition">
              <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              Export CSV
            </button>
          </div>
        </div>
        <div className="grid grid-cols-[2fr_1fr_1fr_1.5fr_100px] bg-[#F7F5FA]">
          {["Action","Admin","IP Address","Date & Time","Status"].map((h) => (
            <div key={h} className="px-5 py-3 text-xs font-extrabold uppercase tracking-wider text-slate-500">{h}</div>
          ))}
        </div>
        {filtered.map((row, i) => (
          <div key={i} className={`grid grid-cols-[2fr_1fr_1fr_1.5fr_100px] items-center ${i < filtered.length - 1 ? "border-b border-[#F5F5F5]" : ""}`}>
            <div className="px-5 py-4">
              <p className="text-sm font-bold text-[#1A1C1C]">{row.action}</p>
              <p className="text-xs text-slate-400 mt-0.5">{row.detail}</p>
            </div>
            <div className="px-5 py-4 text-sm font-semibold text-[#1A1C1C]">{row.admin}</div>
            <div className="px-5 py-4 text-sm font-mono text-[#4B4355]">{row.ip}</div>
            <div className="px-5 py-4 text-xs text-[#4B4355]">{row.date}</div>
            <div className="px-5 py-4">
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${row.status === "Success" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${row.status === "Success" ? "bg-green-500" : "bg-red-500"}`} />
                {row.status}
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="flex justify-end">
        <button onClick={onSave} className="h-11 px-8 rounded-xl bg-[#D2A500] hover:bg-[#b89300] text-white font-bold text-sm transition shadow-md">
          Save Changes
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────
// STUB TAB
// ─────────────────────────────────────

function StubTab({ title, description }: { title: string; description: string }) {
  return (
    <div className="bg-white rounded-2xl border border-[#ECE7F2] shadow-sm p-12 flex flex-col items-center justify-center text-center min-h-[320px]">
      <div className="w-14 h-14 rounded-2xl bg-[#F3EEFF] flex items-center justify-center mb-4">
        <Settings className="w-7 h-7 text-[#7004DC]" />
      </div>
      <h3 className="text-xl font-extrabold text-[#1A1C1C]">{title}</h3>
      <p className="text-sm text-[#4B4355]/70 mt-2 max-w-sm">{description}</p>
      <button className="mt-6 h-10 px-6 rounded-xl bg-[#7004DC]/10 text-[#7004DC] font-bold text-sm hover:bg-[#7004DC]/20 transition">
        Configure
      </button>
    </div>
  );
}

// ─────────────────────────────────────
// SHARED ATOMS
// ─────────────────────────────────────

function NotiCheck({
  label, checked, onChange, urgent,
}: {
  label: string; checked: boolean; onChange: () => void; urgent?: boolean;
}) {
  return (
    <button onClick={onChange} className="flex items-center gap-3 w-full text-left">
      <div className={`w-5 h-5 rounded-md flex-shrink-0 flex items-center justify-center transition-all ${
        checked ? "bg-[#7004DC]" : "border-2 border-slate-200 bg-white"
      }`}>
        {checked && <Check className="w-3 h-3 text-white" />}
      </div>
      <span className="text-sm font-semibold text-[#1A1C1C] flex-1">{label}</span>
      {urgent && (
        <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-600 text-[10px] font-extrabold uppercase tracking-wider">
          Urgent
        </span>
      )}
    </button>
  );
}

function Toggle({
  value, onChange, small,
}: {
  value: boolean; onChange: (v: boolean) => void; small?: boolean;
}) {
  const w = small ? "w-9" : "w-11";
  const h = small ? "h-5" : "h-6";
  const dot = small ? "w-3.5 h-3.5" : "w-4 h-4";
  const on  = small ? "left-[18px]" : "left-6";
  return (
    <button
      onClick={() => onChange(!value)}
      className={`${w} ${h} rounded-full relative transition-colors duration-200 flex-shrink-0 ${value ? "bg-[#7004DC]" : "bg-slate-200"}`}
    >
      <div className={`absolute top-[3px] ${dot} rounded-full bg-white shadow transition-all duration-200 ${value ? on : "left-[3px]"}`} />
    </button>
  );
}

function IconInput({ label, icon, defaultValue }: { label: string; icon: React.ReactNode; defaultValue: string }) {
  return (
    <div>
      <label className="text-xs font-extrabold uppercase tracking-[0.15em] text-slate-500">{label}</label>
      <div className="relative mt-2">
        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">{icon}</div>
        <input defaultValue={defaultValue}
          className="w-full h-12 bg-[#F7F5FA] rounded-xl pl-10 pr-4 text-[#1A1C1C] border border-transparent focus:border-[#8A38F5]/30 focus:ring-2 focus:ring-[#8A38F5]/10 outline-none transition-all text-sm font-semibold" />
      </div>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <div className="px-6 py-3.5 text-xs font-extrabold uppercase tracking-[0.15em] text-slate-500">{children}</div>;
}

function Td({ children, mono }: { children: React.ReactNode; mono?: boolean }) {
  return (
    <div className={`px-6 py-5 text-sm ${mono ? "font-mono text-[#1A1C1C]" : "font-semibold text-[#1A1C1C]"}`}>
      {children}
    </div>
  );
}

function SmallSection({ title, icon, items }: { title: string; icon: string; items: { title: string; subtitle: string }[] }) {
  return (
    <div className="bg-white rounded-2xl border border-[#ECE7F2] shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-6 py-5 border-b border-[#F0F0F0]">
        <h3 className="text-lg font-extrabold text-[#1A1C1C]">{title}</h3>
        <button className="flex items-center gap-1 text-[#D2A500] hover:text-[#b89300] font-bold text-sm transition">
          <span className="text-lg leading-none">{icon}</span> Add
        </button>
      </div>
      <div className="p-4 space-y-3">
        {items.map((item, i) => (
          <div key={i} className="bg-[#F7F5FA] rounded-xl px-4 py-3.5 flex items-center justify-between">
            <div>
              <p className="font-bold text-[#1A1C1C] text-sm">{item.title}</p>
              <p className="text-xs text-[#4B4355]/60 mt-0.5">{item.subtitle}</p>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-300" />
          </div>
        ))}
      </div>
    </div>
  );
}

function ResourceSection({ title, items }: { title: string; items: { icon: string; title: string; subtitle: string }[] }) {
  return (
    <div className="bg-white rounded-2xl border border-[#ECE7F2] shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-6 py-5 border-b border-[#F0F0F0]">
        <h3 className="text-lg font-extrabold text-[#1A1C1C]">{title}</h3>
        <button className="flex items-center gap-1 text-[#D2A500] hover:text-[#b89300] font-bold text-sm transition">
          <Plus className="w-4 h-4" /> Add
        </button>
      </div>
      <div className="p-4 space-y-3">
        {items.map((item, i) => (
          <div key={i} className="bg-[#F7F5FA] rounded-xl px-4 py-3.5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-[#7004DC]/10 flex items-center justify-center text-lg">{item.icon}</div>
              <div>
                <p className="font-bold text-[#1A1C1C] text-sm">{item.title}</p>
                <p className="text-xs text-[#4B4355]/60 mt-0.5">{item.subtitle}</p>
              </div>
            </div>
            <X className="w-4 h-4 text-slate-300 hover:text-red-400 cursor-pointer transition" />
          </div>
        ))}
      </div>
    </div>
  );
}
