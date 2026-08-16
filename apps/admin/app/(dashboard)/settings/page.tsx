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
  Briefcase,
  Activity,
  Calendar as CalendarIcon,
  Lock,
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
  { label: "General", icon: <Settings className="w-4 h-4" /> },
  { label: "User Roles", icon: <Users className="w-4 h-4" /> },
  { label: "Master Data", icon: <Database className="w-4 h-4" /> },
  { label: "Notifications", icon: <Bell className="w-4 h-4" /> },
  { label: "Security", icon: <Shield className="w-4 h-4" /> },
  { label: "Appearance", icon: <Palette className="w-4 h-4" /> },
];



const AUDIT_LOG = [
  { action: "Password Policy Updated", detail: "Changed min length to 12", admin: "Alex Rivers", ip: "192.168.1.1", date: "Oct 24, 2023 14:22:10 GMT", status: "Success" },
  { action: "Failed Login Attempt", detail: "3 consecutive failures", admin: "System-wide", ip: "45.22.190.11", date: "Oct 24, 2023 12:05:44 GMT", status: "Blocked" },
  { action: "New Admin Invited", detail: "Sarah Mitchell (Editor)", admin: "Alex Rivers", ip: "192.168.1.1", date: "Oct 23, 2023 09:12:01 GMT", status: "Success" },
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
                      className={`w-full h-12 rounded-xl px-4 flex items-center justify-between transition-all ${active
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
            {activeTab === "General" && <GeneralTab onSave={handleSave} />}
            {activeTab === "Master Data" && <MasterDataTab />}
            {activeTab === "Notifications" && <NotificationsTab onSave={handleSave} />}
            {activeTab === "Security" && <SecurityTab onSave={handleSave} />}
            {activeTab === "User Roles" && <StubTab title="User Roles" description="Configure admin roles and permissions for the platform." />}
            {activeTab === "Appearance" && <StubTab title="Appearance" description="Customise the look and feel of the admin portal." />}
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
  const [platformName, setPlatformName] = useState("DigiAbility Admin Portal");
  const [supportPhone, setSupportPhone] = useState("+91 88000 12345");
  const [emailConfig, setEmailConfig] = useState("admin@digiability.org");
  const [maintenance, setMaintenance] = useState(false);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");


  useEffect(() => {
    let isMounted = true;
    async function load() {
      try {
        setLoading(true);
        setErrorMsg("");
        const res = await fetch("/api/settings/general");
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.settings && isMounted) {
            setPlatformName(data.settings.platformName || "DigiAbility Admin Portal");
            setSupportPhone(data.settings.supportPhone || "+91 88000 12345");
            setEmailConfig(data.settings.emailConfig || "admin@digiability.org");
            setMaintenance(Boolean(data.settings.maintenanceMode));
          }
        }
      } catch (err) {
        console.error("Failed to load general settings:", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    load();
    return () => {
      isMounted = false;
    };
  }, []);


  const handleSave = async () => {
    setSaving(true);
    setErrorMsg("");
    try {
      const res = await fetch("/api/settings/general", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platformName,
          supportPhone,
          emailConfig,
          maintenanceMode: maintenance,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        onSave();
      } else {
        setErrorMsg(data.message || "Failed to save settings");
      }
    } catch {
      setErrorMsg("Network error while saving settings");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-[28px] border border-[#ECE7F2] shadow-sm p-8">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-extrabold text-[#1A1C1C]">General Settings</h2>
            <p className="text-sm text-[#4B4355]/70 mt-1">
              Update your platform identification and accessibility preferences
            </p>
          </div>
          {loading && (
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-400">
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#7004DC]" />
              Loading...
            </div>
          )}
        </div>

        {errorMsg && (
          <div className="mt-4 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm font-semibold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {errorMsg}
          </div>
        )}

        <div className="mt-4 p-4 rounded-2xl bg-violet-50/70 border border-violet-100 flex items-start gap-3">
          <div className="w-8 h-8 rounded-xl bg-[#7004DC] text-white flex items-center justify-center shrink-0 mt-0.5 text-xs font-bold">
            ℹ️
          </div>
          <div>
            <p className="text-xs font-bold text-[#1A1C1C]">Support &amp; Helpline Configuration</p>
            <p className="text-xs text-[#4B4355] mt-0.5 leading-relaxed">
              Updates to the <strong>Support Phone</strong> and <strong>Email Configuration</strong> will automatically publish to all user-facing contact and help screens. Dedicated OTP &amp; SMS authentication services remain isolated and will not be affected.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
          <IconInput
            label="Platform Name"
            icon={<Monitor className="w-4 h-4" />}
            value={platformName}
            disabled={true}
            badge="Fixed System Identifier"
            badgeVariant="locked"
            helperText="Platform identifier is fixed for system reference and cannot be altered."
          />
          <IconInput
            label="Support Phone"
            icon={<Phone className="w-4 h-4" />}
            value={supportPhone}
            onChange={setSupportPhone}
            badge="Public Helpline"
            badgeVariant="active"
            helperText="Configures the primary support helpline dialer across mobile and web."
          />
          <div className="md:col-span-2">
            <IconInput
              label="Email Configuration"
              icon={<Mail className="w-4 h-4" />}
              value={emailConfig}
              onChange={setEmailConfig}
              badge="Public Support Inbox"
              badgeVariant="active"
              helperText="Configures the primary user support and query inbox across the platform. (OTP systems remain unaffected)."
            />
          </div>
        </div>

        {/* MAINTENANCE MODE */}
        <div className={`mt-6 border rounded-2xl p-5 flex items-center justify-between transition-colors ${maintenance ? "bg-amber-50/70 border-amber-200" : "border-[#E8E8E8]"
          }`}>
          <div>
            <div className="flex items-center gap-2">
              <p className="font-bold text-[#1A1C1C]">Maintenance Mode</p>
              {maintenance && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-amber-200 text-amber-900">
                  Active
                </span>
              )}
            </div>
            <p className="text-sm text-[#4B4355]/70 mt-0.5">
              Prevent users from accessing the platform during updates.
            </p>
          </div>
          <Toggle value={maintenance} onChange={setMaintenance} />
        </div>

        {/* LANGUAGES */}
        {/*<div className="mt-8 pt-8 border-t border-[#E8E8E8]">
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
                  <div
                    className={`w-5 h-5 rounded-md flex items-center justify-center transition-all ${
                      active ? "bg-[#7004DC]" : "border-2 border-slate-300 bg-white"
                    }`}
                  >
                    {active && <Check className="w-3 h-3 text-white" />}
                  </div>
                  {l}
                </button>
              );
            })}
          </div>
        </div>*/}
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
          onClick={handleSave}
          disabled={saving}
          className="h-11 px-8 rounded-xl bg-[#D2A500] hover:bg-[#b89300] disabled:opacity-60 text-white font-bold text-sm transition shadow-md flex items-center gap-2"
        >
          {saving && <RefreshCw className="w-4 h-4 animate-spin" />}
          {saving ? "Saving..." : "Save Changes"}
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────
// MASTER DATA TAB  (real DB with Drilldown UI)
// ─────────────────────────────────────

type MasterCategoryKey = "disabilities" | "events" | "services";

function MasterDataTab() {
  const [activeMasterCat, setActiveMasterCat] = useState<MasterCategoryKey>("disabilities");

  // ──────────────────────────────────────────
  // DISABILITY TYPES STATE & HANDLERS
  // ──────────────────────────────────────────
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
        setTypes(data.types || []);
      } else {
        setFetchError(data.message || "Failed to load types");
      }
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : "Network error");
    } finally {
      setLoading(false);
    }
  };

  // ──────────────────────────────────────────
  // EVENT CATEGORIES STATE & HANDLERS
  // ──────────────────────────────────────────
  const [eventCats, setEventCats] = useState<{ id: string; name: string; status: "Active" | "Inactive" }[]>([]);
  const [catsLoading, setCatsLoading] = useState(false);
  const [catError, setCatError] = useState("");
  const [showAddCat, setShowAddCat] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [editCatId, setEditCatId] = useState<string | null>(null);
  const [editCatName, setEditCatName] = useState("");
  const [catSaving, setCatSaving] = useState(false);

  const loadEventCategories = async () => {
    setCatsLoading(true);
    setCatError("");
    try {
      const res = await fetch("/api/settings/event-categories");
      const data = await res.json();
      if (data.success) {
        setEventCats(data.categories || []);
      } else {
        setCatError(data.message || "Failed to load categories");
      }
    } catch {
      setCatError("Network error");
    } finally {
      setCatsLoading(false);
    }
  };

  // ──────────────────────────────────────────
  // SERVICE CATEGORIES STATE & HANDLERS
  // ──────────────────────────────────────────
  const [serviceCats, setServiceCats] = useState<{ id: string; name: string; status: "Active" | "Inactive" }[]>([]);
  const [serviceCatsLoading, setServiceCatsLoading] = useState(false);
  const [serviceCatError, setServiceCatError] = useState("");
  const [showAddServiceCat, setShowAddServiceCat] = useState(false);
  const [newServiceCatName, setNewServiceCatName] = useState("");
  const [editServiceCatId, setEditServiceCatId] = useState<string | null>(null);
  const [editServiceCatName, setEditServiceCatName] = useState("");
  const [serviceCatSaving, setServiceCatSaving] = useState(false);

  const loadServiceCategories = async () => {
    setServiceCatsLoading(true);
    setServiceCatError("");
    try {
      const res = await fetch("/api/settings/service-categories");
      const data = await res.json();
      if (data.success) {
        setServiceCats(data.categories || []);
      } else {
        setServiceCatError(data.message || "Failed to load service categories");
      }
    } catch {
      setServiceCatError("Network error");
    } finally {
      setServiceCatsLoading(false);
    }
  };

  useEffect(() => {
    loadTypes();
    loadEventCategories();
    loadServiceCategories();
  }, []);

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

  // Event category handlers
  const addEventCategory = async () => {
    if (!newCatName.trim() || catSaving) return;
    setCatSaving(true);
    try {
      const res = await fetch("/api/settings/event-categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newCatName.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        setEventCats((prev) => [...prev, data.category]);
        setNewCatName("");
        setShowAddCat(false);
      }
    } finally {
      setCatSaving(false);
    }
  };

  const saveEditCategory = async (id: string) => {
    if (!editCatName.trim() || catSaving) return;
    setCatSaving(true);
    try {
      const res = await fetch("/api/settings/event-categories", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, name: editCatName.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        setEventCats((prev) => prev.map((c) => (c.id === id ? data.category : c)));
        setEditCatId(null);
      }
    } finally {
      setCatSaving(false);
    }
  };

  const toggleCategoryStatus = async (cat: { id: string; name: string; status: "Active" | "Inactive" }) => {
    const newStatus = cat.status === "Active" ? "Inactive" : "Active";
    const res = await fetch("/api/settings/event-categories", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: cat.id, status: newStatus }),
    });
    const data = await res.json();
    if (data.success) {
      setEventCats((prev) => prev.map((c) => (c.id === cat.id ? data.category : c)));
    }
  };

  const deleteEventCategory = async (id: string) => {
    await fetch(`/api/settings/event-categories?id=${id}`, { method: "DELETE" });
    setEventCats((prev) => prev.filter((c) => c.id !== id));
  };

  // Service category handlers
  const addServiceCategory = async () => {
    if (!newServiceCatName.trim() || serviceCatSaving) return;
    setServiceCatSaving(true);
    try {
      const res = await fetch("/api/settings/service-categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newServiceCatName.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        setServiceCats((prev) => [...prev, data.category]);
        setNewServiceCatName("");
        setShowAddServiceCat(false);
      }
    } finally {
      setServiceCatSaving(false);
    }
  };

  const saveEditServiceCategory = async (id: string) => {
    if (!editServiceCatName.trim() || serviceCatSaving) return;
    setServiceCatSaving(true);
    try {
      const res = await fetch("/api/settings/service-categories", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, name: editServiceCatName.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        setServiceCats((prev) => prev.map((c) => (c.id === id ? data.category : c)));
        setEditServiceCatId(null);
      }
    } finally {
      setServiceCatSaving(false);
    }
  };

  const toggleServiceCategoryStatus = async (cat: { id: string; name: string; status: "Active" | "Inactive" }) => {
    const newStatus = cat.status === "Active" ? "Inactive" : "Active";
    const res = await fetch("/api/settings/service-categories", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: cat.id, status: newStatus }),
    });
    const data = await res.json();
    if (data.success) {
      setServiceCats((prev) => prev.map((c) => (c.id === cat.id ? data.category : c)));
    }
  };

  const deleteServiceCategory = async (id: string) => {
    await fetch(`/api/settings/service-categories?id=${id}`, { method: "DELETE" });
    setServiceCats((prev) => prev.filter((c) => c.id !== id));
  };

  const MASTER_DOMAINS: {
    key: MasterCategoryKey;
    title: string;
    description: string;
    count: number;
    icon: React.ReactNode;
  }[] = [
    {
      key: "disabilities",
      title: "Disability Types",
      description: "Recognised classifications for user profiles & accessibility support",
      count: types.length,
      icon: <Users className="w-5 h-5" />,
    },
    {
      key: "events",
      title: "Event Categories",
      description: "Tags and genres for community workshops, webinars & camps",
      count: eventCats.length,
      icon: <CalendarIcon className="w-5 h-5" />,
    },
    {
      key: "services",
      title: "Service Categories",
      description: "Classifications for verified therapists, vendors & care providers",
      count: serviceCats.length,
      icon: <Briefcase className="w-5 h-5" />,
    },
  ];

  return (
    <div className="space-y-6">
      {/* ── STEP 1: MAIN CATEGORIES DIRECTORY (SELECTION CARDS) ── */}
      <div>
        <h2 className="text-xl font-extrabold text-[#1A1C1C] mb-1">Master Data Categories</h2>
        <p className="text-xs text-[#7D7387] mb-4">
          Select a master data domain below to view, edit, and configure its underlying classification options.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {MASTER_DOMAINS.map((domain) => {
            const isSelected = activeMasterCat === domain.key;
            return (
              <button
                key={domain.key}
                type="button"
                onClick={() => setActiveMasterCat(domain.key)}
                className={`text-left p-5 rounded-2xl border-2 transition-all relative overflow-hidden flex flex-col justify-between ${
                  isSelected
                    ? "bg-white border-[#7004DC] shadow-md ring-4 ring-[#7004DC]/10"
                    : "bg-white border-[#ECE7F2] hover:border-violet-300 hover:shadow-sm"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center transition ${
                        isSelected ? "bg-[#7004DC] text-white" : "bg-violet-50 text-[#7004DC]"
                      }`}
                    >
                      {domain.icon}
                    </div>
                    <span
                      className={`text-xs font-extrabold px-2.5 py-1 rounded-full ${
                        isSelected
                          ? "bg-[#F3EEFF] text-[#7004DC] border border-[#E9D9FF]"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {domain.count} Options
                    </span>
                  </div>
                  <h3 className="font-extrabold text-base text-[#1A1C1C] mb-1">{domain.title}</h3>
                  <p className="text-xs text-[#7D7387] line-clamp-2 leading-relaxed">{domain.description}</p>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-bold">
                  <span className={isSelected ? "text-[#7004DC]" : "text-slate-400"}>
                    {isSelected ? "● Active Field Selected" : "Click to view options"}
                  </span>
                  <ChevronRight className={`w-4 h-4 ${isSelected ? "text-[#7004DC]" : "text-slate-300"}`} />
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── STEP 2: DRILLDOWN OPTIONS TABLE FOR SELECTED FIELD ── */}

      {/* 1. DISABILITY TYPES */}
      {activeMasterCat === "disabilities" && (
        <div className="bg-white rounded-2xl border border-[#ECE7F2] shadow-sm overflow-hidden animate-fadeIn">
          <div className="flex items-center justify-between px-8 py-6 border-b border-[#E8E8E8] bg-slate-50/50">
            <div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#7004DC]" />
                <h3 className="text-lg font-extrabold text-[#1A1C1C]">Disability Types Options</h3>
              </div>
              <p className="text-xs text-[#4B4355]/70 mt-1">
                Master list of recognised disabilities for profiling. Changes apply to all user profile dropdowns.
              </p>
            </div>
            <button
              onClick={() => setShowAdd(true)}
              className="h-10 px-5 rounded-xl bg-[#7004DC] hover:bg-[#5c03b7] transition flex items-center gap-2 font-bold text-white text-sm shadow-sm"
            >
              <Plus className="w-4 h-4" /> Add Option
            </button>
          </div>

          <div className="grid grid-cols-[140px_1fr_160px_140px] bg-[#F7F5FA]">
            <Th>CODE / ID</Th><Th>Option Name</Th><Th>Status</Th><Th>Actions</Th>
          </div>

          {loading ? (
            <div className="px-8 py-8 text-sm text-slate-400 flex items-center gap-2">
              <svg className="w-4 h-4 animate-spin text-[#7004DC]" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              Loading from database…
            </div>
          ) : fetchError ? (
            <div className="px-8 py-8 flex items-center gap-3">
              <span className="text-sm text-red-500 font-semibold">Error: {fetchError}</span>
              <button onClick={loadTypes} className="text-sm text-[#7004DC] font-bold hover:underline">Retry</button>
            </div>
          ) : types.length === 0 ? (
            <div className="px-8 py-12 text-center text-slate-400 text-sm">
              No disability types configured yet. Click "+ Add Option" to create one.
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
                    <span className="font-bold text-sm text-[#1A1C1C]">{t.name}</span>
                  )}
                </Td>
                <Td>
                  <button
                    onClick={() => toggleStatus(t)}
                    className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold transition ${t.status === "Active"
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
                    title="Edit option"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => deleteType(t.id)}
                    className="w-8 h-8 rounded-lg hover:bg-red-50 flex items-center justify-center text-red-500 transition"
                    title="Delete option"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}

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
      )}

      {/* 2. EVENT CATEGORIES */}
      {activeMasterCat === "events" && (
        <div className="bg-white rounded-2xl border border-[#ECE7F2] shadow-sm overflow-hidden animate-fadeIn">
          <div className="flex items-center justify-between px-8 py-6 border-b border-[#E8E8E8] bg-slate-50/50">
            <div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#7004DC]" />
                <h3 className="text-lg font-extrabold text-[#1A1C1C]">Event Categories Options</h3>
              </div>
              <p className="text-xs text-[#4B4355]/70 mt-1">
                Master classifications for community events and workshops. Filter and creation options dynamically sync from here.
              </p>
            </div>
            <button
              onClick={() => setShowAddCat(true)}
              className="h-10 px-5 rounded-xl bg-[#7004DC] hover:bg-[#5c03b7] transition flex items-center gap-2 font-bold text-white text-sm shadow-sm"
            >
              <Plus className="w-4 h-4" /> Add Option
            </button>
          </div>

          <div className="grid grid-cols-[140px_1fr_160px_140px] bg-[#F7F5FA]">
            <Th>CATEGORY ID</Th><Th>Category Name</Th><Th>Status</Th><Th>Actions</Th>
          </div>

          {catsLoading && eventCats.length === 0 ? (
            <div className="px-8 py-8 text-sm text-slate-400 flex items-center gap-2">
              <svg className="w-4 h-4 animate-spin text-[#7004DC]" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              Loading categories from database…
            </div>
          ) : catError ? (
            <div className="px-8 py-8 flex items-center gap-3">
              <span className="text-sm text-red-500 font-semibold">Error: {catError}</span>
              <button onClick={loadEventCategories} className="text-sm text-[#7004DC] font-bold hover:underline">Retry</button>
            </div>
          ) : eventCats.length === 0 ? (
            <div className="px-8 py-12 text-center text-slate-400 text-sm">
              No event categories configured yet. Click "+ Add Option" to create one.
            </div>
          ) : (
            eventCats.map((cat, i) => (
              <div
                key={cat.id}
                className={`grid grid-cols-[140px_1fr_160px_140px] items-center ${i < eventCats.length - 1 ? "border-b border-[#F0F0F0]" : ""}`}
              >
                <Td mono>{cat.id.slice(0, 8)}...</Td>
                <Td>
                  {editCatId === cat.id ? (
                    <div className="flex items-center gap-2">
                      <input
                        autoFocus
                        value={editCatName}
                        onChange={(e) => setEditCatName(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && saveEditCategory(cat.id)}
                        className="flex-1 h-8 bg-[#F7F5FA] rounded-lg px-3 text-sm border border-[#8A38F5]/30 outline-none"
                      />
                      <button onClick={() => saveEditCategory(cat.id)} disabled={catSaving} className="w-7 h-7 rounded-lg bg-[#7004DC] flex items-center justify-center">
                        <Check className="w-3.5 h-3.5 text-white" />
                      </button>
                      <button onClick={() => setEditCatId(null)} className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center">
                        <X className="w-3.5 h-3.5 text-slate-500" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-[#7004DC]" />
                      <span className="font-bold text-sm text-[#1A1C1C]">{cat.name}</span>
                    </div>
                  )}
                </Td>
                <Td>
                  <button
                    onClick={() => toggleCategoryStatus(cat)}
                    className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold transition ${cat.status === "Active"
                      ? "bg-green-100 text-green-700 hover:bg-green-200"
                      : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                      }`}
                  >
                    {cat.status}
                  </button>
                </Td>
                <div className="px-6 flex items-center gap-2">
                  <button
                    onClick={() => { setEditCatId(cat.id); setEditCatName(cat.name); }}
                    className="w-8 h-8 rounded-lg hover:bg-violet-50 flex items-center justify-center text-[#7004DC] transition"
                    title="Edit option"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => deleteEventCategory(cat.id)}
                    className="w-8 h-8 rounded-lg hover:bg-red-50 flex items-center justify-center text-red-500 transition"
                    title="Delete option"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}

          {showAddCat && (
            <div className="grid grid-cols-[140px_1fr_160px_140px] items-center border-t border-[#E8E8E8] bg-[#FAFAFA]">
              <div className="px-6 py-4 text-sm font-mono text-slate-400">AUTO</div>
              <div className="px-4 py-4">
                <input
                  autoFocus
                  placeholder="New category name (e.g. Assistive Tech, Sports, Arts)..."
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addEventCategory()}
                  className="w-full h-9 bg-[#F7F5FA] rounded-lg px-3 text-sm border border-[#8A38F5]/30 outline-none"
                />
              </div>
              <div className="px-4 py-4">
                <span className="inline-flex px-3 py-1 rounded-full text-xs font-bold bg-green-100 text-green-700">Active</span>
              </div>
              <div className="px-6 py-4 flex items-center gap-2">
                <button onClick={addEventCategory} disabled={catSaving} className="h-8 px-3 rounded-lg bg-[#7004DC] text-white text-xs font-bold hover:bg-[#5a03b0] transition">
                  {catSaving ? "…" : "Add"}
                </button>
                <button onClick={() => setShowAddCat(false)} className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center">
                  <X className="w-3.5 h-3.5 text-slate-500" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 3. SERVICE CATEGORIES */}
      {activeMasterCat === "services" && (
        <div className="bg-white rounded-2xl border border-[#ECE7F2] shadow-sm overflow-hidden animate-fadeIn">
          <div className="flex items-center justify-between px-8 py-6 border-b border-[#E8E8E8] bg-slate-50/50">
            <div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#7004DC]" />
                <h3 className="text-lg font-extrabold text-[#1A1C1C]">Service Categories Options</h3>
              </div>
              <p className="text-xs text-[#4B4355]/70 mt-1">
                Master classifications for professional services, therapists, and equipment vendors. Automatically synced with mobile app tabs.
              </p>
            </div>
            <button
              onClick={() => setShowAddServiceCat(true)}
              className="h-10 px-5 rounded-xl bg-[#7004DC] hover:bg-[#5c03b7] transition flex items-center gap-2 font-bold text-white text-sm shadow-sm"
            >
              <Plus className="w-4 h-4" /> Add Option
            </button>
          </div>

          <div className="grid grid-cols-[140px_1fr_160px_140px] bg-[#F7F5FA]">
            <Th>CATEGORY ID</Th><Th>Category Name</Th><Th>Status</Th><Th>Actions</Th>
          </div>

          {serviceCatsLoading && serviceCats.length === 0 ? (
            <div className="px-8 py-8 text-sm text-slate-400 flex items-center gap-2">
              <svg className="w-4 h-4 animate-spin text-[#7004DC]" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              Loading service categories from database…
            </div>
          ) : serviceCatError ? (
            <div className="px-8 py-8 flex items-center gap-3">
              <span className="text-sm text-red-500 font-semibold">Error: {serviceCatError}</span>
              <button onClick={loadServiceCategories} className="text-sm text-[#7004DC] font-bold hover:underline">Retry</button>
            </div>
          ) : serviceCats.length === 0 ? (
            <div className="px-8 py-12 text-center text-slate-400 text-sm">
              No service categories configured yet. Click "+ Add Option" to create one.
            </div>
          ) : (
            serviceCats.map((cat, i) => (
              <div
                key={cat.id}
                className={`grid grid-cols-[140px_1fr_160px_140px] items-center ${i < serviceCats.length - 1 ? "border-b border-[#F0F0F0]" : ""}`}
              >
                <Td mono>{cat.id.slice(0, 8)}...</Td>
                <Td>
                  {editServiceCatId === cat.id ? (
                    <div className="flex items-center gap-2">
                      <input
                        autoFocus
                        value={editServiceCatName}
                        onChange={(e) => setEditServiceCatName(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && saveEditServiceCategory(cat.id)}
                        className="flex-1 h-8 bg-[#F7F5FA] rounded-lg px-3 text-sm border border-[#8A38F5]/30 outline-none"
                      />
                      <button onClick={() => saveEditServiceCategory(cat.id)} disabled={serviceCatSaving} className="w-7 h-7 rounded-lg bg-[#7004DC] flex items-center justify-center">
                        <Check className="w-3.5 h-3.5 text-white" />
                      </button>
                      <button onClick={() => setEditServiceCatId(null)} className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center">
                        <X className="w-3.5 h-3.5 text-slate-500" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-[#7004DC]" />
                      <span className="font-bold text-sm text-[#1A1C1C]">{cat.name}</span>
                    </div>
                  )}
                </Td>
                <Td>
                  <button
                    onClick={() => toggleServiceCategoryStatus(cat)}
                    className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold transition ${cat.status === "Active"
                      ? "bg-green-100 text-green-700 hover:bg-green-200"
                      : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                      }`}
                  >
                    {cat.status}
                  </button>
                </Td>
                <div className="px-6 flex items-center gap-2">
                  <button
                    onClick={() => { setEditServiceCatId(cat.id); setEditServiceCatName(cat.name); }}
                    className="w-8 h-8 rounded-lg hover:bg-violet-50 flex items-center justify-center text-[#7004DC] transition"
                    title="Edit option"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => deleteServiceCategory(cat.id)}
                    className="w-8 h-8 rounded-lg hover:bg-red-50 flex items-center justify-center text-red-500 transition"
                    title="Delete option"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}

          {showAddServiceCat && (
            <div className="grid grid-cols-[140px_1fr_160px_140px] items-center border-t border-[#E8E8E8] bg-[#FAFAFA]">
              <div className="px-6 py-4 text-sm font-mono text-slate-400">AUTO</div>
              <div className="px-4 py-4">
                <input
                  autoFocus
                  placeholder="New service category (e.g. Speech Therapy, Audiology)..."
                  value={newServiceCatName}
                  onChange={(e) => setNewServiceCatName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addServiceCategory()}
                  className="w-full h-9 bg-[#F7F5FA] rounded-lg px-3 text-sm border border-[#8A38F5]/30 outline-none"
                />
              </div>
              <div className="px-4 py-4">
                <span className="inline-flex px-3 py-1 rounded-full text-xs font-bold bg-green-100 text-green-700">Active</span>
              </div>
              <div className="px-6 py-4 flex items-center gap-2">
                <button onClick={addServiceCategory} disabled={serviceCatSaving} className="h-8 px-3 rounded-lg bg-[#7004DC] text-white text-xs font-bold hover:bg-[#5a03b0] transition">
                  {serviceCatSaving ? "…" : "Add"}
                </button>
                <button onClick={() => setShowAddServiceCat(false)} className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center">
                  <X className="w-3.5 h-3.5 text-slate-500" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────
// NOTIFICATIONS TAB  (matching Figma)
// ─────────────────────────────────────

function NotificationsTab({ onSave }: { onSave: () => void }) {
  // Email
  const [email, setEmail] = useState({
    newUsers: true,
    contentReports: true,
    failedTx: true,
    sysErrors: true,
    weeklyDigest: true,
  });
  // SMS
  const [phone, setPhone] = useState("+91 98765 43210");
  const [sms, setSms] = useState({ critical: true, daily: true, promo: false });
  // Push
  const [pushEnabled, setPushEnabled] = useState(true);
  const [push, setPush] = useState({
    modQueue: true,
    milestones: true,
    community: true,
    sysAlerts: true,
  });
  // Frequency
  const [freq, setFreq] = useState<"realtime" | "daily" | "weekly" | "none">("realtime");
  // Quiet hours
  const [quietStart, setQuietStart] = useState("20:00");
  const [quietEnd, setQuietEnd] = useState("08:00");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let isMounted = true;
    async function load() {
      try {
        setLoading(true);
        const res = await fetch("/api/settings/notifications");
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.settings && isMounted) {
            const s = data.settings;
            setEmail({
              newUsers: s.email_new_users ?? true,
              contentReports: s.email_content_reports ?? true,
              failedTx: s.email_failed_transactions ?? true,
              sysErrors: s.email_system_errors ?? true,
              weeklyDigest: s.email_weekly_digest ?? true,
            });
            setPushEnabled(s.push_enabled ?? true);
            setPush({
              modQueue: s.push_moderation_queue ?? true,
              milestones: s.push_user_milestones ?? true,
              community: s.push_community_highlights ?? true,
              sysAlerts: s.push_system_maintenance ?? true,
            });
            setPhone(s.phone_number || "+91 98765 43210");
            setSms({
              critical: s.sms_critical_only ?? true,
              daily: s.sms_daily_summary ?? true,
              promo: s.sms_promotional ?? false,
            });
            const f = (s.frequency || "").toLowerCase();
            if (f.includes("real")) setFreq("realtime");
            else if (f.includes("daily")) setFreq("daily");
            else if (f.includes("weekly")) setFreq("weekly");
            else if (f.includes("none")) setFreq("none");
            setQuietStart(s.quiet_start || "20:00");
            setQuietEnd(s.quiet_end || "08:00");
          }
        }
      } catch (err) {
        console.error("Failed to load notification settings:", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    load();
    return () => {
      isMounted = false;
    };
  }, []);

  const toggleEmail = (k: keyof typeof email) => setEmail((p) => ({ ...p, [k]: !p[k] }));
  const toggleSms = (k: keyof typeof sms) => setSms((p) => ({ ...p, [k]: !p[k] }));
  const togglePush = (k: keyof typeof push) => setPush((p) => ({ ...p, [k]: !p[k] }));

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/settings/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          emailNewUsers: email.newUsers,
          emailContentReports: email.contentReports,
          emailFailedTransactions: email.failedTx,
          emailSystemErrors: email.sysErrors,
          emailWeeklyDigest: email.weeklyDigest,
          pushEnabled,
          pushModerationQueue: push.modQueue,
          pushUserMilestones: push.milestones,
          pushCommunityHighlights: push.community,
          pushSystemMaintenance: push.sysAlerts,
          smsCriticalOnly: sms.critical,
          smsDailySummary: sms.daily,
          smsPromotional: sms.promo,
          phoneNumber: phone,
          frequency: freq === "realtime" ? "Real-time" : freq === "daily" ? "Daily digest" : freq === "weekly" ? "Weekly digest" : "None",
          quietStart,
          quietEnd,
        }),
      });
      if (res.ok) {
        onSave();
      }
    } catch (err) {
      console.error("Failed to save notification settings:", err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-extrabold text-[#1A1C1C]">Notification Settings</h2>
          <p className="text-sm text-[#4B4355]/70 mt-1">
            Configure how you receive alerts and notifications across all channels to keep your team
            informed and your community safe.
          </p>
        </div>
        {loading && (
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-400">
            <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#7004DC]" />
            Loading...
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6">
        {/* LEFT COLUMN */}
        <div className="space-y-5">
          {/* PUSH NOTIFICATIONS (LIVE & ACTIVE) */}
          <div className="bg-white rounded-2xl border border-emerald-200/80 shadow-sm p-6 relative">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center">
                  <Smartphone className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-extrabold text-[#1A1C1C]">Push Notifications</h3>
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[11px] font-extrabold">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      Active / Live
                    </span>
                  </div>
                  <p className="text-xs text-[#4B4355]/60">Real-time alerts via Expo Push & Redis stream service</p>
                </div>
              </div>
              <Toggle value={pushEnabled} onChange={setPushEnabled} />
            </div>
            <div className={`grid grid-cols-2 gap-3 transition-opacity ${pushEnabled ? "opacity-100" : "opacity-40 pointer-events-none"}`}>
              <NotiCheck label="Moderation queue updates" checked={push.modQueue} onChange={() => togglePush("modQueue")} badge="Live" />
              <NotiCheck label="User milestones" checked={push.milestones} onChange={() => togglePush("milestones")} badge="Live" />
              <NotiCheck label="Community highlights" checked={push.community} onChange={() => togglePush("community")} badge="Live" />
              <NotiCheck label="System maintenance alerts" checked={push.sysAlerts} onChange={() => togglePush("sysAlerts")} badge="Live" />
            </div>
          </div>

          {/* EMAIL NOTIFICATIONS (TRANSACTIONAL LIVE, DIGESTS IN DEV) */}
          <div className="bg-white rounded-2xl border border-[#ECE7F2] shadow-sm p-6">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#F3EEFF] flex items-center justify-center">
                  <Mail className="w-5 h-5 text-[#7004DC]" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-extrabold text-[#1A1C1C]">Email Notifications</h3>
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-[11px] font-bold">
                      Auth Emails Live
                    </span>
                  </div>
                  <p className="text-xs text-[#4B4355]/60">System transactional emails (OTP & Password Reset) are operational</p>
                </div>
              </div>
            </div>
            <div className="space-y-3">
              <NotiCheck label="New user registrations" checked={email.newUsers} onChange={() => toggleEmail("newUsers")} disabled badge="Coming Soon" />
              <NotiCheck label="Content reports" checked={email.contentReports} onChange={() => toggleEmail("contentReports")} disabled badge="Coming Soon" urgent />
              <NotiCheck label="Failed transactions" checked={email.failedTx} onChange={() => toggleEmail("failedTx")} disabled badge="In Development" />
              <NotiCheck label="System errors" checked={email.sysErrors} onChange={() => toggleEmail("sysErrors")} disabled badge="Coming Soon" />
              <NotiCheck label="Weekly digest" checked={email.weeklyDigest} onChange={() => toggleEmail("weeklyDigest")} disabled badge="In Development" />
            </div>
            <p className="text-[11px] text-slate-400 mt-4 leading-relaxed bg-[#F7F5FA] p-3 rounded-xl">
              ℹ️ Background email alerts for admin summaries and automated digests are currently in development. User-facing transactional emails are fully live.
            </p>
          </div>
        </div>

        {/* RIGHT COLUMN */}
        <div className="space-y-5">
          {/* SMS (NOT CONFIGURED / COMING SOON) */}
          <div className="bg-white rounded-2xl border border-amber-200/60 shadow-sm p-5 opacity-90">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center">
                  <MessageSquare className="w-4 h-4 text-amber-600" />
                </div>
                <div>
                  <h3 className="font-extrabold text-[#1A1C1C]">SMS Notifications</h3>
                </div>
              </div>
              <span className="px-2 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-[10px] font-extrabold uppercase">
                Gateway Not Configured
              </span>
            </div>
            <div className="mb-4">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Phone Number</p>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  value={phone}
                  disabled
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full h-10 bg-[#F7F5FA] rounded-xl pl-9 pr-3 text-sm text-slate-400 border border-slate-200 cursor-not-allowed outline-none"
                  placeholder="Integration in progress..."
                />
              </div>
            </div>
            <div className="space-y-2.5">
              <NotiCheck label="Critical alerts only" checked={sms.critical} onChange={() => toggleSms("critical")} disabled badge="Coming Soon" />
              <NotiCheck label="Daily summary" checked={sms.daily} onChange={() => toggleSms("daily")} disabled badge="Coming Soon" />
              <NotiCheck label="Promotional campaigns" checked={sms.promo} onChange={() => toggleSms("promo")} disabled badge="Coming Soon" />
            </div>
            <p className="text-[11px] text-amber-800/80 mt-3.5 bg-amber-50/60 p-2.5 rounded-xl border border-amber-100 leading-relaxed">
              ⚠️ SMS Gateway (AWS SNS / Twilio) integration is scheduled for an upcoming release.
            </p>
          </div>

          {/* GLOBAL FREQUENCY */}
          <div className="bg-[#7004DC] rounded-2xl p-5 text-white">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-extrabold">Global Frequency</h3>
              <span className="px-2 py-0.5 rounded-full bg-white/20 text-white text-[10px] font-extrabold uppercase">
                Beta
              </span>
            </div>
            <div className="space-y-3">
              {(["realtime", "daily", "weekly", "none"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFreq(f)}
                  className="w-full flex items-center justify-between"
                >
                  <span className="text-sm capitalize">{f === "realtime" ? "Real-time" : f === "daily" ? "Daily digest" : f === "weekly" ? "Weekly digest" : "None"}</span>
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition ${freq === f ? "border-white bg-white" : "border-white/40"
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
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-[#1A1C1C]">Quiet Hours</h3>
                <span className="px-2 py-0.5 rounded-full bg-violet-50 text-[#7004DC] text-[10px] font-extrabold uppercase border border-violet-100">
                  Beta
                </span>
              </div>
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
          onClick={handleSave}
          disabled={saving}
          className="h-11 px-8 rounded-xl bg-[#D2A500] hover:bg-[#b89300] disabled:opacity-60 text-white font-bold text-sm transition shadow-md flex items-center gap-2"
        >
          {saving && <RefreshCw className="w-4 h-4 animate-spin" />}
          {saving ? "Saving..." : "Save Changes"}
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────
// SECURITY TAB (Live Database & Audit)
// ─────────────────────────────────────

interface AuditLogRow {
  id: string;
  action: string;
  rawAction: string;
  admin: string;
  module: string;
  moduleType: "system" | "group" | "user" | "security" | "moderation";
  targetId?: string;
  detail: string;
  isoDate: string;
  status: string;
}

function formatAuditTime(isoStr?: string) {
  if (!isoStr) return { formatted: "Just now", relative: "Recent" };
  const date = new Date(isoStr);
  if (isNaN(date.getTime())) return { formatted: isoStr, relative: "" };

  const formatted = date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });

  const diffSec = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
  let relative = "Just now";
  if (diffSec >= 60 && diffSec < 3600) relative = `${Math.floor(diffSec / 60)}m ago`;
  else if (diffSec >= 3600 && diffSec < 86400) relative = `${Math.floor(diffSec / 3600)}h ago`;
  else if (diffSec >= 86400) relative = `${Math.floor(diffSec / 86400)}d ago`;

  return { formatted, relative };
}

function SecurityTab({ onSave }: { onSave: () => void }) {
  const [twoFa, setTwoFa] = useState(true);
  const [minLen, setMinLen] = useState(12);
  const [upperCase, setUpperCase] = useState(true);
  const [numbers, setNumbers] = useState(true);
  const [special, setSpecial] = useState(true);
  const [maxAttempts, setMaxAttempts] = useState("5");
  const [lockout, setLockout] = useState("15");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [logsLoading, setLogsLoading] = useState(true);
  const [auditLogs, setAuditLogs] = useState<AuditLogRow[]>([]);
  const [auditFilter, setAuditFilter] = useState("");

  // Load live security policies
  const loadSecuritySettings = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/settings/security");
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.settings) {
          setTwoFa(Boolean(data.settings.twoFa));
          setMinLen(data.settings.minLen ?? 12);
          setUpperCase(Boolean(data.settings.upperCase));
          setNumbers(Boolean(data.settings.numbers));
          setSpecial(Boolean(data.settings.special));
          setMaxAttempts(String(data.settings.maxAttempts ?? 5));
          setLockout(String(data.settings.lockout ?? 15));
        }
      }
    } catch (err) {
      console.error("Failed to load security settings:", err);
    } finally {
      setLoading(false);
    }
  };

  // Load live audit logs from PostgreSQL
  const loadAuditLogs = async () => {
    try {
      setLogsLoading(true);
      const res = await fetch("/api/settings/audit");
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.logs)) {
          setAuditLogs(data.logs);
        }
      }
    } catch (err) {
      console.error("Failed to load audit logs:", err);
    } finally {
      setLogsLoading(false);
    }
  };

  useEffect(() => {
    loadSecuritySettings();
    loadAuditLogs();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/settings/security", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          twoFa,
          minLen,
          upperCase,
          numbers,
          special,
          maxAttempts,
          lockout,
        }),
      });
      if (res.ok) {
        onSave();
        loadAuditLogs(); // Refresh audit logs after policy change
      }
    } catch (err) {
      console.error("Failed to save security settings:", err);
    } finally {
      setSaving(false);
    }
  };

  const exportAuditCsv = () => {
    if (auditLogs.length === 0) return;
    const headers = ["ID", "Action", "Description", "Module", "Actor", "Timestamp", "Status"];
    const rows = auditLogs.map((l) => {
      const time = formatAuditTime(l.isoDate);
      return [
        `"${l.id}"`,
        `"${l.action}"`,
        `"${(l.detail || "").replace(/"/g, '""')}"`,
        `"${l.module}"`,
        `"${l.admin}"`,
        `"${time.formatted}"`,
        `"${l.status}"`,
      ];
    });

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `digiability_audit_log_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filtered = auditLogs.filter(
    (l) =>
      !auditFilter ||
      l.action.toLowerCase().includes(auditFilter.toLowerCase()) ||
      l.admin.toLowerCase().includes(auditFilter.toLowerCase()) ||
      l.module.toLowerCase().includes(auditFilter.toLowerCase()) ||
      l.detail.toLowerCase().includes(auditFilter.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-extrabold text-[#1A1C1C]">Security Settings</h2>
          <p className="text-sm text-[#4B4355]/70 mt-1">
            Manage authentication policies, admin access controls, and live audit history.
          </p>
        </div>
        {loading && (
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-400">
            <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#7004DC]" />
            Loading...
          </div>
        )}
      </div>

      {/* 2FA + PASSWORD POLICY */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 2FA CARD */}
        <div className="bg-white rounded-2xl border border-[#ECE7F2] shadow-sm p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-start justify-between mb-4">
              <div className="w-12 h-12 rounded-xl bg-[#7004DC]/10 flex items-center justify-center">
                <Shield className="w-6 h-6 text-[#7004DC]" />
              </div>
              <span className={`px-3 py-1 rounded-full text-xs font-bold ${twoFa ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"}`}>
                {twoFa ? "ENFORCED" : "OPTIONAL"}
              </span>
            </div>
            <h3 className="text-lg font-extrabold text-[#1A1C1C]">Two-Factor Authentication</h3>
            <p className="text-sm text-[#4B4355]/70 mt-2 leading-relaxed">
              Require time-based one-time password (TOTP) verification for all administrative operations.
            </p>
            <div className="mt-5 flex items-center gap-3 p-3.5 bg-[#F7F5FA] rounded-xl border border-slate-100">
              <AlertCircle className="w-4 h-4 text-[#7004DC] shrink-0" />
              <span className="text-xs font-semibold text-[#1A1C1C]">
                Hardware key & TOTP (Google Authenticator) supported
              </span>
            </div>
          </div>
          <button
            onClick={() => setTwoFa(!twoFa)}
            type="button"
            className={`mt-6 w-full h-11 rounded-xl font-bold text-sm transition ${
              twoFa
                ? "bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200"
                : "bg-[#7004DC] hover:bg-[#5a03b0] text-white shadow-md"
            }`}
          >
            {twoFa ? "Switch to Optional 2FA" : "Enforce 2FA for All Admins"}
          </button>
        </div>

        {/* PASSWORD POLICY CARD */}
        <div className="bg-white rounded-2xl border border-[#ECE7F2] shadow-sm p-6">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-lg font-extrabold text-[#1A1C1C]">Password Policy</h3>
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[11px] font-bold border border-emerald-200">
              Live Policy
            </span>
          </div>
          <div className="space-y-5">
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-semibold text-[#4B4355]">Minimum Character Length</span>
                <span className="text-lg font-extrabold text-[#7004DC]">{minLen}</span>
              </div>
              <input
                type="range"
                min={8}
                max={24}
                value={minLen}
                onChange={(e) => setMinLen(Number(e.target.value))}
                className="w-full accent-[#7004DC] cursor-pointer"
              />
              <div className="flex justify-between text-xs font-bold text-slate-400 mt-1">
                <span>8 CHARS</span>
                <span>24 CHARS</span>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: "UPPERCASE", value: upperCase, set: setUpperCase },
                { label: "NUMBERS", value: numbers, set: setNumbers },
                { label: "SPECIAL", value: special, set: setSpecial },
              ].map(({ label, value, set }) => (
                <div key={label} className="flex flex-col items-center gap-2 p-3 bg-[#F7F5FA] rounded-xl border border-slate-100">
                  <span className="text-[10px] font-extrabold text-slate-500 tracking-wider">{label}</span>
                  <Toggle value={value} onChange={set} small />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* LOGIN ATTEMPTS & SESSION SECURITY */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-[#ECE7F2] shadow-sm p-6">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-orange-100 flex items-center justify-center">
                <AlertCircle className="w-5 h-5 text-orange-600" />
              </div>
              <div>
                <h3 className="text-lg font-extrabold text-[#1A1C1C]">Brute-Force Protection</h3>
                <p className="text-xs text-[#4B4355]/60">Automated lockout on repeated authentication failures</p>
              </div>
            </div>
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[11px] font-bold border border-emerald-200">
              Active
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Max Failed Attempts</label>
              <div className="mt-2 flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={maxAttempts}
                  onChange={(e) => setMaxAttempts(e.target.value)}
                  className="w-20 h-11 bg-[#F7F5FA] rounded-xl px-3 text-center font-bold text-[#1A1C1C] border border-transparent focus:border-[#8A38F5]/30 focus:outline-none"
                />
                <span className="text-xs font-semibold text-[#4B4355]">attempts</span>
              </div>
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Lockout Duration</label>
              <div className="mt-2 flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  max={1440}
                  value={lockout}
                  onChange={(e) => setLockout(e.target.value)}
                  className="w-20 h-11 bg-[#F7F5FA] rounded-xl px-3 text-center font-bold text-[#1A1C1C] border border-transparent focus:border-[#8A38F5]/30 focus:outline-none"
                />
                <span className="text-xs font-semibold text-[#4B4355]">minutes</span>
              </div>
            </div>
          </div>
        </div>

        {/* ACTIVE SESSIONS CARD */}
        <div className="bg-white rounded-2xl border border-[#ECE7F2] shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-violet-100 flex items-center justify-center">
                <Monitor className="w-5 h-5 text-[#7004DC]" />
              </div>
              <div>
                <h3 className="text-lg font-extrabold text-[#1A1C1C]">Admin Session Security</h3>
                <p className="text-xs text-[#4B4355]/60">Encrypted JWT session cookie with HttpOnly protection</p>
              </div>
            </div>
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[11px] font-bold border border-emerald-200">
              Encrypted
            </span>
          </div>
          <div className="p-4 bg-[#F7F5FA] rounded-xl border border-slate-100 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#1A1C1C] flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                Current Admin Session Active
              </span>
              <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-[#7004DC] text-white">
                CURRENT
              </span>
            </div>
            <p className="text-xs text-[#4B4355]/70">
              Authenticated via symmetric AES/HMAC signed token with secure cross-origin flags.
            </p>
          </div>
        </div>
      </div>

      {/* LIVE SECURITY AUDIT LOG */}
      <div className="bg-white rounded-2xl border border-[#ECE7F2] shadow-sm overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between px-6 py-5 border-b border-[#F0F0F0] gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#F3EEFF] flex items-center justify-center">
              <Database className="w-5 h-5 text-[#7004DC]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-extrabold text-[#1A1C1C]">Live Security Audit Log</h3>
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[11px] font-extrabold border border-emerald-200">
                  Live Stream ({auditLogs.length})
                </span>
              </div>
              <p className="text-xs text-[#4B4355]/60">Immutable record of administrative actions and system modifications</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <input
                type="text"
                placeholder="Search audit actions…"
                value={auditFilter}
                onChange={(e) => setAuditFilter(e.target.value)}
                className="h-9 w-52 bg-[#F7F5FA] rounded-xl pl-9 pr-3 text-sm border border-transparent focus:border-[#8A38F5]/30 focus:outline-none"
              />
              <svg className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.3-4.3" strokeLinecap="round" />
              </svg>
            </div>
            <button
              onClick={loadAuditLogs}
              title="Refresh logs"
              className="h-9 w-9 rounded-xl border border-[#E8E8E8] hover:bg-[#F7F5FA] flex items-center justify-center transition"
            >
              <RefreshCw className={`w-4 h-4 text-slate-500 ${logsLoading ? "animate-spin text-[#7004DC]" : ""}`} />
            </button>
            <button
              onClick={exportAuditCsv}
              disabled={auditLogs.length === 0}
              className="h-9 px-4 rounded-xl border border-[#E8E8E8] hover:bg-[#F7F5FA] text-sm font-semibold flex items-center gap-2 transition disabled:opacity-50"
            >
              <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              Export CSV
            </button>
          </div>
        </div>

        {/* PROPER ALIGNED AUDIT TABLE */}
        {logsLoading && auditLogs.length === 0 ? (
          <div className="p-12 text-center text-sm font-semibold text-slate-400 flex items-center justify-center gap-2">
            <RefreshCw className="w-4 h-4 animate-spin text-[#7004DC]" />
            Streaming audit records from database...
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-sm font-semibold text-slate-400">
            No audit records match the current filter.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#F7F5FA] border-b border-[#ECE7F2]">
                  <th className="px-6 py-4 text-[11px] font-extrabold uppercase tracking-wider text-[#7D7387] whitespace-nowrap min-w-[280px]">
                    Event & Description
                  </th>
                  <th className="px-6 py-4 text-[11px] font-extrabold uppercase tracking-wider text-[#7D7387] whitespace-nowrap min-w-[170px]">
                    Module
                  </th>
                  <th className="px-6 py-4 text-[11px] font-extrabold uppercase tracking-wider text-[#7D7387] whitespace-nowrap min-w-[140px]">
                    Actor
                  </th>
                  <th className="px-6 py-4 text-[11px] font-extrabold uppercase tracking-wider text-[#7D7387] whitespace-nowrap min-w-[180px]">
                    Timestamp
                  </th>
                  <th className="px-6 py-4 text-[11px] font-extrabold uppercase tracking-wider text-[#7D7387] whitespace-nowrap text-right pr-8 min-w-[110px]">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F0EDF5]">
                {filtered.map((row) => {
                  const time = formatAuditTime(row.isoDate);
                  return (
                    <tr key={row.id} className="hover:bg-[#FAFAFC] transition">
                      {/* EVENT & DESCRIPTION */}
                      <td className="px-6 py-4">
                        <p className="text-sm font-bold text-[#1A1C1C] leading-snug">{row.action}</p>
                        {row.detail && (
                          <p className="text-xs text-[#7D7387] mt-1 leading-relaxed">
                            {row.detail}
                          </p>
                        )}
                      </td>

                      {/* MODULE */}
                      <td className="px-6 py-4 whitespace-nowrap align-middle">
                        <span
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border ${
                            row.moduleType === "group"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : row.moduleType === "user"
                              ? "bg-amber-50 text-amber-800 border-amber-200"
                              : row.moduleType === "security"
                              ? "bg-violet-50 text-violet-700 border-violet-200"
                              : "bg-blue-50 text-blue-700 border-blue-200"
                          }`}
                        >
                          <span>
                            {row.moduleType === "group" && "👥"}
                            {row.moduleType === "user" && "👤"}
                            {row.moduleType === "security" && "🛡️"}
                            {row.moduleType === "system" && "⚙️"}
                          </span>
                          {row.module}
                        </span>
                      </td>

                      {/* ACTOR */}
                      <td className="px-6 py-4 whitespace-nowrap align-middle">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold text-[#7004DC] bg-[#F3EEFF] border border-[#E9D9FF]">
                          {row.admin}
                        </span>
                      </td>

                      {/* TIMESTAMP */}
                      <td className="px-6 py-4 whitespace-nowrap align-middle">
                        <p className="text-xs font-bold text-[#1A1C1C]">{time.formatted}</p>
                        <span className="text-[11px] text-slate-400 font-medium block mt-0.5">{time.relative}</span>
                      </td>

                      {/* STATUS */}
                      <td className="px-6 py-4 whitespace-nowrap align-middle text-right pr-8">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-green-100 text-green-700">
                          <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                          {row.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="h-11 px-8 rounded-xl bg-[#D2A500] hover:bg-[#b89300] disabled:opacity-60 text-white font-bold text-sm transition shadow-md flex items-center gap-2"
        >
          {saving && <RefreshCw className="w-4 h-4 animate-spin" />}
          {saving ? "Saving..." : "Save Changes"}
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
  label,
  checked,
  onChange,
  urgent,
  disabled,
  badge,
}: {
  label: string;
  checked: boolean;
  onChange: () => void;
  urgent?: boolean;
  disabled?: boolean;
  badge?: string;
}) {
  return (
    <button
      onClick={disabled ? undefined : onChange}
      disabled={disabled}
      type="button"
      className={`flex items-center gap-3 w-full text-left transition-all ${
        disabled ? "opacity-55 cursor-not-allowed" : "hover:opacity-90 cursor-pointer"
      }`}
    >
      <div
        className={`w-5 h-5 rounded-md flex-shrink-0 flex items-center justify-center transition-all ${
          checked
            ? disabled
              ? "bg-slate-400"
              : "bg-[#7004DC]"
            : "border-2 border-slate-200 bg-white"
        }`}
      >
        {checked && <Check className="w-3 h-3 text-white" />}
      </div>
      <span className={`text-sm font-semibold flex-1 ${disabled ? "text-slate-500" : "text-[#1A1C1C]"}`}>
        {label}
      </span>
      {badge && (
        <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 text-[10px] font-extrabold uppercase tracking-wider border border-slate-200">
          {badge}
        </span>
      )}
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
  const on = small ? "left-[18px]" : "left-6";
  return (
    <button
      onClick={() => onChange(!value)}
      className={`${w} ${h} rounded-full relative transition-colors duration-200 flex-shrink-0 ${value ? "bg-[#7004DC]" : "bg-slate-200"}`}
    >
      <div className={`absolute top-[3px] ${dot} rounded-full bg-white shadow transition-all duration-200 ${value ? on : "left-[3px]"}`} />
    </button>
  );
}

function IconInput({
  label,
  icon,
  value,
  onChange,
  defaultValue,
  disabled,
  badge,
  badgeVariant = "info",
  helperText,
}: {
  label: string;
  icon: React.ReactNode;
  value?: string;
  onChange?: (val: string) => void;
  defaultValue?: string;
  disabled?: boolean;
  badge?: string;
  badgeVariant?: "locked" | "active" | "info";
  helperText?: string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <label className="text-xs font-extrabold uppercase tracking-[0.15em] text-slate-500">{label}</label>
        {badge && (
          <span
            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
              badgeVariant === "locked"
                ? "bg-slate-100 text-slate-600 border border-slate-200"
                : badgeVariant === "active"
                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                : "bg-violet-50 text-[#7004DC] border border-violet-200"
            }`}
          >
            {badgeVariant === "locked" && <Lock className="w-2.5 h-2.5" />}
            {badge}
          </span>
        )}
      </div>
      <div className="relative mt-1">
        <div className={`absolute left-4 top-1/2 -translate-y-1/2 ${disabled ? "text-slate-400" : "text-slate-400"}`}>
          {icon}
        </div>
        <input
          value={value}
          defaultValue={defaultValue}
          disabled={disabled}
          readOnly={disabled}
          onChange={onChange ? (e) => onChange(e.target.value) : undefined}
          className={`w-full h-12 rounded-xl pl-10 pr-4 transition-all text-sm font-semibold outline-none ${
            disabled
              ? "bg-[#EFEBF4]/70 text-[#6B6276] border border-[#DDD6E8] cursor-not-allowed select-none"
              : "bg-[#F7F5FA] text-[#1A1C1C] border border-transparent focus:border-[#8A38F5]/40 focus:ring-2 focus:ring-[#8A38F5]/10"
          }`}
        />
      </div>
      {helperText && (
        <p className="text-[11px] text-slate-400 mt-1.5 leading-normal">{helperText}</p>
      )}
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
