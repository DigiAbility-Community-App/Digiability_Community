"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Users, Heart, MessageCircle, RefreshCw, Search,
  Clock, Plus, X, ChevronDown, Loader2, CheckCircle2,
  AlertTriangle, Settings,
} from "lucide-react";

interface Group {
  id: string;
  name: string | null;
  description: string | null;
  subType: "GENERAL" | "CARE_CIRCLE" | null;
  createdAt: string;
  lastMessageAt: string | null;
  lastMessageText: string | null;
  maxMembers: number;
  memberCount: string;
}

interface GroupStats {
  totalGroups: string;
  careCircles: string;
  generalGroups: string;
  directMessages: string;
}

interface UserOption {
  id: string;
  name: string;
  email: string;
  roles: string[];
}

const GENERAL_ROLES = ["MEMBER", "ADMIN"] as const;
const CARE_CIRCLE_ROLES = ["MEMBER", "CAREGIVER", "MENTOR", "PROFESSIONAL"] as const;

// ─────────────────────────────────────────────
// PAGE
// ─────────────────────────────────────────────
export default function GroupsPage() {
  const router = useRouter();
  const [groups, setGroups]   = useState<Group[]>([]);
  const [stats, setStats]     = useState<GroupStats>({ totalGroups:"0", careCircles:"0", generalGroups:"0", directMessages:"0" });
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState("");
  const [typeFilter, setTypeFilter] = useState<"ALL"|"GENERAL"|"CARE_CIRCLE">("ALL");
  const [showCreate, setShowCreate] = useState(false);

  // ── fetch groups ──
  const fetchGroups = async () => {
    setLoading(true);
    try {
      const res  = await fetch("/api/groups");
      const data = await res.json();
      if (data.success) { setGroups(data.groups); setStats(data.stats); }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchGroups(); }, []);

  const filtered = groups.filter(g => {
    const name = (g.name || "").toLowerCase();
    if (search && !name.includes(search.toLowerCase())) return false;
    if (typeFilter !== "ALL" && g.subType !== typeFilter) return false;
    return true;
  });

  const statsCards = [
    { label: "Total Groups",    value: stats.totalGroups,    icon: <Users className="w-5 h-5" />,         bg: "bg-violet-50",  text: "text-violet-600" },
    { label: "Care Circles",    value: stats.careCircles,    icon: <Heart className="w-5 h-5" />,         bg: "bg-pink-50",    text: "text-pink-600"   },
    { label: "General Groups",  value: stats.generalGroups,  icon: <MessageCircle className="w-5 h-5" />, bg: "bg-blue-50",    text: "text-blue-600"   },
    { label: "Direct Messages", value: stats.directMessages, icon: <MessageCircle className="w-5 h-5" />, bg: "bg-green-50",   text: "text-green-600"  },
  ];

  return (
    <div className="px-8 py-8 space-y-6">
      {/* HEADER */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-extrabold tracking-tight text-[#1A1C1C]">Groups & Communities</h1>
          <p className="text-sm text-[#7D7387] mt-2">Monitor and manage community groups and care circles</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={fetchGroups} className="h-11 px-4 rounded-xl bg-[#F3F3F3] hover:bg-[#EBEBEB] transition flex items-center gap-2 text-sm font-semibold text-[#4B4355]">
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
          <button
            onClick={() => setShowCreate(true)}
            className="h-11 px-5 rounded-xl bg-[#D2A500] hover:bg-[#b89300] text-white font-bold text-sm flex items-center gap-2 shadow-md transition"
          >
            <Plus className="w-4 h-4" /> Create Group
          </button>
        </div>
      </div>

      {/* STATS */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-5">
        {statsCards.map((card, i) => (
          <div key={i} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex items-center gap-4">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${card.bg} ${card.text}`}>{card.icon}</div>
            <div>
              <p className="text-xs font-semibold text-[#7D7387] uppercase tracking-wide">{card.label}</p>
              <h2 className="text-3xl font-extrabold text-[#1A1C1C] mt-1">{card.value}</h2>
            </div>
          </div>
        ))}
      </div>

      {/* FILTER BAR */}
      <div className="bg-[#F3F3F3] rounded-2xl p-4 flex flex-wrap items-center gap-4">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#7D7387]" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search groups..." className="w-full h-11 rounded-xl bg-white pl-11 pr-4 text-sm outline-none border border-transparent focus:border-[#8A38F5]" />
        </div>
        <div className="flex gap-2">
          {(["ALL","GENERAL","CARE_CIRCLE"] as const).map(t => (
            <button key={t} onClick={() => setTypeFilter(t)} className={`h-11 px-4 rounded-xl text-sm font-bold transition ${typeFilter===t ? "bg-[#7004DC] text-white" : "bg-white text-[#4B4355] border border-gray-200/50"}`}>
              {t === "ALL" ? "All" : t === "CARE_CIRCLE" ? "Care Circles" : "General"}
            </button>
          ))}
        </div>
      </div>

      {/* TABLE */}
      {loading ? (
        <div className="flex items-center justify-center h-64"><div className="w-10 h-10 border-4 border-[#7004DC] border-t-transparent rounded-full animate-spin" /></div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="grid grid-cols-[2fr_140px_100px_120px_160px_140px] bg-[#F3F3F3] border-b border-gray-100">
            {["Group","Type","Members","Max","Last Activity","Actions"].map(h => (
              <div key={h} className="px-6 py-4 text-[11px] font-bold uppercase tracking-[0.15em] text-[#7D7387]">{h}</div>
            ))}
          </div>

          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3 text-slate-400">
              <Users className="w-12 h-12" />
              <p className="font-semibold">{groups.length === 0 ? "No groups created yet — create your first group above" : "No groups match your filters"}</p>
            </div>
          ) : filtered.map(group => (
            <div key={group.id} className="grid grid-cols-[2fr_140px_100px_120px_160px_140px] items-center border-b border-gray-100 hover:bg-[#FAFAFA] transition">
              {/* NAME */}
              <div className="px-6 py-5 flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 ${group.subType==="CARE_CIRCLE" ? "bg-pink-100 text-pink-600" : "bg-violet-100 text-violet-600"}`}>
                  {group.subType === "CARE_CIRCLE" ? <Heart className="w-4 h-4" /> : <Users className="w-4 h-4" />}
                </div>
                <div>
                  <p className="font-semibold text-sm text-[#1A1C1C]">{group.name || "Unnamed Group"}</p>
                  {group.description && <p className="text-xs text-[#7D7387] mt-0.5 line-clamp-1">{group.description}</p>}
                  <p className="text-xs text-slate-400 mt-0.5">Created {group.createdAt}</p>
                </div>
              </div>
              {/* TYPE */}
              <div className="px-6 py-5">
                <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${group.subType==="CARE_CIRCLE" ? "bg-pink-100 text-pink-700" : "bg-violet-100 text-violet-700"}`}>
                  {group.subType === "CARE_CIRCLE" ? "Care Circle" : "General"}
                </span>
              </div>
              {/* MEMBER COUNT */}
              <div className="px-6 py-5">
                <div className="flex items-center gap-1.5 font-bold text-sm text-[#1A1C1C]">
                  <Users className="w-3.5 h-3.5 text-slate-400" />{group.memberCount}
                </div>
              </div>
              {/* MAX */}
              <div className="px-6 py-5 text-sm text-[#4B4355]">{group.maxMembers}</div>
              {/* LAST ACTIVITY */}
              <div className="px-6 py-5">
                {group.lastMessageAt ? (
                  <div>
                    <div className="flex items-center gap-1.5 text-xs text-[#7D7387]"><Clock className="w-3 h-3" />{group.lastMessageAt}</div>
                    {group.lastMessageText && <p className="text-xs text-slate-400 mt-0.5 line-clamp-1">{group.lastMessageText}</p>}
                  </div>
                ) : <span className="text-xs text-slate-400">No messages yet</span>}
              </div>
              {/* ACTIONS */}
              <div className="px-6 py-5 flex items-center gap-2">
                <button onClick={() => router.push(`/groups/${group.id}`)} className="h-9 px-4 rounded-xl bg-[#7004DC] hover:bg-[#5c03b7] text-white text-xs font-bold flex items-center gap-1.5 transition">
                  <Settings className="w-3.5 h-3.5" /> Manage
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* CREATE GROUP MODAL */}
      {showCreate && (
        <CreateGroupModal
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); fetchGroups(); }}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// CREATE GROUP MODAL
// ─────────────────────────────────────────────
function CreateGroupModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [step, setStep] = useState<1 | 2>(1);
  const [subType, setSubType] = useState<"GENERAL" | "CARE_CIRCLE">("GENERAL");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [maxMembers, setMaxMembers] = useState("");
  const [editGroupInfo, setEditGroupInfo] = useState<"ADMINS_ONLY"|"ALL_MEMBERS">("ADMINS_ONLY");
  const [addMembersPerm, setAddMembersPerm] = useState<"ADMINS_ONLY"|"ALL_MEMBERS">("ADMINS_ONLY");
  const [sendMessages, setSendMessages] = useState<"ADMINS_ONLY"|"ALL_MEMBERS">("ALL_MEMBERS");
  const [approveNewMembers, setApproveNewMembers] = useState(false);

  // Step 2 — members
  const [allUsers, setAllUsers] = useState<UserOption[]>([]);
  const [memberSearch, setMemberSearch] = useState("");
  const [selectedMembers, setSelectedMembers] = useState<{ user: UserOption; role: string }[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const roles = subType === "CARE_CIRCLE" ? CARE_CIRCLE_ROLES : GENERAL_ROLES;

  const goToStep2 = async () => {
    if (!name.trim()) { setError("Group name is required"); return; }
    setError("");
    setLoadingUsers(true);
    try {
      const res  = await fetch("/api/users");
      const data = await res.json();
      if (data.success) setAllUsers(data.users);
    } catch (e) { console.error(e); }
    finally { setLoadingUsers(false); }
    setStep(2);
  };

  const toggleMember = (user: UserOption) => {
    setSelectedMembers(prev => {
      const exists = prev.find(m => m.user.id === user.id);
      if (exists) return prev.filter(m => m.user.id !== user.id);
      return [...prev, { user, role: "MEMBER" }];
    });
  };

  const updateRole = (userId: string, role: string) => {
    setSelectedMembers(prev => prev.map(m => m.user.id === userId ? { ...m, role } : m));
  };

  const handleCreate = async () => {
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          subType,
          description: description.trim(),
          maxMembers: maxMembers ? Number(maxMembers) : undefined,
          editGroupInfo,
          addMembers: addMembersPerm,
          sendMessages,
          approveNewMembers,
          initialMembers: selectedMembers.map(m => ({ userId: m.user.id, role: m.role })),
        }),
      });
      const data = await res.json();
      if (data.success) { onCreated(); }
      else { setError(data.message || "Failed to create group"); }
    } catch { setError("Network error"); }
    finally { setSubmitting(false); }
  };

  const filteredUsers = allUsers.filter(u =>
    !memberSearch ||
    u.name.toLowerCase().includes(memberSearch.toLowerCase()) ||
    u.email.toLowerCase().includes(memberSearch.toLowerCase())
  );

  const PermToggle = ({ label, value, onChange }: { label: string; value: "ADMINS_ONLY"|"ALL_MEMBERS"; onChange: (v: "ADMINS_ONLY"|"ALL_MEMBERS") => void }) => (
    <div>
      <p className="text-xs font-bold text-[#4B4355] mb-1.5">{label}</p>
      <div className="flex gap-2">
        {(["ADMINS_ONLY","ALL_MEMBERS"] as const).map(opt => (
          <button key={opt} type="button" onClick={() => onChange(opt)}
            className={`flex-1 h-8 rounded-lg text-[10px] font-bold uppercase tracking-wide transition ${value===opt ? "bg-[#7004DC] text-white" : "bg-[#F3F3F3] text-[#4B4355] hover:bg-[#EBEBEB]"}`}>
            {opt === "ADMINS_ONLY" ? "Admins Only" : "All Members"}
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-[28px] w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* HEADER */}
        <div className="flex items-center justify-between px-8 py-5 border-b border-gray-100">
          <div>
            <h3 className="text-xl font-extrabold text-[#1A1C1C]">Create New Group</h3>
            <p className="text-xs text-[#7D7387] mt-0.5">Step {step} of 2 — {step===1 ? "Group Details" : "Add Initial Members"}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center"><X className="w-4 h-4 text-slate-500" /></button>
        </div>

        {/* PROGRESS BAR */}
        <div className="h-1 bg-[#F3F3F3]"><div className="h-full bg-[#7004DC] transition-all" style={{ width: step===1 ? "50%" : "100%" }} /></div>

        <div className="flex-1 overflow-y-auto px-8 py-6 space-y-5">
          {error && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-600 rounded-xl px-4 py-3 text-sm font-semibold">
              <AlertTriangle className="w-4 h-4 shrink-0" />{error}
            </div>
          )}

          {/* ── STEP 1 ── */}
          {step === 1 && (
            <>
              {/* GROUP TYPE */}
              <div>
                <label className="block text-xs font-extrabold uppercase tracking-[0.15em] text-slate-500 mb-2">Group Type *</label>
                <div className="grid grid-cols-2 gap-3">
                  {([
                    { value: "GENERAL",     icon: <Users className="w-5 h-5" />,  label: "General Community", desc: "Open discussion group" },
                    { value: "CARE_CIRCLE", icon: <Heart className="w-5 h-5" />,  label: "Care Circle",       desc: "Support network with caregivers & professionals" },
                  ] as const).map(opt => (
                    <button key={opt.value} type="button" onClick={() => setSubType(opt.value)}
                      className={`p-4 rounded-xl border-2 text-left transition ${subType===opt.value ? "border-[#7004DC] bg-violet-50" : "border-gray-200 hover:border-gray-300"}`}>
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-2 ${subType===opt.value ? "bg-[#7004DC] text-white" : "bg-[#F3F3F3] text-[#4B4355]"}`}>{opt.icon}</div>
                      <p className="text-sm font-bold text-[#1A1C1C]">{opt.label}</p>
                      <p className="text-xs text-[#7D7387] mt-0.5">{opt.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* NAME */}
              <div>
                <label className="block text-xs font-extrabold uppercase tracking-[0.15em] text-slate-500 mb-2">Group Name * (max 200 chars)</label>
                <input value={name} onChange={e => setName(e.target.value)} maxLength={200} placeholder={subType==="CARE_CIRCLE" ? "e.g. Arjun's Care Circle" : "e.g. Autism Support Network"} className="w-full h-12 rounded-xl bg-[#F7F5FA] px-4 text-sm outline-none border border-transparent focus:border-[#8A38F5] transition" />
                <p className="text-xs text-slate-400 mt-1 text-right">{name.length}/200</p>
              </div>

              {/* DESCRIPTION */}
              <div>
                <label className="block text-xs font-extrabold uppercase tracking-[0.15em] text-slate-500 mb-2">Description (max 500 chars)</label>
                <textarea value={description} onChange={e => setDescription(e.target.value)} maxLength={500} rows={3} placeholder="Describe the purpose and goals of this group..." className="w-full rounded-xl bg-[#F7F5FA] px-4 py-3 text-sm outline-none border border-transparent focus:border-[#8A38F5] resize-none transition" />
              </div>

              {/* MAX MEMBERS */}
              <div>
                <label className="block text-xs font-extrabold uppercase tracking-[0.15em] text-slate-500 mb-2">Max Members (default: {subType==="CARE_CIRCLE" ? 15 : 256})</label>
                <input type="number" value={maxMembers} onChange={e => setMaxMembers(e.target.value)} min={2} max={500} placeholder={String(subType==="CARE_CIRCLE" ? 15 : 256)} className="w-full h-12 rounded-xl bg-[#F7F5FA] px-4 text-sm outline-none border border-transparent focus:border-[#8A38F5] transition" />
              </div>

              {/* PERMISSIONS */}
              <div className="bg-[#F7F5FA] rounded-2xl p-5 space-y-4">
                <p className="text-xs font-extrabold uppercase tracking-[0.15em] text-slate-500">Permissions</p>
                <PermToggle label="Who can edit group info?"  value={editGroupInfo}    onChange={setEditGroupInfo} />
                <PermToggle label="Who can add members?"      value={addMembersPerm}  onChange={setAddMembersPerm} />
                <PermToggle label="Who can send messages?"    value={sendMessages}    onChange={setSendMessages} />
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold text-[#4B4355]">Require admin approval for new members</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">New join requests need admin approval</p>
                  </div>
                  <button type="button" onClick={() => setApproveNewMembers(v => !v)}
                    className={`w-11 h-6 rounded-full relative transition ${approveNewMembers ? "bg-[#7004DC]" : "bg-gray-200"}`}>
                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${approveNewMembers ? "right-1" : "left-1"}`} />
                  </button>
                </div>
              </div>
            </>
          )}

          {/* ── STEP 2 ── */}
          {step === 2 && (
            <>
              <p className="text-sm text-[#7D7387]">Search and add initial members to <strong className="text-[#1A1C1C]">{name}</strong>. You can also add members later.</p>

              {/* SEARCH */}
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#7D7387]" />
                <input value={memberSearch} onChange={e => setMemberSearch(e.target.value)} placeholder="Search users by name or email..." className="w-full h-11 rounded-xl bg-[#F7F5FA] pl-11 pr-4 text-sm outline-none border border-transparent focus:border-[#8A38F5]" />
              </div>

              {loadingUsers ? (
                <div className="flex items-center justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-[#7004DC]" /></div>
              ) : (
                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {filteredUsers.slice(0, 30).map(user => {
                    const selected = selectedMembers.find(m => m.user.id === user.id);
                    return (
                      <div key={user.id} className={`flex items-center gap-3 p-3 rounded-xl border-2 transition cursor-pointer ${selected ? "border-[#7004DC] bg-violet-50" : "border-transparent bg-[#F7F5FA] hover:bg-[#F0EDFA]"}`} onClick={() => toggleMember(user)}>
                        <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${selected ? "bg-[#7004DC] text-white" : "bg-[#EDDCFF] text-[#7004DC]"}`}>
                          {user.name.split(" ").map(n=>n[0]).join("").slice(0,2).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-[#1A1C1C] truncate">{user.name}</p>
                          <p className="text-xs text-[#7D7387] truncate">{user.email}</p>
                        </div>
                        {selected && <CheckCircle2 className="w-4 h-4 text-[#7004DC] shrink-0" />}
                      </div>
                    );
                  })}
                  {filteredUsers.length === 0 && <p className="text-sm text-slate-400 text-center py-4">No users found</p>}
                </div>
              )}

              {/* SELECTED MEMBERS + ROLE ASSIGNMENT */}
              {selectedMembers.length > 0 && (
                <div>
                  <p className="text-xs font-extrabold uppercase tracking-[0.15em] text-slate-500 mb-3">Selected ({selectedMembers.length}) — Assign Roles</p>
                  <div className="space-y-2">
                    {selectedMembers.map(({ user, role }) => (
                      <div key={user.id} className="flex items-center gap-3 bg-[#F7F5FA] rounded-xl p-3">
                        <div className="w-8 h-8 rounded-full bg-[#EDDCFF] text-[#7004DC] flex items-center justify-center text-xs font-bold shrink-0">
                          {user.name.split(" ").map(n=>n[0]).join("").slice(0,2).toUpperCase()}
                        </div>
                        <p className="text-sm font-semibold text-[#1A1C1C] flex-1 truncate">{user.name}</p>
                        <div className="relative shrink-0">
                          <select value={role} onChange={e => updateRole(user.id, e.target.value)} className="h-8 pl-3 pr-7 rounded-lg bg-white border border-gray-200 text-xs font-bold outline-none focus:border-[#8A38F5] appearance-none">
                            {roles.map(r => <option key={r} value={r}>{r}</option>)}
                          </select>
                          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400 pointer-events-none" />
                        </div>
                        <button onClick={() => toggleMember(user)} className="w-6 h-6 rounded-full hover:bg-red-100 flex items-center justify-center text-slate-400 hover:text-red-500 transition">
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* FOOTER */}
        <div className="px-8 py-5 border-t border-gray-100 flex justify-between gap-3">
          <button onClick={() => step===1 ? onClose() : setStep(1)} className="h-11 px-5 rounded-xl border border-gray-200 text-[#4B4355] font-semibold text-sm hover:bg-gray-50 transition">
            {step===1 ? "Cancel" : "← Back"}
          </button>
          {step === 1 ? (
            <button onClick={goToStep2} disabled={!name.trim()} className="h-11 px-6 rounded-xl bg-[#7004DC] hover:bg-[#5c03b7] disabled:bg-violet-200 text-white font-bold text-sm transition">
              Next: Add Members →
            </button>
          ) : (
            <button onClick={handleCreate} disabled={submitting} className="h-11 px-6 rounded-xl bg-[#D2A500] hover:bg-[#b89300] disabled:bg-yellow-200 text-white font-bold text-sm flex items-center gap-2 transition">
              {submitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Creating...</> : "Create Group"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
