"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Users, Heart, MessageCircle, RefreshCw, Search,
  Clock, Plus, X, ChevronDown, Loader2, CheckCircle2,
  AlertTriangle, Settings, MessageSquare, Ban, Send,
  ChevronLeft, ChevronRight, Crown,
} from "lucide-react";
import { DateRangePicker, isWithinDateRange } from "@/components/shared/DateRangePicker";

interface Group {
  id: string;
  name: string | null;
  description: string | null;
  subType: "GENERAL" | "CARE_CIRCLE" | null;
  createdAt: string;
  createdAtISO: string;
  lastMessageAt: string | null;
  lastMessageText: string | null;
  maxMembers: number;
  memberCount: string;
  sendMessages?: string;
  isSuspended?: boolean;
  suspendedUntil?: string | null;
  suspensionReason?: string | null;
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
// REUSABLE GROUP SECTION TABLE (PAGINATED 10/PAGE)
// ─────────────────────────────────────────────
function GroupSectionTable({
  title,
  badgeCount,
  description,
  icon,
  theme,
  groups,
  router,
  onOpenMessage,
  onOpenSuspend,
  onUnsuspend,
}: {
  title: string;
  badgeCount: number;
  description: string;
  icon: React.ReactNode;
  theme: "pink" | "violet";
  groups: Group[];
  router: any;
  onOpenMessage: (g: Group) => void;
  onOpenSuspend: (g: Group) => void;
  onUnsuspend: (g: Group) => void;
}) {
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 10;

  // Ensure latest created is first
  const sorted = [...groups].sort((a, b) => {
    const tA = new Date(a.createdAt).getTime() || 0;
    const tB = new Date(b.createdAt).getTime() || 0;
    return tB - tA;
  });

  const totalPages = Math.ceil(sorted.length / PAGE_SIZE) || 1;
  const safePage = Math.min(Math.max(1, currentPage), totalPages);
  const pageItems = sorted.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-[#ECE7F2] overflow-hidden w-full">
      {/* SECTION HEADER CARD */}
      <div className="px-6 py-5 border-b border-[#ECE7F2] flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white">
        <div className="flex items-center gap-3.5">
          <div className={`w-11 h-11 rounded-2xl flex items-center justify-center font-bold text-base shrink-0 border ${
            theme === "pink" ? "bg-pink-50 text-pink-600 border-pink-200" : "bg-[#F3EEFF] text-[#7004DC] border-[#E9D9FF]"
          }`}>
            {icon}
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h2 className="text-lg font-extrabold text-[#1A1C1C]">{title}</h2>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-extrabold border ${
                theme === "pink" ? "bg-pink-50 text-pink-700 border-pink-200" : "bg-violet-50 text-[#7004DC] border-violet-200"
              }`}>
                {badgeCount} {badgeCount === 1 ? "Group" : "Groups"}
              </span>
            </div>
            <p className="text-xs text-[#7D7387] mt-0.5">{description}</p>
          </div>
        </div>
      </div>

      {/* TABLE */}
      {sorted.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-slate-400">
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${theme === "pink" ? "bg-pink-50 text-pink-400" : "bg-violet-50 text-violet-400"}`}>
            {icon}
          </div>
          <p className="font-bold text-sm text-[#1A1C1C]">No {title.toLowerCase()} found</p>
          <p className="text-xs text-[#7D7387]">Try adjusting your search criteria or create a new group.</p>
        </div>
      ) : (
        <div className="w-full overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#F7F5FA] border-b border-[#ECE7F2]">
                <th className="px-6 py-4 text-[11px] font-extrabold uppercase tracking-wider text-[#7D7387]">
                  Group Details
                </th>
                <th className="px-6 py-4 text-[11px] font-extrabold uppercase tracking-wider text-[#7D7387] w-44">
                  Members & Limit
                </th>
                <th className="px-6 py-4 text-[11px] font-extrabold uppercase tracking-wider text-[#7D7387] w-52">
                  Last Activity
                </th>
                <th className="px-6 py-4 text-[11px] font-extrabold uppercase tracking-wider text-[#7D7387] w-32">
                  Status
                </th>
                <th className="px-6 py-4 text-[11px] font-extrabold uppercase tracking-wider text-[#7D7387] text-right pr-6 w-[250px]">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F0EDF5]">
              {pageItems.map(group => {
                const isCareCircle = group.subType === "CARE_CIRCLE";
                // Read the real suspension flag only. The old
                // `|| group.sendMessages === "ADMINS_ONLY"` fallback conflated
                // an announcement-only group with a suspended one.
                const isSuspended = !!group.isSuspended;
                return (
                  <tr
                    key={group.id}
                    className="hover:bg-[#FAFAFC] transition group"
                  >
                    {/* GROUP DETAILS */}
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3.5">
                        <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-bold text-sm shrink-0 border ${
                          isCareCircle ? "bg-pink-50 text-pink-600 border-pink-200" : "bg-violet-50 text-[#7004DC] border-violet-200"
                        }`}>
                          {isCareCircle ? <Heart className="w-5 h-5 text-pink-600" /> : <Users className="w-5 h-5 text-[#7004DC]" />}
                        </div>
                        <div className="min-w-0 max-w-md">
                          <p className="font-bold text-sm text-[#1A1C1C] truncate group-hover:text-[#7004DC] transition">
                            {group.name || "Unnamed Group"}
                          </p>
                          {group.description && (
                            <p className="text-xs text-[#7D7387] mt-0.5 line-clamp-1">
                              {group.description}
                            </p>
                          )}
                          <p className="text-[11px] text-slate-400 mt-1">
                            Created {group.createdAt}
                          </p>
                        </div>
                      </div>
                    </td>

                    {/* MEMBERS & LIMIT */}
                    <td className="px-6 py-4 align-middle whitespace-nowrap">
                      <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#F7F5FA] border border-slate-200/80 text-xs font-bold text-[#1A1C1C]">
                        <Users className="w-3.5 h-3.5 text-slate-400" />
                        <span>
                          {group.memberCount} <span className="text-slate-400 font-normal">/ {group.maxMembers}</span>
                        </span>
                      </div>
                    </td>

                    {/* LAST ACTIVITY */}
                    <td className="px-6 py-4 align-middle">
                      {group.lastMessageAt ? (
                        <div>
                          <div className="flex items-center gap-1.5 text-xs font-bold text-[#1A1C1C]">
                            <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span>{group.lastMessageAt}</span>
                          </div>
                          {group.lastMessageText && (
                            <p className="text-xs text-slate-400 mt-0.5 line-clamp-1 italic">
                              "{group.lastMessageText}"
                            </p>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400 font-medium">No messages yet</span>
                      )}
                    </td>

                    {/* STATUS */}
                    <td className="px-6 py-4 align-middle whitespace-nowrap">
                      {isSuspended ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-red-100 text-red-700">
                          <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                          Suspended
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-green-100 text-green-700">
                          <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                          Active
                        </span>
                      )}
                    </td>

                    {/* ACTIONS */}
                    <td className="px-6 py-4 align-middle text-right pr-6 whitespace-nowrap w-[250px]">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => router.push(`/groups/${group.id}`)}
                          className="h-8 w-[84px] rounded-xl bg-[#7004DC] hover:bg-[#5c03b7] text-white text-xs font-bold flex items-center justify-center gap-1.5 transition shadow-xs shrink-0"
                        >
                          <Settings className="w-3.5 h-3.5" /> Manage
                        </button>
                        <button
                          onClick={() => onOpenMessage(group)}
                          title="Broadcast message to members"
                          className="h-8 w-8 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-[#4B4355] flex items-center justify-center transition shadow-xs shrink-0"
                        >
                          <Send className="w-3.5 h-3.5" />
                        </button>
                        {isSuspended ? (
                          <button
                            onClick={() => onUnsuspend(group)}
                            className="h-8 w-[94px] rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-xs font-bold flex items-center justify-center gap-1 transition shrink-0"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" /> Reactivate
                          </button>
                        ) : (
                          <button
                            onClick={() => onOpenSuspend(group)}
                            className="h-8 w-[94px] rounded-xl bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 text-xs font-bold flex items-center justify-center gap-1 transition shrink-0"
                          >
                            <Ban className="w-3.5 h-3.5" /> Suspend
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* PAGINATION FOOTER */}
          <div className="px-6 py-4 border-t border-[#ECE7F2] bg-[#FAFAFC] flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-xs text-[#7D7387] font-semibold">
              Showing <span className="font-bold text-[#1A1C1C]">{(safePage - 1) * PAGE_SIZE + 1}</span> to{" "}
              <span className="font-bold text-[#1A1C1C]">{Math.min(safePage * PAGE_SIZE, sorted.length)}</span> of{" "}
              <span className="font-bold text-[#1A1C1C]">{sorted.length}</span> {title.toLowerCase()}
            </p>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={safePage === 1}
                className="h-9 px-3 rounded-xl border border-gray-200 bg-white text-xs font-bold text-[#4B4355] hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center gap-1"
              >
                <ChevronLeft className="w-4 h-4" /> Previous
              </button>
              {Array.from({ length: totalPages }, (_, idx) => idx + 1)
                .filter(p => p === 1 || p === totalPages || Math.abs(p - safePage) <= 1)
                .map((p, idx, arr) => {
                  const prev = arr[idx - 1];
                  return (
                    <span key={p} className="flex items-center">
                      {prev && p - prev > 1 && (
                        <span className="px-2 text-xs text-slate-400">...</span>
                      )}
                      <button
                        type="button"
                        onClick={() => setCurrentPage(p)}
                        className={`w-9 h-9 rounded-xl text-xs font-bold transition ${
                          safePage === p
                            ? theme === "pink"
                              ? "bg-pink-600 text-white shadow-sm"
                              : "bg-[#7004DC] text-white shadow-sm"
                            : "border border-gray-200 bg-white text-[#4B4355] hover:bg-gray-50"
                        }`}
                      >
                        {p}
                      </button>
                    </span>
                  );
                })}
              <button
                type="button"
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={safePage === totalPages}
                className="h-9 px-3 rounded-xl border border-gray-200 bg-white text-xs font-bold text-[#4B4355] hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center gap-1"
              >
                Next <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// PAGE
// ─────────────────────────────────────────────
export default function GroupsPage() {
  const router = useRouter();
  const [groups, setGroups]   = useState<Group[]>([]);
  const [stats, setStats]     = useState<GroupStats>({ totalGroups:"0", careCircles:"0", generalGroups:"0", directMessages:"0" });
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo]   = useState("");
  const [activeTab, setActiveTab] = useState<"CARE_CIRCLE" | "GENERAL">("CARE_CIRCLE");
  const [showCreate, setShowCreate] = useState(false);

  // Message modal state
  const [messageGroup, setMessageGroup] = useState<Group | null>(null);
  const [msgSubject, setMsgSubject] = useState("");
  const [msgBody, setMsgBody] = useState("");
  const [msgType, setMsgType] = useState("General Update");
  const [msgSendTo, setMsgSendTo] = useState<string[]>(["All Members"]);
  const [sendingMsg, setSendingMsg] = useState(false);
  const [actionMsg, setActionMsg] = useState("");
  const [actionError, setActionError] = useState("");

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

  const handleSendMessage = async () => {
    if (!messageGroup || !msgSubject.trim() || !msgBody.trim()) return;
    setSendingMsg(true);
    setActionMsg("");
    setActionError("");
    try {
      const res = await fetch(`/api/groups/${messageGroup.id}/message`, {
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
        setActionMsg(data.message || `Message broadcasted successfully to members of "${messageGroup.name}".`);
        setMessageGroup(null);
        setMsgSubject("");
        setMsgBody("");
        setMsgSendTo(["All Members"]);
      } else {
        setActionError(data.message || "Failed to send message.");
      }
    } catch {
      setActionError("Network error — could not send message.");
    } finally {
      setSendingMsg(false);
    }
  };

  // Suspend modal state
  const [suspendGroup, setSuspendGroup] = useState<Group | null>(null);
  const [suspendReason, setSuspendReason] = useState("Spam/Harassment");
  const [suspendPeriod, setSuspendPeriod] = useState("14 Days");
  const [suspendNote, setSuspendNote] = useState("");
  const [suspending, setSuspending] = useState(false);

  const handleConfirmSuspend = async () => {
    if (!suspendGroup) return;
    setSuspending(true);
    setActionMsg("");
    setActionError("");
    try {
      const res = await fetch(`/api/groups/${suspendGroup.id}/suspend`, {
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
        setActionMsg(data.message || `Group "${suspendGroup.name}" suspended successfully.`);
        setSuspendGroup(null);
        setSuspendNote("");
        fetchGroups();
      } else {
        setActionError(data.message || "Failed to suspend group.");
      }
    } catch {
      setActionError("Network error while suspending group.");
    } finally {
      setSuspending(false);
    }
  };

  const handleUnsuspendGroup = async (group: Group) => {
    if (!confirm(`Are you sure you want to reactivate and unsuspend "${group.name || "this group"}"?`)) return;
    setLoading(true);
    setActionMsg("");
    setActionError("");
    try {
      const res = await fetch(`/api/groups/${group.id}/suspend`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "unsuspend" }),
      });
      const data = await res.json();
      if (data.success) {
        setActionMsg(data.message || `Group "${group.name}" reactivated.`);
        fetchGroups();
      } else {
        setActionError(data.message || "Failed to unsuspend group.");
      }
    } catch {
      setActionError("Network error while unsuspending group.");
    } finally {
      setLoading(false);
    }
  };

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

  const searchFiltered = groups.filter(g => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (g.name || "").toLowerCase().includes(q) || (g.description || "").toLowerCase().includes(q);
  });

  const dateFiltered = searchFiltered.filter(g => isWithinDateRange(g.createdAtISO, dateFrom, dateTo));

  const careCircles = dateFiltered.filter(g => g.subType === "CARE_CIRCLE");
  const generalGroups = dateFiltered.filter(g => g.subType !== "CARE_CIRCLE");

  const statsCards = [
    { label: "Total Groups",    value: stats.totalGroups,    icon: <Users className="w-5 h-5" />,         bg: "bg-violet-50",  text: "text-violet-600" },
    { label: "Care Circles",    value: stats.careCircles,    icon: <Heart className="w-5 h-5" />,         bg: "bg-pink-50",    text: "text-pink-600"   },
    { label: "General Groups",  value: stats.generalGroups,  icon: <MessageCircle className="w-5 h-5" />, bg: "bg-blue-50",    text: "text-blue-600"   },
    { label: "Direct Messages", value: stats.directMessages, icon: <MessageCircle className="w-5 h-5" />, bg: "bg-green-50",   text: "text-green-600"  },
  ];

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 space-y-6 w-full max-w-full overflow-x-hidden">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#1A1C1C]">Groups & Communities</h1>
          <p className="text-xs sm:text-sm text-[#7D7387] mt-1">Monitor and manage community groups and care circles</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={fetchGroups} className="h-10 px-4 rounded-xl bg-[#F3F3F3] hover:bg-[#EBEBEB] transition flex items-center gap-2 text-sm font-semibold text-[#4B4355]">
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
          <button
            onClick={() => setShowCreate(true)}
            className="h-10 px-5 rounded-xl bg-[#D2A500] hover:bg-[#b89300] text-white font-bold text-sm flex items-center gap-2 shadow-md transition"
          >
            <Plus className="w-4 h-4" /> Create Group
          </button>
        </div>
      </div>

      {/* BANNER NOTIFICATION */}
      {actionMsg && (
        <div className="flex items-center justify-between p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl text-sm font-semibold">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>{actionMsg}</span>
          </div>
          <button onClick={() => setActionMsg("")} className="p-1 hover:bg-emerald-100 rounded-lg">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {actionError && (
        <div className="flex items-center justify-between p-4 bg-red-50 border border-red-200 text-red-800 rounded-2xl text-sm font-semibold">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-600 shrink-0" />
            <span>{actionError}</span>
          </div>
          <button onClick={() => setActionError("")} className="p-1 hover:bg-red-100 rounded-lg">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* STATS */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {statsCards.map((card, i) => (
          <div key={i} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex items-center gap-4">
            <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${card.bg} ${card.text} shrink-0`}>
              {card.icon}
            </div>
            <div>
              <p className="text-xs text-[#7D7387]">{card.label}</p>
              <h2 className="text-2xl font-extrabold text-[#1A1C1C] mt-0.5">{card.value}</h2>
            </div>
          </div>
        ))}
      </div>

      {/* 2 DISTINCT TABS & SEARCH BAR */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {/* TABS SWITCHER */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setActiveTab("CARE_CIRCLE")}
            className={`h-11 px-5 rounded-2xl text-sm font-extrabold flex items-center gap-2.5 transition shadow-xs ${
              activeTab === "CARE_CIRCLE"
                ? "bg-pink-600 text-white shadow-md shadow-pink-600/20"
                : "bg-white text-[#4B4355] border border-gray-200 hover:border-pink-200 hover:bg-pink-50/40"
            }`}
          >
            <Heart className={`w-4 h-4 ${activeTab === "CARE_CIRCLE" ? "text-white" : "text-pink-600"}`} />
            <span>Care Circles</span>
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-extrabold ${
              activeTab === "CARE_CIRCLE" ? "bg-white/20 text-white" : "bg-pink-100 text-pink-700"
            }`}>
              {careCircles.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("GENERAL")}
            className={`h-11 px-5 rounded-2xl text-sm font-extrabold flex items-center gap-2.5 transition shadow-xs ${
              activeTab === "GENERAL"
                ? "bg-[#7004DC] text-white shadow-md shadow-purple-600/20"
                : "bg-white text-[#4B4355] border border-gray-200 hover:border-purple-200 hover:bg-violet-50/40"
            }`}
          >
            <Users className={`w-4 h-4 ${activeTab === "GENERAL" ? "text-white" : "text-[#7004DC]"}`} />
            <span>General Community Groups</span>
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-extrabold ${
              activeTab === "GENERAL" ? "bg-white/20 text-white" : "bg-violet-100 text-[#7004DC]"
            }`}>
              {generalGroups.length}
            </span>
          </button>
        </div>

        {/* SEARCH + DATE RANGE */}
        <div className="flex items-center gap-3 flex-wrap justify-end">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#7D7387]" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={`Search ${activeTab === "CARE_CIRCLE" ? "care circles" : "community groups"}...`}
              className="w-full h-11 rounded-2xl bg-white pl-11 pr-4 text-sm outline-none border border-gray-200 focus:border-[#8A38F5] shadow-xs"
            />
          </div>

          <DateRangePicker
            from={dateFrom}
            to={dateTo}
            onFromChange={setDateFrom}
            onToChange={setDateTo}
            className="h-11 rounded-2xl bg-white text-sm outline-none border border-gray-200 focus:border-[#8A38F5] shadow-xs"
          />
        </div>
      </div>

      {/* ACTIVE TAB TABLE */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-10 h-10 border-4 border-[#7004DC] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : activeTab === "CARE_CIRCLE" ? (
        <GroupSectionTable
          title="Care Circles"
          badgeCount={careCircles.length}
          description="Specialized peer-support, family caregiver circles, and patient assistance networks"
          icon={<Heart className="w-5 h-5" />}
          theme="pink"
          groups={careCircles}
          router={router}
          onOpenMessage={g => { setMessageGroup(g); setMsgSubject(""); setMsgBody(""); }}
          onOpenSuspend={g => { setSuspendGroup(g); setSuspendPeriod("14 Days"); setSuspendNote(""); }}
          onUnsuspend={handleUnsuspendGroup}
        />
      ) : (
        <GroupSectionTable
          title="General Community Groups"
          badgeCount={generalGroups.length}
          description="Open public communities, regional meetup groups, and shared-interest discussion spaces"
          icon={<Users className="w-5 h-5" />}
          theme="violet"
          groups={generalGroups}
          router={router}
          onOpenMessage={g => { setMessageGroup(g); setMsgSubject(""); setMsgBody(""); }}
          onOpenSuspend={g => { setSuspendGroup(g); setSuspendPeriod("14 Days"); setSuspendNote(""); }}
          onUnsuspend={handleUnsuspendGroup}
        />
      )}

      {/* CREATE GROUP MODAL */}
      {showCreate && (
        <CreateGroupModal
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); fetchGroups(); }}
        />
      )}

      {/* SUSPEND GROUP MODAL */}
      {suspendGroup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-[24px] w-full max-w-md shadow-2xl overflow-hidden">
            <div className="px-7 py-6">
              <div className="flex items-center gap-2 mb-5">
                <AlertTriangle className="w-5 h-5 text-red-600" />
                <h3 className="text-xl font-extrabold text-red-600">Suspend This Group?</h3>
              </div>
              <div className="bg-[#F7F5FA] rounded-xl p-4 flex items-center gap-3 mb-5">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${suspendGroup.subType === "CARE_CIRCLE" ? "bg-pink-100 text-pink-600" : "bg-violet-100 text-violet-600"}`}>
                  {suspendGroup.subType === "CARE_CIRCLE" ? <Heart className="w-5 h-5" /> : <Users className="w-5 h-5" />}
                </div>
                <div>
                  <p className="font-bold text-sm text-[#1A1C1C]">{suspendGroup.name || "Unnamed Group"}</p>
                  <p className="text-xs text-[#7D7387]">{suspendGroup.memberCount} members</p>
                </div>
              </div>
              <div className="mb-5">
                <p className="text-sm font-semibold text-[#1A1C1C] mb-3">When you suspend a group:</p>
                <div className="space-y-2">
                  {["Members cannot post new messages","New members cannot join","Existing content remains visible","Moderators can still manage content","Group can be reactivated anytime"].map(item => (
                    <div key={item} className="flex items-center gap-2 text-sm text-[#4B4355]">
                      <CheckCircle2 className="w-4 h-4 text-slate-400 shrink-0" /> {item}
                    </div>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div>
                  <label className="block text-xs font-semibold text-[#1A1C1C] mb-1.5">Period</label>
                  <select value={suspendPeriod} onChange={e => setSuspendPeriod(e.target.value)} className="w-full h-10 rounded-xl border border-gray-200 px-3 text-xs outline-none focus:border-red-400 bg-white">
                    {["7 Days", "14 Days", "30 Days", "90 Days", "Permanent"].map(p => <option key={p}>{p}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#1A1C1C] mb-1.5">Reason</label>
                  <select value={suspendReason} onChange={e => setSuspendReason(e.target.value)} className="w-full h-10 rounded-xl border border-gray-200 px-3 text-xs outline-none focus:border-red-400 bg-white">
                    {["Spam/Harassment","Misinformation","Community Violation","Inactive","Other"].map(r => <option key={r}>{r}</option>)}
                  </select>
                </div>
              </div>
              <div className="mb-6">
                <label className="block text-xs font-semibold text-[#1A1C1C] mb-1.5">Add optional note</label>
                <textarea value={suspendNote} onChange={e => setSuspendNote(e.target.value)} rows={2} placeholder="Why is this group being suspended?" className="w-full rounded-xl border border-gray-200 px-3 py-2 text-xs outline-none focus:border-red-400 resize-none" />
              </div>
              <div className="flex gap-3">
                <button disabled={suspending} onClick={() => setSuspendGroup(null)} className="flex-1 h-11 rounded-xl border border-gray-200 text-[#4B4355] font-semibold text-xs hover:bg-gray-50">Cancel</button>
                <button disabled={suspending} onClick={handleConfirmSuspend} className="flex-1 h-11 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs transition flex items-center justify-center gap-2">
                  {suspending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Ban className="w-4 h-4" />} Suspend Group
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SEND MESSAGE TO GROUP MODAL */}
      {messageGroup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-[24px] w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-7 py-5 border-b border-gray-100">
              <div>
                <h3 className="text-xl font-extrabold text-[#1A1C1C]">Send Message to Group</h3>
                <p className="text-xs text-[#7D7387] mt-0.5">Notify {messageGroup.memberCount} members in <span className="font-bold text-[#1A1C1C]">{messageGroup.name}</span></p>
              </div>
              <button onClick={() => setMessageGroup(null)} className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center"><X className="w-4 h-4 text-slate-500" /></button>
            </div>
            <div className="px-7 py-6 space-y-5">
              <div>
                <label className="block text-sm font-semibold text-[#1A1C1C] mb-2">Subject</label>
                <input value={msgSubject} onChange={e => setMsgSubject(e.target.value)} placeholder="Enter message subject..." className="w-full h-12 rounded-xl bg-[#F7F5FA] px-4 text-sm outline-none border border-transparent focus:border-[#8A38F5]" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-[#1A1C1C] mb-2">Message</label>
                <textarea value={msgBody} onChange={e => setMsgBody(e.target.value)} rows={5} placeholder="Write your message to group members..." className="w-full rounded-xl bg-[#F7F5FA] px-4 py-3 text-sm outline-none border border-transparent focus:border-[#8A38F5] resize-none" />
              </div>
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <p className="text-sm font-semibold text-[#1A1C1C] mb-3">Message Type</p>
                  <div className="space-y-2">
                    {["General Update","Urgent Alert","Announcement"].map(type => (
                      <label key={type} className="flex items-center gap-2 cursor-pointer">
                        <div onClick={() => setMsgType(type)} className={`w-4 h-4 rounded-full border-2 flex items-center justify-center cursor-pointer ${msgType === type ? "border-[#7004DC]" : "border-gray-300"}`}>
                          {msgType === type && <div className="w-2 h-2 rounded-full bg-[#7004DC]" />}
                        </div>
                        <span className="text-sm text-[#4B4355]">{type}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-sm font-semibold text-[#1A1C1C] mb-3">Target Audience</p>
                  <div className="space-y-2">
                    {["All Members", "Active Members", "Moderators Only"].map(opt => (
                      <label key={opt} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={msgSendTo.includes(opt)}
                          onChange={() => handleToggleSendTo(opt)}
                          className="w-4 h-4 rounded accent-[#7004DC]"
                        />
                        <span className="text-sm text-[#4B4355]">{opt}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">MESSAGE PREVIEW:</p>
                <div className="bg-[#F7F5FA] rounded-xl p-4 flex items-start gap-3">
                  <div className="w-9 h-9 rounded-full bg-[#7004DC] flex items-center justify-center text-white shrink-0">📢</div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-bold text-[#1A1C1C]">{msgSubject || "Important Group Update"}</p>
                      <span className="text-xs text-slate-400">Just now</span>
                    </div>
                    <p className="text-xs text-[#7D7387] mt-1">{msgBody || "Preview your message here as you type..."}</p>
                    <span className="inline-block mt-2 px-2 py-0.5 rounded bg-[#D2A500] text-[#4F3D00] text-[9px] font-bold uppercase">{msgType.split(" ")[0]}</span>
                    <span className="ml-2 text-[10px] text-slate-400">via DigiAbility Admin</span>
                  </div>
                </div>
              </div>
              <div className="flex gap-3 pt-2 border-t border-gray-100">
                <button onClick={() => setMessageGroup(null)} className="flex-1 h-12 rounded-xl border border-gray-200 text-[#4B4355] font-semibold text-sm hover:bg-gray-50">Cancel</button>
                <button
                  onClick={handleSendMessage}
                  disabled={!msgSubject.trim() || !msgBody.trim() || sendingMsg}
                  className="flex-1 h-12 rounded-xl bg-[#7004DC] hover:bg-[#5c03b7] disabled:bg-violet-200 text-white font-bold text-sm transition flex items-center justify-center gap-2"
                >
                  {sendingMsg ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Send Message
                </button>
              </div>
            </div>
          </div>
        </div>
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
  // Every group must be created with exactly one designated group admin/owner.
  const [ownerId, setOwnerId] = useState<string | null>(null);

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
    // Deselecting the designated owner clears the designation — a group
    // can't be created with an owner who isn't actually a member.
    if (ownerId === user.id) setOwnerId(null);
  };

  const updateRole = (userId: string, role: string) => {
    setSelectedMembers(prev => prev.map(m => m.user.id === userId ? { ...m, role } : m));
    // Picking the group's admin role for the first time already reads as
    // "mark this person the group admin" — it shouldn't ALSO require
    // separately clicking the avatar to designate ownership (that's still
    // there for reassigning which admin is the true owner once more than
    // one is picked).
    const adminRoleForSubType = subType === "CARE_CIRCLE" ? "CAREGIVER" : "ADMIN";
    if (role === adminRoleForSubType && !ownerId) {
      setOwnerId(userId);
    } else if (role !== adminRoleForSubType && ownerId === userId) {
      // Demoting the current owner away from the admin role clears the
      // designation, so the "admin required" warning correctly reappears.
      setOwnerId(null);
    }
  };

  // Mirrors the server-side MAX_ADMINS_PER_GROUP cap for immediate feedback
  // instead of only finding out on submit.
  const MAX_ADMINS_PER_GROUP = 3;
  const adminRole = subType === "CARE_CIRCLE" ? "CAREGIVER" : "ADMIN";
  const adminCount = (ownerId ? 1 : 0) + selectedMembers.filter(m => m.user.id !== ownerId && m.role === adminRole).length;

  const handleCreate = async () => {
    if (!ownerId) { setError("Select a group admin before creating the group."); return; }
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
          ownerId,
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
  // Unfiltered browse view stays capped so the picker isn't an unbroken wall
  // of every user — searching (which filters the already-fetched allUsers,
  // so it's instant) surfaces everyone, uncapped.
  const MEMBER_BROWSE_LIMIT = 25;
  const displayedUsers = memberSearch ? filteredUsers : filteredUsers.slice(0, MEMBER_BROWSE_LIMIT);

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
                  {displayedUsers.map(user => {
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
                  {!memberSearch && filteredUsers.length > MEMBER_BROWSE_LIMIT && (
                    <p className="text-xs text-slate-400 text-center py-2">
                      Showing {MEMBER_BROWSE_LIMIT} of {filteredUsers.length} — search by name or email to find someone else
                    </p>
                  )}
                </div>
              )}

              {/* SELECTED MEMBERS + ROLE ASSIGNMENT */}
              {selectedMembers.length > 0 && (
                <div>
                  <p className="text-xs font-extrabold uppercase tracking-[0.15em] text-slate-500 mb-1">Selected ({selectedMembers.length}) — Assign Roles</p>
                  <p className="text-xs text-slate-500 mb-3">
                    {ownerId ? (
                      <>Group admin: <span className="font-bold text-[#7004DC]">{selectedMembers.find(m => m.user.id === ownerId)?.user.name}</span></>
                    ) : (
                      <span className="text-amber-600 font-semibold">A group admin is required — mark one member below.</span>
                    )}
                    {" "}· {adminCount}/{MAX_ADMINS_PER_GROUP} admins
                  </p>
                  <div className="space-y-2">
                    {selectedMembers.map(({ user, role }) => {
                      const isOwner = ownerId === user.id;
                      const wouldExceedCap = role !== adminRole && !isOwner && adminCount >= MAX_ADMINS_PER_GROUP;
                      return (
                        <div key={user.id} className={`flex items-center gap-3 rounded-xl p-3 ${isOwner ? "bg-violet-50 border border-[#7004DC]" : "bg-[#F7F5FA]"}`}>
                          <button
                            type="button"
                            onClick={() => setOwnerId(user.id)}
                            title="Set as group admin"
                            className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition ${isOwner ? "bg-[#7004DC] text-white" : "bg-[#EDDCFF] text-[#7004DC] hover:bg-[#DEC4FA]"}`}
                          >
                            {isOwner ? <Crown className="w-4 h-4" /> : user.name.split(" ").map(n=>n[0]).join("").slice(0,2).toUpperCase()}
                          </button>
                          <p className="text-sm font-semibold text-[#1A1C1C] flex-1 truncate">
                            {user.name}
                            {isOwner && <span className="ml-2 text-[10px] font-extrabold uppercase text-[#7004DC]">Group Admin</span>}
                          </p>
                          {!isOwner && (
                            <div className="relative shrink-0">
                              <select
                                value={role}
                                onChange={e => updateRole(user.id, e.target.value)}
                                disabled={wouldExceedCap && role !== adminRole}
                                title={wouldExceedCap ? `Already at the ${MAX_ADMINS_PER_GROUP}-admin limit` : undefined}
                                className="h-8 pl-3 pr-7 rounded-lg bg-white border border-gray-200 text-xs font-bold outline-none focus:border-[#8A38F5] appearance-none disabled:opacity-50"
                              >
                                {roles.map(r => (
                                  <option key={r} value={r} disabled={r === adminRole && wouldExceedCap}>{r}</option>
                                ))}
                              </select>
                              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400 pointer-events-none" />
                            </div>
                          )}
                          <button onClick={() => toggleMember(user)} className="w-6 h-6 rounded-full hover:bg-red-100 flex items-center justify-center text-slate-400 hover:text-red-500 transition">
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      );
                    })}
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
            <button onClick={handleCreate} disabled={submitting || !ownerId} title={!ownerId ? "Select a group admin first" : undefined} className="h-11 px-6 rounded-xl bg-[#D2A500] hover:bg-[#b89300] disabled:bg-yellow-200 text-white font-bold text-sm flex items-center gap-2 transition">
              {submitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Creating...</> : "Create Group"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
