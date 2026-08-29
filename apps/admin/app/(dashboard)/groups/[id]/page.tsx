"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, Users, Heart, Settings, Trash2, UserPlus,
  CheckCircle2, AlertTriangle, ChevronDown, X, Loader2,
  Search, Shield, MessageSquare, ChevronRight, Pencil, Save,
  Ban, Send, Clock, BellRing,
} from "lucide-react";

interface GroupDetail {
  id: string;
  name: string;
  description: string | null;
  subType: "GENERAL" | "CARE_CIRCLE" | null;
  maxMembers: number;
  memberCount: string;
  editGroupInfo: string;
  addMembers: string;
  sendMessages: string;
  approveNewMembers: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

interface Member {
  id: string;
  userId: string;
  name: string;
  email: string;
  role: string;
  joinedAt: string;
}

interface UserOption {
  id: string;
  name: string;
  email: string;
}

const GENERAL_ROLES   = ["MEMBER","ADMIN","OWNER"] as const;
const CARE_CIRCLE_ROLES = ["MEMBER","CAREGIVER","MENTOR","PROFESSIONAL","OWNER"] as const;

export default function GroupDetailPage() {
  const params  = useParams();
  const router  = useRouter();
  const id      = params.id as string;

  const [group,   setGroup]   = useState<GroupDetail | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // Edit state
  const [editing,     setEditing]     = useState(false);
  const [editName,    setEditName]    = useState("");
  const [editDesc,    setEditDesc]    = useState("");
  const [editEGI,     setEditEGI]     = useState<"ADMINS_ONLY"|"ALL_MEMBERS">("ADMINS_ONLY");
  const [editAM,      setEditAM]      = useState<"ADMINS_ONLY"|"ALL_MEMBERS">("ADMINS_ONLY");
  const [editSM,      setEditSM]      = useState<"ADMINS_ONLY"|"ALL_MEMBERS">("ALL_MEMBERS");
  const [editApprove, setEditApprove] = useState(false);
  const [saving,      setSaving]      = useState(false);

  // Add member state
  const [allUsers,       setAllUsers]       = useState<UserOption[]>([]);
  const [memberSearch,   setMemberSearch]   = useState("");
  const [selectedUser,   setSelectedUser]   = useState<UserOption | null>(null);
  const [addRole,        setAddRole]        = useState("MEMBER");
  const [addingMember,   setAddingMember]   = useState(false);
  const [userDropOpen,   setUserDropOpen]   = useState(false);
  const [addError,       setAddError]       = useState("");
  const [addSuccess,     setAddSuccess]     = useState("");

  // Remove member state
  const [removingId, setRemovingId] = useState<string | null>(null);

  // Delete group state
  const [showDelete,   setShowDelete]   = useState(false);
  const [deleting,     setDeleting]     = useState(false);
  const [deleteError,  setDeleteError]  = useState("");
  const [actionMsg,    setActionMsg]    = useState("");

  // Message modal state
  const [showMessageModal, setShowMessageModal] = useState(false);
  const [msgSubject, setMsgSubject] = useState("");
  const [msgBody, setMsgBody] = useState("");
  const [msgType, setMsgType] = useState("General Update");
  const [msgSendTo, setMsgSendTo] = useState<string[]>(["All Members"]);
  const [sendingMsg, setSendingMsg] = useState(false);

  // Suspension state
  const [showSuspendModal, setShowSuspendModal] = useState(false);
  const [suspendPeriod, setSuspendPeriod] = useState("14 Days");
  const [suspendReason, setSuspendReason] = useState("Community Guidelines Violation");
  const [suspendNote, setSuspendNote] = useState("");
  const [suspending, setSuspending] = useState(false);
  const [suspensionInfo, setSuspensionInfo] = useState<{
    isSuspended: boolean;
    period?: string;
    reason?: string;
    suspendedAt?: string;
    note?: string;
  } | null>(null);

  // ── fetch group ──
  const fetchGroup = async () => {
    setLoading(true);
    try {
      const res  = await fetch(`/api/groups/${id}`);
      const data = await res.json();
      if (data.success) {
        setGroup(data.group);
        setMembers(data.members);
        setEditName(data.group.name || "");
        setEditDesc(data.group.description || "");
        setEditEGI(data.group.editGroupInfo || "ADMINS_ONLY");
        setEditAM(data.group.addMembers || "ADMINS_ONLY");
        setEditSM(data.group.sendMessages || "ALL_MEMBERS");
        setEditApprove(data.group.approveNewMembers || false);
        if (data.group.sendMessages === "ADMINS_ONLY") {
          setSuspensionInfo((prev) => prev || {
            isSuspended: true,
            period: "Active Suspension",
            reason: "Moderator Administrative Action",
            suspendedAt: data.group.updatedAt,
          });
        } else {
          setSuspensionInfo(null);
        }
      } else { setNotFound(true); }
    } catch { setNotFound(true); }
    finally { setLoading(false); }
  };

  // ── fetch users for add-member ──
  const fetchUsers = async () => {
    try {
      const res  = await fetch("/api/users");
      const data = await res.json();
      if (data.success) setAllUsers(data.users);
    } catch (e) { console.error(e); }
  };

  useEffect(() => { fetchGroup(); fetchUsers(); }, [id]);

  // ── save edits ──
  const handleSave = async () => {
    if (!editName.trim()) return;
    setSaving(true);
    try {
      await fetch(`/api/groups/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editName.trim(),
          description: editDesc.trim(),
          editGroupInfo: editEGI,
          addMembers: editAM,
          sendMessages: editSM,
          approveNewMembers: editApprove,
        }),
      });
      setEditing(false);
      setActionMsg("Group updated successfully.");
      fetchGroup();
    } finally { setSaving(false); }
  };

  // ── add member ──
  const handleAddMember = async () => {
    if (!selectedUser) return;
    setAddingMember(true);
    setAddError("");
    setAddSuccess("");
    try {
      const res  = await fetch(`/api/groups/${id}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: selectedUser.id, role: addRole }),
      });
      const data = await res.json();
      if (data.success) {
        setAddSuccess(`${data.userName} added as ${addRole}.`);
        setSelectedUser(null);
        setMemberSearch("");
        setAddRole("MEMBER");
        fetchGroup();
      } else { setAddError(data.message || "Failed to add member"); }
    } catch { setAddError("Network error"); }
    finally { setAddingMember(false); }
  };

  // ── remove member ──
  const handleRemove = async (userId: string) => {
    setRemovingId(userId);
    try {
      await fetch(`/api/groups/${id}/members?userId=${userId}`, { method: "DELETE" });
      setMembers(prev => prev.filter(m => m.userId !== userId));
      setActionMsg("Member removed.");
    } finally { setRemovingId(null); }
  };

  // ── delete group ──
  const handleDelete = async () => {
    setDeleting(true);
    setDeleteError("");
    try {
      const res  = await fetch(`/api/groups/${id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        router.push("/groups");
      } else {
        setDeleteError(data.message || "Failed to delete group. Please try again.");
        setShowDelete(false);
      }
    } catch {
      setDeleteError("Network error — could not reach the server.");
      setShowDelete(false);
    } finally { setDeleting(false); }
  };

  const handleToggleSendTo = (opt: string) => {
    setMsgSendTo(prev => {
      if (opt === "All Members") {
        return ["All Members"];
      }
      const withoutAll = prev.filter(x => x !== "All Members");
      if (withoutAll.includes(opt)) {
        const remaining = withoutAll.filter(x => x !== opt);
        return remaining.length === 0 ? ["All Members"] : remaining;
      } else {
        return [...withoutAll, opt];
      }
    });
  };

  // ── send message ──
  const handleSendMessage = async () => {
    if (!msgSubject.trim() || !msgBody.trim()) return;
    setSendingMsg(true);
    try {
      const res = await fetch(`/api/groups/${id}/message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: msgSubject.trim(),
          message: msgBody.trim(),
          messageType: msgType,
          sendTo: msgSendTo,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setActionMsg(data.message || "Message broadcasted to group members successfully.");
        setShowMessageModal(false);
        setMsgSubject("");
        setMsgBody("");
        setMsgSendTo(["All Members"]);
      } else {
        setActionMsg(data.message || "Failed to send message.");
      }
    } catch {
      setActionMsg("Network error — could not send message.");
    } finally {
      setSendingMsg(false);
    }
  };

  // ── suspend group ──
  const handleSuspend = async () => {
    setSuspending(true);
    try {
      const res = await fetch(`/api/groups/${id}/suspend`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "suspend",
          period: suspendPeriod,
          reason: suspendReason,
          note: suspendNote.trim(),
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSuspensionInfo({
          isSuspended: true,
          period: suspendPeriod,
          reason: suspendReason,
          suspendedAt: new Date().toLocaleDateString("en-GB"),
          note: suspendNote.trim(),
        });
        setActionMsg(`Group suspended for ${suspendPeriod}.`);
        setShowSuspendModal(false);
        fetchGroup();
      } else {
        setActionMsg(data.message || "Failed to suspend group.");
      }
    } catch {
      setActionMsg("Network error while suspending group.");
    } finally {
      setSuspending(false);
    }
  };

  // ── unsuspend group ──
  const handleUnsuspend = async () => {
    if (!confirm("Are you sure you want to reactivate and unsuspend this group?")) return;
    setSuspending(true);
    try {
      const res = await fetch(`/api/groups/${id}/suspend`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "unsuspend" }),
      });
      const data = await res.json();
      if (data.success) {
        setSuspensionInfo(null);
        setActionMsg("Group reactivated successfully.");
        fetchGroup();
      } else {
        setActionMsg(data.message || "Failed to unsuspend group.");
      }
    } catch {
      setActionMsg("Network error while unsuspending group.");
    } finally {
      setSuspending(false);
    }
  };

  const filteredUsers = allUsers.filter(u =>
    !memberSearch ||
    u.name.toLowerCase().includes(memberSearch.toLowerCase()) ||
    u.email.toLowerCase().includes(memberSearch.toLowerCase())
  );

  const roleColors: Record<string, string> = {
    OWNER: "bg-[#7004DC] text-white",
    ADMIN: "bg-blue-100 text-blue-700",
    CAREGIVER: "bg-yellow-100 text-yellow-700",
    MENTOR: "bg-green-100 text-green-700",
    PROFESSIONAL: "bg-cyan-100 text-cyan-700",
    MEMBER: "bg-[#F3F3F3] text-[#4B4355]",
  };

  const roles = group?.subType === "CARE_CIRCLE" ? CARE_CIRCLE_ROLES : GENERAL_ROLES;

  const PermBadge = ({ value }: { value: string }) => (
    <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${value==="ALL_MEMBERS" ? "bg-green-100 text-green-700" : "bg-orange-100 text-orange-700"}`}>
      {value === "ALL_MEMBERS" ? "All Members" : "Admins Only"}
    </span>
  );

  if (loading) return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="w-10 h-10 border-4 border-[#7004DC] border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (notFound || !group) return (
    <div className="px-8 py-20 text-center">
      <p className="text-slate-400 font-semibold text-lg">Group not found.</p>
      <Link href="/groups" className="mt-4 inline-block text-sm font-bold text-[#7004DC] hover:underline">← Back to Groups</Link>
    </div>
  );

  return (
    <div className="px-8 py-8 space-y-6 max-w-[1200px]">
      {/* BREADCRUMB */}
      <div className="flex items-center gap-1.5 text-sm">
        <button onClick={() => router.back()} className="flex items-center gap-1.5 text-[#7D7387] hover:text-[#1A1C1C] transition">
          <ArrowLeft className="w-4 h-4" /> Groups
        </button>
        <ChevronRight className="w-3.5 h-3.5 text-[#7D7387]" />
        <span className="font-semibold text-[#1A1C1C]">{group.name}</span>
      </div>

      {/* ACTION MESSAGES */}
      {actionMsg && (
        <div className="flex items-center gap-2 bg-green-50 border border-green-200 text-green-700 rounded-xl px-4 py-3 text-sm font-semibold">
          <CheckCircle2 className="w-4 h-4" />{actionMsg}
          <button onClick={() => setActionMsg("")} className="ml-auto"><X className="w-4 h-4" /></button>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-[360px_1fr] gap-6">

        {/* ── LEFT: GROUP INFO ── */}
        <div className="space-y-5">

          {/* INFO CARD */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-start justify-between mb-5">
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${group.subType==="CARE_CIRCLE" ? "bg-pink-100 text-pink-600" : "bg-violet-100 text-violet-600"}`}>
                {group.subType === "CARE_CIRCLE" ? <Heart className="w-6 h-6" /> : <Users className="w-6 h-6" />}
              </div>
              <button onClick={() => setEditing(!editing)} className="h-9 px-3 rounded-xl border border-gray-200 text-sm font-semibold text-[#4B4355] hover:bg-gray-50 flex items-center gap-1.5 transition">
                {editing ? <><X className="w-3.5 h-3.5" /> Cancel</> : <><Pencil className="w-3.5 h-3.5" /> Edit</>}
              </button>
            </div>

            {editing ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Group Name</label>
                  <input value={editName} onChange={e => setEditName(e.target.value)} maxLength={200} className="w-full h-11 rounded-xl bg-[#F7F5FA] px-4 text-sm outline-none border border-transparent focus:border-[#8A38F5]" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Description</label>
                  <textarea value={editDesc} onChange={e => setEditDesc(e.target.value)} rows={3} maxLength={500} className="w-full rounded-xl bg-[#F7F5FA] px-4 py-3 text-sm outline-none border border-transparent focus:border-[#8A38F5] resize-none" />
                </div>
                <div className="space-y-3">
                  {([
                    { label: "Edit Group Info", val: editEGI, set: setEditEGI },
                    { label: "Add Members",     val: editAM,  set: setEditAM  },
                    { label: "Send Messages",   val: editSM,  set: setEditSM  },
                  ] as any[]).map(p => (
                    <div key={p.label}>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">{p.label}</p>
                      <div className="flex gap-2">
                        {(["ADMINS_ONLY","ALL_MEMBERS"] as const).map(opt => (
                          <button key={opt} onClick={() => p.set(opt)}
                            className={`flex-1 h-8 rounded-lg text-[10px] font-bold uppercase tracking-wide transition ${p.val===opt ? "bg-[#7004DC] text-white" : "bg-[#F3F3F3] text-[#4B4355]"}`}>
                            {opt === "ADMINS_ONLY" ? "Admins Only" : "All Members"}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Require Approval</p>
                    <button onClick={() => setEditApprove(v => !v)} className={`w-10 h-5 rounded-full relative transition ${editApprove ? "bg-[#7004DC]" : "bg-gray-200"}`}>
                      <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${editApprove ? "right-0.5" : "left-0.5"}`} />
                    </button>
                  </div>
                </div>
                <button onClick={handleSave} disabled={!editName.trim() || saving} className="w-full h-11 rounded-xl bg-[#7004DC] hover:bg-[#5c03b7] disabled:bg-violet-200 text-white font-bold text-sm flex items-center justify-center gap-2 transition">
                  {saving ? <><Loader2 className="w-4 h-4 animate-spin" />Saving...</> : <><Save className="w-4 h-4" />Save Changes</>}
                </button>
              </div>
            ) : (
              <>
                <h2 className="text-xl font-extrabold text-[#1A1C1C]">{group.name}</h2>
                <span className={`mt-1 inline-block px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${group.subType==="CARE_CIRCLE" ? "bg-pink-100 text-pink-700" : "bg-violet-100 text-violet-700"}`}>
                  {group.subType === "CARE_CIRCLE" ? "Care Circle" : "General Community"}
                </span>
                {group.description && <p className="text-sm text-[#7D7387] mt-3 leading-5">{group.description}</p>}

                <div className="mt-5 space-y-3 border-t border-gray-100 pt-4">
                  {[
                    { label: "Members",       value: `${group.memberCount} / ${group.maxMembers}` },
                    { label: "Created",       value: group.createdAt },
                    { label: "Last Updated",  value: group.updatedAt },
                  ].map(item => (
                    <div key={item.label} className="flex items-center justify-between">
                      <span className="text-xs text-[#7D7387]">{item.label}</span>
                      <span className="text-xs font-semibold text-[#1A1C1C]">{item.value}</span>
                    </div>
                  ))}
                </div>

                <div className="mt-4 space-y-2 border-t border-gray-100 pt-4">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">Permissions</p>
                  {[
                    { label: "Edit group info",  value: group.editGroupInfo },
                    { label: "Add members",      value: group.addMembers },
                    { label: "Send messages",    value: group.sendMessages },
                  ].map(p => (
                    <div key={p.label} className="flex items-center justify-between">
                      <span className="text-xs text-[#7D7387]">{p.label}</span>
                      <PermBadge value={p.value} />
                    </div>
                  ))}
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-[#7D7387]">Require approval</span>
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${group.approveNewMembers ? "bg-orange-100 text-orange-700" : "bg-green-100 text-green-700"}`}>
                      {group.approveNewMembers ? "Yes" : "No"}
                    </span>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* MOBILE VISIBILITY NOTE */}
          <div className="bg-violet-50 rounded-2xl p-4 border border-violet-100">
            <div className="flex items-start gap-2">
              <MessageSquare className="w-4 h-4 text-[#7004DC] shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold text-[#7004DC] mb-1">Visible on Mobile App</p>
                <p className="text-xs text-[#4B4355] leading-4">
                  {group.subType === "CARE_CIRCLE"
                    ? "This Care Circle appears in the Care Circles tab of the mobile app."
                    : "This group appears in the Community Groups tab of the mobile app. Users can request to join."}
                </p>
              </div>
            </div>
          </div>

          {/* ── SEND MESSAGE CARD ── */}
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-violet-100">
            <div className="flex items-center gap-2 mb-2">
              <MessageSquare className="w-4 h-4 text-[#7004DC]" />
              <h4 className="text-sm font-extrabold text-[#1A1C1C]">Group Communication</h4>
            </div>
            <p className="text-xs text-[#7D7387] mb-3">Broadcast announcements or important updates directly to all active members of this group.</p>
            <button
              onClick={() => { setShowMessageModal(true); setMsgSubject(""); setMsgBody(""); }}
              className="w-full h-10 rounded-xl bg-[#7004DC] hover:bg-[#5c03b7] text-white text-sm font-bold transition flex items-center justify-center gap-2 shadow-sm"
            >
              <Send className="w-4 h-4" /> Send Message to Group
            </button>
          </div>

          {/* ── SUSPENSION & WARNING CARD ── */}
          <div className={`rounded-2xl p-5 shadow-sm border ${suspensionInfo?.isSuspended ? "bg-amber-50/80 border-amber-200" : "bg-white border-orange-100"}`}>
            <div className="flex items-center gap-2 mb-2">
              <Ban className={`w-4 h-4 ${suspensionInfo?.isSuspended ? "text-amber-700" : "text-orange-600"}`} />
              <h4 className={`text-sm font-extrabold ${suspensionInfo?.isSuspended ? "text-amber-900" : "text-[#1A1C1C]"}`}>
                Group Suspension Controls
              </h4>
            </div>

            {/* LIVE WARNING NOTICE IF SUSPENDED */}
            {suspensionInfo?.isSuspended ? (
              <div className="space-y-3">
                <div className="bg-white/90 border border-amber-300 rounded-xl p-3.5 space-y-2">
                  <div className="flex items-center gap-2 text-amber-800 font-extrabold text-xs uppercase tracking-wider">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    Warning: Group Is Currently Suspended
                  </div>
                  <p className="text-xs text-amber-900 leading-5">
                    This group has been suspended for <strong className="underline decoration-amber-500 font-bold">{suspensionInfo.period}</strong>.
                  </p>
                  <p className="text-xs text-amber-800 bg-amber-100/70 rounded-lg p-2 font-medium">
                    <strong>Reason:</strong> {suspensionInfo.reason}
                    {suspensionInfo.note ? ` (${suspensionInfo.note})` : ""}
                  </p>
                  <p className="text-[11px] text-[#7D7387]">
                    While suspended, members cannot post new messages, create polls, or join the group.
                  </p>
                </div>

                <button
                  onClick={handleUnsuspend}
                  disabled={suspending}
                  className="w-full h-10 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-300 text-white text-sm font-bold transition flex items-center justify-center gap-2 shadow-sm"
                >
                  {suspending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  Reactivate / Unsuspend Group
                </button>
              </div>
            ) : (
              <div>
                <p className="text-xs text-[#7D7387] mb-3 leading-4">
                  Temporarily disable member interactions and posting with an explicit warning duration and reason.
                </p>
                <button
                  onClick={() => { setShowSuspendModal(true); setSuspendNote(""); }}
                  className="w-full h-10 rounded-xl border-2 border-orange-200 text-orange-600 hover:bg-orange-50 text-sm font-bold transition flex items-center justify-center gap-2"
                >
                  <Ban className="w-4 h-4" /> Suspend Group
                </button>
              </div>
            )}
          </div>

          {/* DANGER ZONE */}
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-red-100">
            <h4 className="text-sm font-extrabold text-red-600 mb-3">Danger Zone</h4>
            <p className="text-xs text-[#7D7387] mb-3">Deleting a group is irreversible. All messages and memberships will be lost.</p>
            {deleteError && (
              <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-600 rounded-xl px-3 py-2 text-xs font-semibold mb-3">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />{deleteError}
                <button onClick={() => setDeleteError("")} className="ml-auto"><X className="w-3.5 h-3.5" /></button>
              </div>
            )}
            {!showDelete ? (
              <button onClick={() => setShowDelete(true)} className="w-full h-10 rounded-xl border-2 border-red-200 text-red-600 text-sm font-bold hover:bg-red-50 transition flex items-center justify-center gap-2">
                <Trash2 className="w-4 h-4" /> Delete Group
              </button>
            ) : (
              <div className="space-y-3">
                <p className="text-xs font-semibold text-red-600 bg-red-50 rounded-xl p-3">Are you sure? This cannot be undone.</p>
                <div className="flex gap-2">
                  <button onClick={() => setShowDelete(false)} className="flex-1 h-10 rounded-xl border border-gray-200 text-[#4B4355] font-semibold text-sm hover:bg-gray-50">Cancel</button>
                  <button onClick={handleDelete} disabled={deleting} className="flex-1 h-10 rounded-xl bg-red-600 hover:bg-red-700 disabled:bg-red-300 text-white font-bold text-sm transition">
                    {deleting ? "Deleting..." : "Confirm Delete"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── RIGHT: MEMBERS ── */}
        <div className="space-y-5">

          {/* ADD MEMBER */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <h3 className="text-base font-extrabold text-[#1A1C1C] mb-4 flex items-center gap-2">
              <UserPlus className="w-4 h-4 text-[#7004DC]" /> Add Member
            </h3>

            {addSuccess && (
              <div className="flex items-center gap-2 bg-green-50 border border-green-200 text-green-700 rounded-xl px-4 py-2 text-sm font-semibold mb-3">
                <CheckCircle2 className="w-4 h-4" />{addSuccess}
              </div>
            )}
            {addError && (
              <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-600 rounded-xl px-4 py-2 text-sm font-semibold mb-3">
                <AlertTriangle className="w-4 h-4" />{addError}
              </div>
            )}

            <div className="flex gap-3 flex-wrap">
              {/* USER SEARCH */}
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#7D7387]" />
                <input
                  value={selectedUser ? selectedUser.name : memberSearch}
                  onChange={e => { if (selectedUser) { setSelectedUser(null); } setMemberSearch(e.target.value); setUserDropOpen(true); }}
                  onFocus={() => setUserDropOpen(true)}
                  placeholder="Search users..."
                  className="w-full h-11 rounded-xl bg-[#F7F5FA] pl-9 pr-4 text-sm outline-none border border-transparent focus:border-[#8A38F5]"
                />
                {userDropOpen && !selectedUser && filteredUsers.length > 0 && (
                  <div className="absolute top-12 left-0 right-0 bg-white border border-gray-100 rounded-xl shadow-lg z-50 max-h-48 overflow-y-auto">
                    {filteredUsers.slice(0, 20).filter(u => !members.find(m => m.userId === u.id)).map(user => (
                      <button key={user.id} className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-[#F7F5FA] text-left transition"
                        onClick={() => { setSelectedUser(user); setUserDropOpen(false); setMemberSearch(""); }}>
                        <div className="w-7 h-7 rounded-full bg-[#EDDCFF] text-[#7004DC] flex items-center justify-center text-xs font-bold shrink-0">
                          {user.name.split(" ").map(n=>n[0]).join("").slice(0,2)}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-[#1A1C1C] truncate">{user.name}</p>
                          <p className="text-xs text-[#7D7387] truncate">{user.email}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* ROLE SELECT */}
              <div className="relative shrink-0">
                <select value={addRole} onChange={e => setAddRole(e.target.value)} className="h-11 pl-4 pr-8 rounded-xl bg-[#F7F5FA] text-sm font-semibold outline-none border border-transparent focus:border-[#8A38F5] appearance-none">
                  {roles.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              </div>

              {/* ADD BUTTON */}
              <button
                onClick={handleAddMember}
                disabled={!selectedUser || addingMember}
                className="h-11 px-5 rounded-xl bg-[#7004DC] hover:bg-[#5c03b7] disabled:bg-violet-200 text-white font-bold text-sm flex items-center gap-2 transition shrink-0"
              >
                {addingMember ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                Add
              </button>
            </div>
          </div>

          {/* MEMBERS TABLE */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-base font-extrabold text-[#1A1C1C] flex items-center gap-2">
                <Users className="w-4 h-4 text-[#7004DC]" /> Members
                <span className="text-sm font-semibold text-[#7D7387]">({members.length})</span>
              </h3>
            </div>

            {members.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3 text-slate-400">
                <Users className="w-10 h-10 text-slate-300" />
                <p className="font-semibold text-sm">No members yet</p>
                <p className="text-xs text-center max-w-[240px]">Add members above. Users can also join from the mobile app.</p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-[2fr_1fr_1fr_80px] bg-[#F7F5FA] border-b border-gray-100">
                  {["Member","Role","Joined",""].map(h => (
                    <div key={h} className="px-5 py-3 text-[10px] font-bold uppercase tracking-[0.15em] text-[#7D7387]">{h}</div>
                  ))}
                </div>
                {members.map(m => (
                  <div key={m.id} className="grid grid-cols-[2fr_1fr_1fr_80px] items-center border-b border-gray-100 hover:bg-[#FAFAFA] transition">
                    {/* MEMBER */}
                    <div className="px-5 py-4 flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-[#EDDCFF] text-[#7004DC] flex items-center justify-center text-xs font-bold shrink-0">
                        {(m.name || "?").split(" ").map(n=>n[0]).join("").slice(0,2).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-sm text-[#1A1C1C] truncate">{m.name}</p>
                        <p className="text-xs text-[#7D7387] truncate">{m.email}</p>
                      </div>
                    </div>
                    {/* ROLE */}
                    <div className="px-5 py-4">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${roleColors[m.role] || "bg-[#F3F3F3] text-[#4B4355]"}`}>
                        {m.role}
                      </span>
                    </div>
                    {/* JOINED */}
                    <div className="px-5 py-4 text-xs text-[#7D7387]">{m.joinedAt}</div>
                    {/* REMOVE */}
                    <div className="px-5 py-4">
                      {m.role !== "OWNER" && (
                        <button
                          onClick={() => handleRemove(m.userId)}
                          disabled={removingId === m.userId}
                          title="Remove member"
                          className="w-8 h-8 rounded-lg bg-red-50 hover:bg-red-100 flex items-center justify-center text-red-500 transition"
                        >
                          {removingId === m.userId ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
      </div>

      {/* DROPDOWN BACKDROP */}
      {userDropOpen && (
        <div className="fixed inset-0 z-40" onClick={() => setUserDropOpen(false)} />
      )}

      {/* ── SEND MESSAGE TO GROUP MODAL ── */}
      {showMessageModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-[24px] w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-7 py-5 border-b border-gray-100">
              <div>
                <h3 className="text-xl font-extrabold text-[#1A1C1C]">Send Message to Group</h3>
                <p className="text-xs text-[#7D7387] mt-0.5">Notify {group.memberCount} members in <strong className="text-[#1A1C1C]">{group.name}</strong></p>
              </div>
              <button onClick={() => setShowMessageModal(false)} className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center transition"><X className="w-4 h-4 text-slate-500" /></button>
            </div>
            <div className="px-7 py-6 space-y-5">
              <div>
                <label className="block text-sm font-semibold text-[#1A1C1C] mb-2">Subject *</label>
                <input value={msgSubject} onChange={e => setMsgSubject(e.target.value)} placeholder="e.g. Important Community Update" className="w-full h-12 rounded-xl bg-[#F7F5FA] px-4 text-sm outline-none border border-transparent focus:border-[#8A38F5] transition" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-[#1A1C1C] mb-2">Message *</label>
                <textarea value={msgBody} onChange={e => setMsgBody(e.target.value)} rows={4} placeholder="Write announcement or notification to group members..." className="w-full rounded-xl bg-[#F7F5FA] px-4 py-3 text-sm outline-none border border-transparent focus:border-[#8A38F5] resize-none transition" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Message Type</p>
                  <div className="space-y-2">
                    {["General Update", "Urgent Alert", "Announcement"].map(type => (
                      <label key={type} className="flex items-center gap-2 cursor-pointer text-xs font-medium text-[#4B4355]">
                        <input type="radio" name="msgType" checked={msgType === type} onChange={() => setMsgType(type)} className="accent-[#7004DC]" />
                        {type}
                      </label>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Target Audience</p>
                  <div className="space-y-2">
                    {["All Members", "Active Members", "Moderators Only"].map(opt => (
                      <label key={opt} className="flex items-center gap-2 cursor-pointer text-xs font-medium text-[#4B4355]">
                        <input
                          type="checkbox"
                          checked={msgSendTo.includes(opt)}
                          onChange={() => handleToggleSendTo(opt)}
                          className="accent-[#7004DC] rounded"
                        />
                        {opt}
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              {/* LIVE MESSAGE PREVIEW */}
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">LIVE PREVIEW:</p>
                <div className="bg-[#F7F5FA] rounded-xl p-4 flex items-start gap-3 border border-[#E9E4F0]">
                  <div className="w-9 h-9 rounded-full bg-[#7004DC] flex items-center justify-center text-white shrink-0">📢</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-bold text-[#1A1C1C] truncate">{msgSubject || "Important Group Update"}</p>
                      <span className="text-[11px] text-slate-400 shrink-0">Just now</span>
                    </div>
                    <p className="text-xs text-[#7D7387] mt-1 line-clamp-3">{msgBody || "Type your message above to see how it will appear to members in the mobile app..."}</p>
                    <span className="inline-block mt-2 px-2 py-0.5 rounded bg-[#D2A500] text-[#4F3D00] text-[9px] font-bold uppercase">{msgType}</span>
                    <span className="ml-2 text-[10px] text-slate-400">via DigiAbility Admin</span>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-3 border-t border-gray-100">
                <button onClick={() => setShowMessageModal(false)} className="flex-1 h-12 rounded-xl border border-gray-200 text-[#4B4355] font-semibold text-sm hover:bg-gray-50 transition">Cancel</button>
                <button onClick={handleSendMessage} disabled={!msgSubject.trim() || !msgBody.trim() || sendingMsg} className="flex-1 h-12 rounded-xl bg-[#7004DC] hover:bg-[#5c03b7] disabled:bg-violet-200 text-white font-bold text-sm transition flex items-center justify-center gap-2">
                  {sendingMsg ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Send Message
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── SUSPEND GROUP MODAL WITH PERIOD & REASON WARNING ── */}
      {showSuspendModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-[24px] w-full max-w-md shadow-2xl overflow-hidden">
            <div className="px-7 py-6">
              <div className="flex items-center gap-2 mb-4">
                <AlertTriangle className="w-5 h-5 text-red-600" />
                <h3 className="text-xl font-extrabold text-red-600">Suspend Group</h3>
              </div>

              <div className="bg-[#F7F5FA] rounded-xl p-3.5 flex items-center gap-3 mb-4">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${group.subType === "CARE_CIRCLE" ? "bg-pink-100 text-pink-600" : "bg-violet-100 text-violet-600"}`}>
                  {group.subType === "CARE_CIRCLE" ? <Heart className="w-5 h-5" /> : <Users className="w-5 h-5" />}
                </div>
                <div>
                  <p className="font-bold text-sm text-[#1A1C1C]">{group.name}</p>
                  <p className="text-xs text-[#7D7387]">{group.memberCount} active members</p>
                </div>
              </div>

              {/* SUSPENSION DURATION SELECTION */}
              <div className="mb-4">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                  Suspension Period / Duration *
                </label>
                <div className="relative">
                  <select
                    value={suspendPeriod}
                    onChange={e => setSuspendPeriod(e.target.value)}
                    className="w-full h-11 rounded-xl border border-gray-200 px-4 text-sm font-semibold outline-none focus:border-red-400 bg-white appearance-none pr-8"
                  >
                    {["24 Hours", "3 Days", "7 Days", "14 Days", "30 Days", "90 Days", "Indefinite / Until Review"].map(p => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                </div>
              </div>

              {/* REASON SELECTION */}
              <div className="mb-4">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                  Reason for Suspension *
                </label>
                <div className="relative">
                  <select
                    value={suspendReason}
                    onChange={e => setSuspendReason(e.target.value)}
                    className="w-full h-11 rounded-xl border border-gray-200 px-4 text-sm font-semibold outline-none focus:border-red-400 bg-white appearance-none pr-8"
                  >
                    {[
                      "Community Guidelines Violation",
                      "Spam / Harassment",
                      "Inappropriate / Offensive Content",
                      "Misinformation",
                      "Terms of Service Violation",
                      "Inactive / Abandoned Group",
                      "Other",
                    ].map(r => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                </div>
              </div>

              {/* OPTIONAL NOTE */}
              <div className="mb-4">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                  Moderator Note (Optional)
                </label>
                <textarea
                  value={suspendNote}
                  onChange={e => setSuspendNote(e.target.value)}
                  rows={2}
                  placeholder="Additional context or investigation notes..."
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-xs outline-none focus:border-red-400 resize-none"
                />
              </div>

              {/* WARNING BOX PREVIEW */}
              <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-5">
                <p className="text-[11px] font-bold text-red-700 flex items-center gap-1.5 mb-1">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  Warning to Group:
                </p>
                <p className="text-xs text-red-800 leading-4">
                  "This group will be suspended for <strong>{suspendPeriod}</strong> due to <strong>{suspendReason}</strong>. Members cannot post new messages during this period."
                </p>
              </div>

              <div className="flex gap-3">
                <button onClick={() => setShowSuspendModal(false)} className="flex-1 h-11 rounded-xl border border-gray-200 text-[#4B4355] font-semibold text-sm hover:bg-gray-50 transition">
                  Cancel
                </button>
                <button onClick={handleSuspend} disabled={suspending} className="flex-1 h-11 rounded-xl bg-red-600 hover:bg-red-700 disabled:bg-red-300 text-white font-bold text-sm transition flex items-center justify-center gap-2">
                  {suspending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Ban className="w-4 h-4" />} Confirm Suspension
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
