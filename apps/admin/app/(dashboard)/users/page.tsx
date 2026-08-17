"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect, useCallback } from "react";
import {
  Search,
  ChevronDown,
  Eye,
  Users,
  UserCheck,
  UserX,
  ShieldAlert,
  SlidersHorizontal,
  Trash2,
  X,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  ShieldOff,
  ShieldCheck,
} from "lucide-react";

const PAGE_SIZE = 25;

interface User {
  id: string;
  name: string;
  email: string;
  username?: string;
  roles: string[];
  joined: string;
  joinedRaw: string;
  location: string;
  disabilityType: string;
  status: string;
  isSuspended?: boolean;
}

// How many days back to allow
const DATE_FILTER_DAYS: Record<string, number | null> = {
  "Any time": null,
  "Last 7 days": 7,
  "Last 30 days": 30,
  "Last 3 months": 90,
  "Last year": 365,
};

export default function UserManagementPage() {
  const router = useRouter();

  const [usersList, setUsersList] = useState<User[]>([]);
  const [stats, setStats] = useState({ total: "0", active: "0", inactive: "0", suspended: "0" });
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRole, setSelectedRole] = useState("ALL");
  const [selectedStatus, setSelectedStatus] = useState("ALL");
  const [roleDropdownOpen, setRoleDropdownOpen] = useState(false);
  const [statusDropdownOpen, setStatusDropdownOpen] = useState(false);
  const [dateDropdownOpen, setDateDropdownOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState("Any time");
  const [currentPage, setCurrentPage] = useState(1);
  
  // Delete state
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);
  const [deleting, setDeleting] = useState(false);
  
  // Suspend state
  const [suspendTarget, setSuspendTarget] = useState<User | null>(null);
  const [suspending, setSuspending] = useState(false);

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch("/api/users");
      const data = await res.json();
      if (data.success) {
        setUsersList(data.users);
        setStats(data.stats);
      }
    } catch (err) {
      console.error("Error loading users:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  // Reset to page 1 whenever filters change
  useEffect(() => { setCurrentPage(1); }, [searchQuery, selectedRole, selectedStatus, selectedDate]);

  // ──────────────────────────────────────────
  // FILTERING
  // ──────────────────────────────────────────
  const filteredUsers = usersList.filter((user) => {
    const s = searchQuery.toLowerCase();
    const safeName = (user.name || "").toLowerCase();
    const matchSearch =
      safeName.includes(s) ||
      (user.username || "").toLowerCase().includes(s) ||
      (user.email || "").toLowerCase().includes(s) ||
      (user.id || "").toLowerCase().includes(s) ||
      (user.location || "").toLowerCase().includes(s);

    const matchRole = selectedRole === "ALL" || (user.roles && user.roles.includes(selectedRole));
    const matchStatus = selectedStatus === "ALL" || user.status === selectedStatus;

    // Date filter
    let matchDate = true;
    const days = DATE_FILTER_DAYS[selectedDate];
    if (days !== null && days !== undefined && user.joinedRaw) {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - days);
      matchDate = new Date(user.joinedRaw) >= cutoff;
    }

    return matchSearch && matchRole && matchStatus && matchDate;
  });

  // ──────────────────────────────────────────
  // PAGINATION
  // ──────────────────────────────────────────
  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedUsers = filteredUsers.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const pageNumbers = (() => {
    const pages: (number | "...")[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (safePage > 3) pages.push("...");
      for (let i = Math.max(2, safePage - 1); i <= Math.min(totalPages - 1, safePage + 1); i++) pages.push(i);
      if (safePage < totalPages - 2) pages.push("...");
      pages.push(totalPages);
    }
    return pages;
  })();

  // ──────────────────────────────────────────
  // DELETE  (soft-delete persisted to DB)
  // ──────────────────────────────────────────
  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/users/${deleteTarget.id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        setUsersList((prev) => prev.filter((u) => u.id !== deleteTarget.id));
        setDeleteTarget(null);
        fetchUsers();
      } else {
        alert(data.message || "Failed to delete user");
      }
    } catch (err) {
      console.error("Delete failed:", err);
      alert("Failed to delete user. Please try again.");
    } finally {
      setDeleting(false);
    }
  };

  // ──────────────────────────────────────────
  // SUSPEND / UNSUSPEND TOGGLE
  // ──────────────────────────────────────────
  const handleSuspendToggle = async () => {
    if (!suspendTarget) return;
    setSuspending(true);
    const action = suspendTarget.status === "Suspended" ? "unsuspend" : "suspend";
    try {
      const res = await fetch("/api/moderation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: action === "unsuspend" ? "unsuspend" : "ban",
          userId: suspendTarget.id,
          reason: "Admin dashboard toggle",
          duration: "Permanent",
        }),
      });
      const data = await res.json();
      if (data.success) {
        setUsersList((prev) =>
          prev.map((u) =>
            u.id === suspendTarget.id
              ? { ...u, status: action === "suspend" ? "Suspended" : "Active", isSuspended: action === "suspend" }
              : u
          )
        );
      }
    } catch (err) {
      console.error("Suspend toggle failed:", err);
    } finally {
      setSuspending(false);
      setSuspendTarget(null);
      fetchUsers();
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-10 h-10 border-4 border-[#7004DC] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const activeCount = Number(stats.active.replace(/,/g, ""));
  const totalCount = Number(stats.total.replace(/,/g, ""));
  const activePct = totalCount > 0 ? ((activeCount / totalCount) * 100).toFixed(1) : "0";

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 space-y-6 w-full max-w-full overflow-x-hidden">

      {/* HEADER */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-[#7004DC] tracking-tight">Users Management</h1>
          <p className="text-xs text-[#7D7387] mt-0.5">Manage community members, roles and access permissions</p>
        </div>
      </div>

      {/* STATS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 w-full">
        <div className="bg-white rounded-xl p-4 sm:p-5 shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 mb-1">
            <Users className="w-4 h-4 text-[#7D7387]" />
            <p className="text-xs sm:text-sm text-[#7D7387]">Total Users</p>
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-[#1A1C1C] mt-1">{stats.total}</h2>
        </div>
        <div className="bg-white rounded-xl p-4 sm:p-5 shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 mb-1">
            <UserCheck className="w-4 h-4 text-green-600" />
            <p className="text-xs sm:text-sm text-[#7D7387]">Active</p>
          </div>
          <div className="flex items-end gap-2 mt-1">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-green-600">{stats.active}</h2>
            <span className="text-xs font-bold text-green-600 mb-1">{activePct}%</span>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 sm:p-5 shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 mb-1">
            <ShieldAlert className="w-4 h-4 text-slate-400" />
            <p className="text-xs sm:text-sm text-[#7D7387]">Inactive</p>
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-400 mt-1">{stats.inactive}</h2>
        </div>
        <div className="bg-white rounded-xl p-4 sm:p-5 shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 mb-1">
            <UserX className="w-4 h-4 text-red-600" />
            <p className="text-xs sm:text-sm text-[#7D7387]">Suspended</p>
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-red-600 mt-1">{stats.suspended}</h2>
        </div>
      </div>

      {/* FILTER BAR */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-3.5 sm:p-4 flex flex-wrap items-center gap-3 w-full">
        {/* SEARCH */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#7D7387]" />
          <input
            type="text"
            placeholder="Search by name, email, or username..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-10 rounded-lg bg-[#F7F5FA] pl-10 pr-4 text-sm outline-none border border-transparent focus:border-[#8A38F5]"
          />
        </div>

        {/* ROLE */}
        <div className="relative z-30">
          <button
            onClick={() => { setRoleDropdownOpen(!roleDropdownOpen); setStatusDropdownOpen(false); setDateDropdownOpen(false); }}
            className="h-10 px-3.5 bg-[#F7F5FA] rounded-lg flex items-center gap-2 text-xs sm:text-sm font-medium text-[#1A1C1C] min-w-[120px] border border-transparent hover:border-[#CEC2D8]"
          >
            <span>Role: {selectedRole === "ALL" ? "All" : selectedRole}</span>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 ml-auto" />
          </button>
          {roleDropdownOpen && (
            <div className="absolute top-11 left-0 w-44 bg-white border border-gray-100 rounded-xl shadow-lg z-50 py-1">
              {["ALL", "PWD", "CAREGIVER", "THERAPIST", "NGO", "VOLUNTEER", "STUDENT"].map((r) => (
                <button
                  key={r}
                  onClick={() => { setSelectedRole(r); setRoleDropdownOpen(false); }}
                  className={`w-full text-left px-4 py-2 text-xs font-semibold hover:bg-[#F3F3F3] ${selectedRole === r ? "text-[#7004DC] font-bold" : "text-[#4B4355]"}`}
                >
                  {r === "ALL" ? "All Roles" : r}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* STATUS */}
        <div className="relative z-30">
          <button
            onClick={() => { setStatusDropdownOpen(!statusDropdownOpen); setRoleDropdownOpen(false); setDateDropdownOpen(false); }}
            className="h-10 px-3.5 bg-[#F7F5FA] rounded-lg flex items-center gap-2 text-xs sm:text-sm font-medium text-[#1A1C1C] min-w-[120px] border border-transparent hover:border-[#CEC2D8]"
          >
            <span>Status: {selectedStatus === "ALL" ? "All" : selectedStatus}</span>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 ml-auto" />
          </button>
          {statusDropdownOpen && (
            <div className="absolute top-11 left-0 w-44 bg-white border border-gray-100 rounded-xl shadow-lg z-50 py-1">
              {["ALL", "Active", "Inactive", "Suspended"].map((s) => (
                <button
                  key={s}
                  onClick={() => { setSelectedStatus(s); setStatusDropdownOpen(false); }}
                  className={`w-full text-left px-4 py-2 text-xs font-semibold hover:bg-[#F3F3F3] ${selectedStatus === s ? "text-[#7004DC] font-bold" : "text-[#4B4355]"}`}
                >
                  {s === "ALL" ? "All Statuses" : s}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* DATE JOINED */}
        <div className="relative z-30">
          <button
            onClick={() => { setDateDropdownOpen(!dateDropdownOpen); setRoleDropdownOpen(false); setStatusDropdownOpen(false); }}
            className="h-10 px-3.5 bg-[#F7F5FA] rounded-lg flex items-center gap-2 text-xs sm:text-sm font-medium text-[#1A1C1C] min-w-[140px] border border-transparent hover:border-[#CEC2D8]"
          >
            <span>Joined: {selectedDate}</span>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 ml-auto" />
          </button>
          {dateDropdownOpen && (
            <div className="absolute top-11 left-0 w-48 bg-white border border-gray-100 rounded-xl shadow-lg z-50 py-1">
              {Object.keys(DATE_FILTER_DAYS).map((d) => (
                <button
                  key={d}
                  onClick={() => { setSelectedDate(d); setDateDropdownOpen(false); }}
                  className={`w-full text-left px-4 py-2 text-xs font-semibold hover:bg-[#F3F3F3] ${selectedDate === d ? "text-[#7004DC] font-bold" : "text-[#4B4355]"}`}
                >
                  {d}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* CLEAR FILTERS */}
        {(selectedRole !== "ALL" || selectedStatus !== "ALL" || selectedDate !== "Any time" || searchQuery) && (
          <button
            onClick={() => { setSelectedRole("ALL"); setSelectedStatus("ALL"); setSelectedDate("Any time"); setSearchQuery(""); }}
            className="h-10 px-3 rounded-lg bg-red-50 text-red-500 hover:bg-red-100 text-xs font-bold flex items-center gap-1.5 transition"
          >
            <X className="w-3.5 h-3.5" /> Clear
          </button>
        )}
      </div>

      {/* TABLE */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden w-full">
        <div className="overflow-x-auto w-full">
          <table className="w-full text-left border-collapse min-w-[740px] lg:min-w-full">
            <thead>
              <tr className="bg-[#F7F5FA] border-b border-gray-100 text-[10px] font-bold uppercase tracking-[0.15em] text-[#7D7387]">
                <th className="px-4 py-3.5 w-12 text-center">#</th>
                <th className="px-4 py-3.5 min-w-[180px]">USER</th>
                <th className="px-4 py-3.5 w-24">ROLE</th>
                <th className="px-4 py-3.5 min-w-[130px]">DISABILITY TYPE</th>
                <th className="px-4 py-3.5 min-w-[110px]">CITY</th>
                <th className="px-4 py-3.5 min-w-[110px]">JOINED DATE</th>
                <th className="px-4 py-3.5 w-28">STATUS</th>
                <th className="px-4 py-3.5 w-20 text-center">ACTIONS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {paginatedUsers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="h-48 text-center text-[#7D7387] font-semibold text-sm">
                    No users found matching current filters.
                  </td>
                </tr>
              ) : (
                paginatedUsers.map((user, index) => {
                  const serialNo = (safePage - 1) * PAGE_SIZE + index + 1;
                  return (
                    <tr
                      key={user.id}
                      className="hover:bg-[#FAFAFA] transition text-sm"
                    >
                      {/* SERIAL NUMBER */}
                      <td className="px-4 py-3.5 text-center text-xs font-semibold text-[#7D7387]">
                        {serialNo}
                      </td>

                      {/* USER */}
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
                            user.status === "Suspended" ? "bg-red-100 text-red-500" : "bg-[#EDDCFF] text-[#7004DC]"
                          }`}>
                            {(user.name || "?").split(" ").filter(Boolean).map((n: string) => n[0]).join("").slice(0, 2).toUpperCase() || "?"}
                          </div>
                          <div className="min-w-0 max-w-[220px]">
                            <p className="font-bold text-sm text-[#1A1C1C] truncate">{user.name}</p>
                            <p className="text-xs text-[#7D7387] truncate">{user.username || user.email}</p>
                          </div>
                        </div>
                      </td>

                      {/* ROLE */}
                      <td className="px-4 py-3.5">
                        {user.roles && user.roles.length > 0 ? (
                          <span className={`inline-block px-2.5 py-0.5 rounded-md text-[10px] font-bold uppercase ${user.roles[0] === "NGO" ? "bg-gray-100 text-slate-600" : "bg-[#EDDCFF] text-[#7004DC]"}`}>
                            {user.roles[0]}
                          </span>
                        ) : (
                          <span className="inline-block px-2.5 py-0.5 rounded-md text-[10px] font-bold uppercase bg-slate-100 text-slate-500">USER</span>
                        )}
                      </td>

                      {/* DISABILITY TYPE */}
                      <td className="px-4 py-3.5 text-sm text-[#4B4355]">
                        {user.disabilityType && user.disabilityType !== "N/A" ? (
                          <span className="truncate block max-w-[150px]">{user.disabilityType}</span>
                        ) : (
                          <span className="text-slate-400">N/A</span>
                        )}
                      </td>

                      {/* CITY */}
                      <td className="px-4 py-3.5 text-sm text-[#4B4355]">
                        <span className="truncate block max-w-[120px]">{user.location}</span>
                      </td>

                      {/* JOINED DATE */}
                      <td className="px-4 py-3.5 text-sm text-[#4B4355] whitespace-nowrap">
                        {user.joined}
                      </td>

                      {/* STATUS */}
                      <td className="px-4 py-3.5">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                          user.status === "Active" ? "bg-green-100 text-green-700" :
                          user.status === "Suspended" ? "bg-red-100 text-red-700" :
                          "bg-gray-100 text-gray-500"
                        }`}>
                          <div className={`w-1.5 h-1.5 rounded-full ${
                            user.status === "Active" ? "bg-green-600" :
                            user.status === "Suspended" ? "bg-red-600" : "bg-gray-400"
                          }`} />
                          {user.status}
                        </span>
                      </td>

                      {/* ACTIONS */}
                      <td className="px-4 py-3.5 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => router.push(`/users/${user.id}`)}
                            title="View profile"
                            className="w-8 h-8 rounded-lg hover:bg-violet-50 flex items-center justify-center text-[#8A38F5] transition"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => {
                              if (window.confirm(`Are you sure you want to delete user "${user.name}"?`)) {
                                setDeleteTarget(user);
                              }
                            }}
                            title="Delete user"
                            className="w-8 h-8 rounded-lg hover:bg-red-50 flex items-center justify-center text-red-300 hover:text-red-500 transition"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* FOOTER / PAGINATION */}
        <div className="bg-[#F7F5FA] px-5 py-3.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-t border-gray-100">
          <div className="flex items-center gap-3 text-xs sm:text-sm text-[#7D7387]">
            <span>
              Showing {filteredUsers.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, filteredUsers.length)} of {filteredUsers.length} users
              {filteredUsers.length !== usersList.length && ` (filtered from ${usersList.length})`}
            </span>
          </div>
          {totalPages > 1 && (
            <div className="flex items-center gap-1.5 self-center sm:self-auto">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={safePage === 1}
                className="w-8 h-8 rounded-lg bg-white border border-gray-200 text-slate-400 flex items-center justify-center disabled:opacity-40"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              {pageNumbers.map((p, i) =>
                p === "..." ? (
                  <span key={`ellipsis-${i}`} className="text-slate-400 text-sm px-1">...</span>
                ) : (
                  <button
                    key={p}
                    onClick={() => setCurrentPage(p as number)}
                    className={`w-8 h-8 rounded-lg text-xs font-bold transition ${safePage === p
                      ? "bg-[#7004DC] text-white"
                      : "bg-white border border-gray-200 text-slate-500 hover:bg-[#F3F0FF]"
                      }`}
                  >
                    {p}
                  </button>
                )
              )}
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={safePage === totalPages}
                className="w-8 h-8 rounded-lg bg-white border border-gray-200 text-slate-400 flex items-center justify-center disabled:opacity-40"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* DROPDOWN BACKDROP */}
      {(roleDropdownOpen || statusDropdownOpen || dateDropdownOpen) && (
        <div
          className="fixed inset-0 z-20"
          onClick={() => { setRoleDropdownOpen(false); setStatusDropdownOpen(false); setDateDropdownOpen(false); }}
        />
      )}

      {/* ── DELETE CONFIRMATION MODAL ── */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-[24px] w-full max-w-sm shadow-2xl overflow-hidden">
            <div className="flex flex-col items-center px-8 pt-8 pb-4 text-center">
              <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mb-4">
                <Trash2 className="w-7 h-7 text-red-600" />
              </div>
              <h3 className="text-xl font-extrabold text-[#1A1C1C]">Delete User?</h3>
              <p className="mt-2 text-sm text-[#7D7387] leading-relaxed">
                Are you sure you want to permanently delete{" "}
                <span className="font-bold text-[#1A1C1C]">{deleteTarget.name}</span>?
                <br />
                This action <span className="font-bold text-red-600">cannot be undone</span>.
              </p>
            </div>

            <div className="mx-8 mb-5 bg-red-50 border border-red-100 rounded-xl p-3">
              <p className="text-xs font-bold text-red-600 flex items-center gap-1 mb-1.5">
                <AlertTriangle className="w-3.5 h-3.5" /> What will happen:
              </p>
              {["All personal information will be erased", "User will be permanently locked out", "Forum posts will be anonymised"].map(e => (
                <p key={e} className="text-xs text-red-500 font-medium">• {e}</p>
              ))}
            </div>

            <div className="flex gap-3 px-8 pb-8">
              <button
                onClick={() => setDeleteTarget(null)}
                className="flex-1 h-12 rounded-xl border border-gray-200 text-[#4B4355] font-semibold text-sm hover:bg-gray-50 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 h-12 rounded-xl bg-red-600 hover:bg-red-700 disabled:bg-red-300 text-white font-bold text-sm transition"
              >
                {deleting ? "Deleting..." : "Yes, Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── SUSPEND / UNSUSPEND CONFIRMATION MODAL ── */}
      {suspendTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-[24px] w-full max-w-sm shadow-2xl overflow-hidden">
            <div className="flex flex-col items-center px-8 pt-8 pb-4 text-center">
              <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-4 ${
                suspendTarget.status === "Suspended" ? "bg-green-100" : "bg-orange-100"
              }`}>
                {suspendTarget.status === "Suspended"
                  ? <ShieldCheck className="w-7 h-7 text-green-600" />
                  : <ShieldOff className="w-7 h-7 text-orange-500" />
                }
              </div>
              <h3 className="text-xl font-extrabold text-[#1A1C1C]">
                {suspendTarget.status === "Suspended" ? "Unsuspend User?" : "Suspend User?"}
              </h3>
              <p className="mt-2 text-sm text-[#7D7387] leading-relaxed">
                {suspendTarget.status === "Suspended"
                  ? <>
                      Restore access for{" "}
                      <span className="font-bold text-[#1A1C1C]">{suspendTarget.name}</span>?
                      {" "}They will be able to log in again.
                    </>
                  : <>
                      Suspend{" "}
                      <span className="font-bold text-[#1A1C1C]">{suspendTarget.name}</span>?
                      {" "}They will be locked out of the platform immediately.
                    </>
                }
              </p>
            </div>

            <div className="flex gap-3 px-8 pb-8 pt-4">
              <button
                onClick={() => setSuspendTarget(null)}
                className="flex-1 h-12 rounded-xl border border-gray-200 text-[#4B4355] font-semibold text-sm hover:bg-gray-50 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleSuspendToggle}
                disabled={suspending}
                className={`flex-1 h-12 rounded-xl font-bold text-sm text-white transition disabled:opacity-60 ${
                  suspendTarget.status === "Suspended"
                    ? "bg-green-600 hover:bg-green-700"
                    : "bg-orange-500 hover:bg-orange-600"
                }`}
              >
                {suspending
                  ? (suspendTarget.status === "Suspended" ? "Restoring..." : "Suspending...")
                  : (suspendTarget.status === "Suspended" ? "Yes, Unsuspend" : "Yes, Suspend")
                }
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
