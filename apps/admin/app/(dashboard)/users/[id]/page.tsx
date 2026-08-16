"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Clock, Shield, Bell, Pencil,
  UserX, ChevronDown, X, AlertTriangle,
  Heart, Users, MessageSquare, CheckCircle2, ChevronRight, Trash2,
} from "lucide-react";

interface UserDetail {
  id: string;
  name: string;
  email: string;
  phoneNo: string | null;
  roles: string[];
  status: string;
  isSuspended: boolean;
  isEmailVerified: boolean;
  profileComplete: boolean;
  createdAt: string;
  lastSeen: string | null;
  username: string | null;
  fullName: string | null;
  city: string | null;
  state: string | null;
  gender: string | null;
  dob: string | null;
  disabilityType: string | null;
  disabilitySince: number | null;
  verificationStatus: string | null;
  ngoName: string | null;
  ngoRole: string | null;
  district: string | null;
  speciality: string | null;
  organization: string | null;
  yearsOfExperience: number | null;
  supportNeeded: string | null;
  careRelation: string | null;
  forumStats?: { questions: string; answers: string };
}

export default function UserDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [user, setUser] = useState<UserDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [activeTab, setActiveTab] = useState<"Profile" | "Activity" | "Care Circles & Groups" | "Reports">("Profile");
  const [showEditModal, setShowEditModal] = useState(false);
  const [showSuspendModal, setShowSuspendModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [actionMsg, setActionMsg] = useState<{ text: string; type: "success" | "error" } | null>(null);

  const showBanner = (text: string, type: "success" | "error" = "success") => {
    setActionMsg({ text, type });
    setTimeout(() => setActionMsg(null), 4000);
  };

  const fetchUser = useCallback(async () => {
    try {
      const res = await fetch(`/api/users/${id}`);
      const data = await res.json();
      if (data.success) setUser(data.user);
      else setNotFound(true);
    } catch { setNotFound(true); }
    finally { setLoading(false); }
  }, [id]);

  useEffect(() => { fetchUser(); }, [fetchUser]);

  if (loading) return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="w-10 h-10 border-4 border-[#7004DC] border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (notFound || !user) return (
    <div className="px-8 py-20 text-center">
      <p className="text-slate-400 font-semibold text-lg">User not found.</p>
      <Link href="/users" className="mt-4 inline-block text-sm font-bold text-[#7004DC] hover:underline">← Back to Users</Link>
    </div>
  );

  // Guard against empty name
  const nameParts = (user.name || "?").split(" ").filter(Boolean);
  const initials = nameParts.map(n => n[0]).join("").slice(0, 2).toUpperCase() || "?";

  const ROLE_COLORS: Record<string, string> = {
    PWD: "bg-[#EDDCFF] text-[#7004DC]", CAREGIVER: "bg-yellow-100 text-yellow-700",
    THERAPIST: "bg-green-100 text-green-700", NGO: "bg-blue-100 text-blue-700",
    VOLUNTEER: "bg-orange-100 text-orange-700", STUDENT: "bg-pink-100 text-pink-700",
  };

  const STATUS_STYLES: Record<string, string> = {
    Active: "bg-green-100 text-green-700",
    Inactive: "bg-gray-100 text-gray-500",
    Suspended: "bg-red-100 text-red-700",
  };
  const STATUS_DOT: Record<string, string> = {
    Active: "bg-green-600", Inactive: "bg-gray-400", Suspended: "bg-red-600",
  };

  const TABS = ["Profile", "Activity", "Care Circles & Groups", "Reports"] as const;

  const handleSuspend = async (reason: string, duration: string, message: string) => {
    const res = await fetch(`/api/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "suspend", reason, duration, message }),
    });
    const data = await res.json();
    setShowSuspendModal(false);
    if (data.success) {
      showBanner("User suspended successfully.");
      fetchUser();
    } else {
      showBanner("Failed to suspend user. Please try again.", "error");
    }
  };

  const handleUnsuspend = async () => {
    const res = await fetch(`/api/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "unsuspend" }),
    });
    const data = await res.json();
    if (data.success) {
      showBanner("User unsuspended successfully.");
      fetchUser();
    } else {
      showBanner("Failed to unsuspend user.", "error");
    }
  };

  const handleDelete = async () => {
    const res = await fetch(`/api/users/${id}`, { method: "DELETE" });
    const data = await res.json();
    if (data.success) {
      router.push("/users");
    } else {
      setShowDeleteModal(false);
      showBanner("Failed to delete user.", "error");
    }
  };

  return (
    <div className="px-8 py-6 max-w-[1300px]">

      {/* BREADCRUMB */}
      <div className="flex items-center gap-1.5 text-sm mb-6">
        <span className="text-[#7D7387]">Users Management</span>
        <ChevronRight className="w-3.5 h-3.5 text-[#7D7387]" />
        <Link href="/users" className="text-[#7D7387] hover:text-[#7004DC]">Users</Link>
        <ChevronRight className="w-3.5 h-3.5 text-[#7D7387]" />
        <span className="font-semibold text-[#1A1C1C]">{user.name}</span>
      </div>

      {/* ACTION BANNER */}
      {actionMsg && (
        <div className={`mb-4 rounded-xl px-4 py-3 text-sm font-semibold flex items-center gap-2 ${
          actionMsg.type === "success"
            ? "bg-green-50 border border-green-200 text-green-700"
            : "bg-red-50 border border-red-200 text-red-700"
        }`}>
          {actionMsg.type === "success"
            ? <CheckCircle2 className="w-4 h-4" />
            : <AlertTriangle className="w-4 h-4" />}
          {actionMsg.text}
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-[320px_1fr] gap-6">

        {/* LEFT PANEL */}
        <div className="bg-white rounded-[24px] p-7 shadow-sm border border-gray-100 flex flex-col items-center text-center">
          {/* AVATAR */}
          <div className={`w-20 h-20 rounded-2xl flex items-center justify-center text-white font-extrabold text-2xl mb-4 ${
            user.isSuspended ? "bg-red-400" : "bg-[#7004DC]"
          }`}>
            {initials}
          </div>

          <h2 className="text-xl font-extrabold text-[#1A1C1C]">{user.name}</h2>
          <p className="text-sm text-[#7D7387] mt-1">{user.email}</p>
          {user.username && (
            <p className="text-sm font-bold text-[#7004DC] mt-1">@{user.username}</p>
          )}

          {/* STATUS */}
          <div className={`mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase ${STATUS_STYLES[user.status] ?? "bg-gray-100 text-gray-500"}`}>
            <div className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[user.status] ?? "bg-gray-400"}`} />
            {user.status}
          </div>

          {/* ROLES */}
          <div className="flex flex-wrap gap-2 justify-center mt-3">
            {user.roles.map((r) => (
              <span key={r} className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase ${ROLE_COLORS[r] || "bg-slate-100 text-slate-500"}`}>
                {r}
              </span>
            ))}
          </div>

          {/* META */}
          <div className="w-full mt-6 space-y-3 text-left border-t border-gray-100 pt-5">
            {[
              { label: "City", value: user.city || "—" },
              { label: "Joined Date", value: user.createdAt },
              { label: "Disability", value: user.disabilityType || "—" },
              { label: "Last Active", value: user.lastSeen || "—" },
            ].map((item) => (
              <div key={item.label} className="flex items-center justify-between">
                <span className="text-xs text-[#7D7387]">{item.label}</span>
                <span className="text-sm font-semibold text-[#1A1C1C]">{item.value}</span>
              </div>
            ))}
          </div>

          {/* ACTION BUTTONS */}
          <div className="w-full mt-6 space-y-3">
            <button
              onClick={() => setShowEditModal(true)}
              className="w-full h-11 rounded-xl border-2 border-gray-200 text-[#1A1C1C] font-semibold text-sm hover:bg-gray-50 transition flex items-center justify-center gap-2"
            >
              <Pencil className="w-4 h-4" /> Edit User
            </button>

            {user.isSuspended ? (
              <button
                onClick={handleUnsuspend}
                className="w-full h-11 rounded-xl border-2 border-green-300 text-green-700 font-semibold text-sm hover:bg-green-50 transition flex items-center justify-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4" /> Unsuspend User
              </button>
            ) : (
              <button
                onClick={() => setShowSuspendModal(true)}
                className="w-full h-11 rounded-xl border-2 border-red-200 text-red-600 font-semibold text-sm hover:bg-red-50 transition flex items-center justify-center gap-2"
              >
                <UserX className="w-4 h-4" /> Suspend User
              </button>
            )}

            <button
              className="w-full h-11 rounded-xl border-2 border-gray-200 text-[#4B4355] font-semibold text-sm hover:bg-gray-50 transition flex items-center justify-center gap-2"
            >
              <Bell className="w-4 h-4" /> Send Notification
            </button>

            <button
              onClick={() => {
                if (window.confirm(`Are you sure you want to delete user "${user.name}"?`)) {
                  setShowDeleteModal(true);
                }
              }}
              className="w-full h-11 rounded-xl border-2 border-red-100 text-red-400 font-semibold text-sm hover:bg-red-50 hover:border-red-300 hover:text-red-600 transition flex items-center justify-center gap-2"
            >
              <Trash2 className="w-4 h-4" /> Delete User
            </button>
          </div>
        </div>

        {/* RIGHT PANEL */}
        <div className="bg-white rounded-[24px] shadow-sm border border-gray-100 overflow-hidden">
          {/* TABS */}
          <div className="flex border-b border-gray-100 px-7 pt-5">
            {TABS.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`mr-6 pb-4 text-sm font-semibold transition border-b-2 -mb-px ${activeTab === tab ? "border-[#7004DC] text-[#7004DC]" : "border-transparent text-[#7D7387] hover:text-[#1A1C1C]"}`}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* TAB CONTENT */}
          <div className="p-7">
            {activeTab === "Profile" && <ProfileTab user={user} />}
            {activeTab === "Activity" && <ActivityTab userId={user.id} />}
            {activeTab === "Care Circles & Groups" && <CareCirclesTab userId={user.id} />}
            {activeTab === "Reports" && <ReportsTab userId={user.id} />}
          </div>
        </div>
      </div>

      {/* EDIT USER MODAL */}
      {showEditModal && (
        <EditUserModal
          user={user}
          onClose={() => setShowEditModal(false)}
          onSaved={() => {
            setShowEditModal(false);
            showBanner("User profile updated successfully.");
            fetchUser();
          }}
        />
      )}

      {/* SUSPEND USER MODAL */}
      {showSuspendModal && (
        <SuspendUserModal
          user={user}
          onClose={() => setShowSuspendModal(false)}
          onConfirm={handleSuspend}
        />
      )}

      {/* DELETE USER MODAL */}
      {showDeleteModal && (
        <DeleteUserModal
          user={user}
          onClose={() => setShowDeleteModal(false)}
          onConfirm={handleDelete}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// PROFILE TAB
// ─────────────────────────────────────────────
function ProfileTab({ user }: { user: UserDetail }) {
  const supportItems = user.supportNeeded ? user.supportNeeded.split(",").map(s => s.trim()) : [];

  return (
    <div className="space-y-8">
      {/* PERSONAL INFORMATION */}
      <section>
        <div className="flex items-center gap-2 mb-5">
          <div className="w-7 h-7 rounded-lg bg-violet-100 flex items-center justify-center text-[#7004DC]">
            <Shield className="w-3.5 h-3.5" />
          </div>
          <h3 className="text-base font-extrabold text-[#1A1C1C]">Personal Information</h3>
        </div>
        <div className="grid grid-cols-2 gap-x-8 gap-y-5">
          <InfoItem label="FULL NAME" value={user.fullName || user.name} />
          <InfoItem label="DATE OF BIRTH" value={(() => {
            if (!user.dob) return "—";
            const d = new Date(user.dob);
            return isNaN(d.getTime()) ? "—" : d.toLocaleDateString("en-GB").replace(/\//g, "/");
          })()} />
          <InfoItem label="GENDER" value={user.gender || "—"} />
          <InfoItem label="PRIMARY LANGUAGE" value="Telugu, English" />
          <InfoItem label="PHONE NUMBER" value={user.phoneNo || "—"} />
          <InfoItem label="STATE" value={user.state || "—"} />
          <InfoItem label="DISTRICT" value={user.district || user.city || "—"} />
          <InfoItem label="PINCODE" value="—" />
        </div>
      </section>

      {/* DISABILITY DETAILS */}
      {(user.disabilityType || user.roles.includes("PWD")) && (
        <section>
          <div className="flex items-center gap-2 mb-5">
            <div className="w-7 h-7 rounded-lg bg-violet-100 flex items-center justify-center text-[#7004DC]">
              <Shield className="w-3.5 h-3.5" />
            </div>
            <h3 className="text-base font-extrabold text-[#1A1C1C]">Disability Details</h3>
          </div>
          <div className="grid grid-cols-3 gap-6 items-start">
            <div>
              <p className="text-[10px] font-extrabold uppercase tracking-[0.15em] text-slate-400 mb-2">PRIMARY DISABILITY TYPE</p>
              {user.disabilityType ? (
                <span className="px-3 py-1.5 rounded-full bg-[#EDDCFF] text-[#7004DC] text-sm font-semibold">
                  {user.disabilityType}
                </span>
              ) : <p className="text-sm text-slate-400">—</p>}
            </div>
            <div>
              <p className="text-[10px] font-extrabold uppercase tracking-[0.15em] text-slate-400 mb-2">SINCE YEAR</p>
              <p className="text-sm font-semibold text-[#1A1C1C]">{user.disabilitySince ?? "—"}</p>
            </div>
            <div>
              <p className="text-[10px] font-extrabold uppercase tracking-[0.15em] text-slate-400 mb-2">SUPPORT REQUIRED</p>
              {supportItems.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {supportItems.map((s) => (
                    <span key={s} className="px-3 py-1 rounded-full bg-[#F3F3F3] text-[#4B4355] text-xs font-semibold border border-gray-200">
                      {s}
                    </span>
                  ))}
                </div>
              ) : <p className="text-sm text-slate-400">—</p>}
            </div>
          </div>
        </section>
      )}

      {/* PLATFORM ROLES */}
      {user.roles.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-5">
            <div className="w-7 h-7 rounded-lg bg-violet-100 flex items-center justify-center text-[#7004DC]">
              <Users className="w-3.5 h-3.5" />
            </div>
            <h3 className="text-base font-extrabold text-[#1A1C1C]">Platform Roles</h3>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {user.roles.map((role) => (
              <div key={role} className="bg-[#F7F5FA] rounded-xl p-4 border border-[#ECE7F2] flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-[#EDDCFF] flex items-center justify-center text-[#7004DC] shrink-0">
                  {role === "PWD" ? <Shield className="w-4 h-4" /> : role === "CAREGIVER" ? <Heart className="w-4 h-4" /> : <Users className="w-4 h-4" />}
                </div>
                <div>
                  <p className="text-sm font-bold text-[#1A1C1C]">
                    {role === "PWD" ? "Person with Disability (PwD)" : role.charAt(0) + role.slice(1).toLowerCase()}
                  </p>
                  <p className="text-xs text-[#7D7387] mt-0.5">
                    {role === "PWD" ? "Status: Active verified profile" : role === "CAREGIVER" ? `Caregiver For: —` : "Active"}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* FORUM ACTIVITY */}
      <section>
        <div className="flex items-center gap-2 mb-5">
          <div className="w-7 h-7 rounded-lg bg-violet-100 flex items-center justify-center text-[#7004DC]">
            <MessageSquare className="w-3.5 h-3.5" />
          </div>
          <h3 className="text-base font-extrabold text-[#1A1C1C]">Forum Activity</h3>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-violet-50 rounded-xl p-5 text-center">
            <h4 className="text-3xl font-extrabold text-[#7004DC]">{user.forumStats?.questions || "0"}</h4>
            <p className="text-xs font-semibold text-[#7D7387] uppercase tracking-wide mt-1">Questions</p>
          </div>
          <div className="bg-violet-50 rounded-xl p-5 text-center">
            <h4 className="text-3xl font-extrabold text-[#7004DC]">{user.forumStats?.answers || "0"}</h4>
            <p className="text-xs font-semibold text-[#7D7387] uppercase tracking-wide mt-1">Answers</p>
          </div>
        </div>
      </section>
    </div>
  );
}

// ─────────────────────────────────────────────
// ─────────────────────────────────────────────
// CARE CIRCLES & GROUPS TAB — real data
// ─────────────────────────────────────────────
interface UserGroupItem {
  id: string;
  name: string;
  description: string;
  subType: "CARE_CIRCLE" | "GENERAL";
  userRole: string;
  memberCount: number;
  joinedAt: string;
}

interface UserGroupsData {
  total: number;
  careCirclesCount: number;
  generalGroupsCount: number;
  careCircles: UserGroupItem[];
  generalGroups: UserGroupItem[];
  allGroups: UserGroupItem[];
}

function CareCirclesTab({ userId }: { userId: string }) {
  const [data, setData] = useState<UserGroupsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [filter, setFilter] = useState<"ALL" | "CARE_CIRCLE" | "GENERAL">("ALL");

  useEffect(() => {
    setLoading(true);
    setError(false);
    fetch(`/api/users/${userId}/groups`)
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setData(d);
        else setError(true);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [userId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-[#7004DC] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <AlertTriangle className="w-8 h-8 text-red-400 mb-3" />
        <p className="text-sm font-semibold text-slate-600">Failed to load care circles and groups</p>
      </div>
    );
  }

  const displayedGroups =
    filter === "ALL"
      ? data.allGroups
      : filter === "CARE_CIRCLE"
      ? data.careCircles
      : data.generalGroups;

  return (
    <div className="space-y-6">
      {/* SUMMARY STATS */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
          <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 mb-1">Total Memberships</p>
          <p className="text-2xl font-extrabold text-[#7004DC]">{data.total}</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
          <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 mb-1">Care Circles</p>
          <p className="text-2xl font-extrabold text-pink-600">{data.careCirclesCount}</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
          <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 mb-1">Community Groups</p>
          <p className="text-2xl font-extrabold text-violet-600">{data.generalGroupsCount}</p>
        </div>
      </div>

      {/* FILTER PILLS */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {(
            [
              { key: "ALL", label: `All Groups (${data.total})` },
              { key: "CARE_CIRCLE", label: `Care Circles (${data.careCirclesCount})` },
              { key: "GENERAL", label: `Community Groups (${data.generalGroupsCount})` },
            ] as const
          ).map((t) => (
            <button
              key={t.key}
              onClick={() => setFilter(t.key)}
              className={`h-9 px-4 rounded-xl text-xs font-bold transition ${
                filter === t.key
                  ? "bg-[#7004DC] text-white shadow-sm"
                  : "bg-[#F7F5FA] text-[#4B4355] hover:bg-violet-100/50"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <p className="text-xs text-slate-400 font-semibold">{displayedGroups.length} shown</p>
      </div>

      {/* GROUPS LIST */}
      {displayedGroups.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center border border-dashed border-gray-200 rounded-2xl bg-[#FAF9FC]">
          <div className="w-14 h-14 rounded-2xl bg-violet-100 flex items-center justify-center mb-3 text-[#7004DC]">
            <Heart className="w-6 h-6" />
          </div>
          <h4 className="text-sm font-extrabold text-[#1A1C1C] mb-1">
            No {filter === "CARE_CIRCLE" ? "Care Circles" : filter === "GENERAL" ? "Community Groups" : "Memberships"} Found
          </h4>
          <p className="text-xs text-[#7D7387] max-w-sm">
            This user has not joined or been assigned to any {filter === "CARE_CIRCLE" ? "care circles" : filter === "GENERAL" ? "community groups" : "groups"} yet.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {displayedGroups.map((group) => {
            const isCareCircle = group.subType === "CARE_CIRCLE";
            return (
              <div
                key={group.id}
                className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm hover:border-violet-200 transition flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${
                          isCareCircle ? "bg-pink-100 text-pink-600" : "bg-violet-100 text-violet-600"
                        }`}
                      >
                        {isCareCircle ? <Heart className="w-5 h-5" /> : <Users className="w-5 h-5" />}
                      </div>
                      <div>
                        <h4 className="font-extrabold text-sm text-[#1A1C1C] line-clamp-1">{group.name}</h4>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase ${
                              isCareCircle ? "bg-pink-100 text-pink-700" : "bg-violet-100 text-violet-700"
                            }`}
                          >
                            {isCareCircle ? "Care Circle" : "General Group"}
                          </span>
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase bg-slate-100 text-slate-600 border border-slate-200">
                            Role: {group.userRole}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {group.description ? (
                    <p className="text-xs text-[#7D7387] line-clamp-2 mb-3 leading-relaxed">{group.description}</p>
                  ) : null}
                </div>

                <div className="pt-3 border-t border-gray-100 flex items-center justify-between text-xs text-[#7D7387]">
                  <div className="flex items-center gap-1.5 font-medium">
                    <Users className="w-3.5 h-3.5 text-slate-400" />
                    <span>{group.memberCount} members</span>
                    <span className="mx-1">·</span>
                    <span>Joined {group.joinedAt}</span>
                  </div>

                  <Link
                    href={`/groups/${group.id}`}
                    className="inline-flex items-center gap-1 text-xs font-bold text-[#7004DC] hover:underline"
                  >
                    View Group <ChevronRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// ACTIVITY TAB — comprehensive real timeline
// ─────────────────────────────────────────────
interface ActivityItem {
  id: string;
  type: "question" | "answer" | "care_circle_joined" | "group_joined" | "account_created" | "email_verified";
  title?: string;
  content?: string;
  category?: string;
  time: string;
  views?: number;
  answerCount?: number;
  status?: string;
  isAccepted?: boolean;
  upvotes?: number;
  downvotes?: number;
  questionTitle?: string;
  questionId?: string;
  groupId?: string;
  isDeleted?: boolean;
}

function ActivityTab({ userId }: { userId: string }) {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [counts, setCounts] = useState({ all: 0, questions: 0, answers: 0, groups: 0, account: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [typeFilter, setTypeFilter] = useState<"all" | "question" | "answer" | "groups" | "account">("all");

  useEffect(() => {
    setLoading(true);
    setError(false);
    fetch(`/api/users/${userId}/activity`)
      .then((r) => r.json())
      .then((data) => {
        if (data.success) {
          setActivities(data.activities || []);
          if (data.counts) setCounts(data.counts);
        } else {
          setError(true);
        }
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [userId]);

  const filtered = activities.filter((a) => {
    if (typeFilter === "all") return true;
    if (typeFilter === "question") return a.type === "question";
    if (typeFilter === "answer") return a.type === "answer";
    if (typeFilter === "groups") return a.type === "care_circle_joined" || a.type === "group_joined";
    if (typeFilter === "account") return a.type === "account_created" || a.type === "email_verified";
    return true;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-[#7004DC] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <AlertTriangle className="w-8 h-8 text-red-400 mb-3" />
        <p className="text-sm font-semibold text-slate-600">Failed to load activity timeline</p>
      </div>
    );
  }

  return (
    <div>
      {/* FILTERS */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          {(
            [
              { key: "all", label: `All Activities (${counts.all || activities.length})` },
              { key: "question", label: `Questions (${counts.questions})` },
              { key: "answer", label: `Answers (${counts.answers})` },
              { key: "groups", label: `Groups & Circles (${counts.groups})` },
              { key: "account", label: `Account Events (${counts.account})` },
            ] as const
          ).map((f) => (
            <button
              key={f.key}
              onClick={() => setTypeFilter(f.key)}
              className={`h-9 px-4 rounded-xl text-xs font-bold transition ${
                typeFilter === f.key
                  ? "bg-[#7004DC] text-white shadow-sm"
                  : "bg-[#F7F5FA] text-[#4B4355] hover:bg-violet-100/50"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <p className="text-xs text-slate-400 font-semibold">{filtered.length} items</p>
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center border border-dashed border-gray-200 rounded-2xl bg-[#FAF9FC]">
          <div className="w-16 h-16 rounded-full bg-[#F3F0FF] flex items-center justify-center mb-4 text-[#7004DC]">
            <Clock className="w-7 h-7" />
          </div>
          <h3 className="text-base font-extrabold text-[#1A1C1C] mb-1">No activities found</h3>
          <p className="text-xs text-[#7D7387] max-w-sm">
            No activity records matching this filter category were found for this user.
          </p>
        </div>
      ) : (
        /* TIMELINE */
        <div className="space-y-4">
          {filtered.map((item) => {
            const isQuestion = item.type === "question";
            const isAnswer = item.type === "answer";
            const isCareCircle = item.type === "care_circle_joined";
            const isGroup = item.type === "group_joined";
            const isAccount = item.type === "account_created" || item.type === "email_verified";

            return (
              <div
                key={item.id}
                className={`bg-white rounded-2xl border p-5 flex items-start gap-4 transition shadow-sm ${
                  item.isDeleted ? "border-red-100 bg-red-50/20 opacity-70" : "border-gray-100 hover:border-violet-200"
                }`}
              >
                <div
                  className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 mt-0.5 ${
                    isQuestion
                      ? "bg-[#7004DC] text-white"
                      : isAnswer
                      ? item.isAccepted
                        ? "bg-green-500 text-white"
                        : "bg-blue-500 text-white"
                      : isCareCircle
                      ? "bg-pink-100 text-pink-600"
                      : isGroup
                      ? "bg-violet-100 text-violet-600"
                      : "bg-emerald-100 text-emerald-700"
                  }`}
                >
                  {isQuestion && <MessageSquare className="w-4 h-4" />}
                  {isAnswer && <CheckCircle2 className="w-4 h-4" />}
                  {isCareCircle && <Heart className="w-4 h-4" />}
                  {isGroup && <Users className="w-4 h-4" />}
                  {isAccount && <Shield className="w-4 h-4" />}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold text-[#1A1C1C]">
                        {isQuestion
                          ? "Posted a forum question"
                          : isAnswer
                          ? "Answered a forum question"
                          : isCareCircle
                          ? "Joined a Care Circle"
                          : isGroup
                          ? "Joined a Community Group"
                          : item.title || "Account Milestone"}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {isQuestion && item.status === "SOLVED" && (
                        <span className="px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wide bg-green-100 text-green-700">
                          SOLVED
                        </span>
                      )}
                      {isAnswer && item.isAccepted && (
                        <span className="px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wide bg-green-100 text-green-700">
                          ✓ ACCEPTED
                        </span>
                      )}
                      {item.isDeleted && (
                        <span className="px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wide bg-red-100 text-red-700">
                          REMOVED
                        </span>
                      )}
                      <span className="text-xs text-slate-400 whitespace-nowrap">{item.time}</span>
                    </div>
                  </div>

                  {isQuestion && item.content && (
                    <p className="text-sm text-[#4B4355] mt-1 font-semibold line-clamp-2">{item.content}</p>
                  )}

                  {isAnswer && item.questionTitle && (
                    <p className="text-sm text-[#7004DC] mt-1 font-medium line-clamp-1">On: "{item.questionTitle}"</p>
                  )}

                  {isAnswer && item.content && (
                    <p className="text-xs text-[#7D7387] mt-1.5 italic bg-[#FAF9FC] p-2.5 rounded-xl border border-gray-100 line-clamp-2">
                      "{item.content}"
                    </p>
                  )}

                  {(isCareCircle || isGroup) && (
                    <div className="mt-1 flex items-center gap-2">
                      <span className="text-sm font-semibold text-[#1A1C1C]">{item.title}</span>
                      <span className="text-xs text-slate-400">({item.content})</span>
                    </div>
                  )}

                  {isAccount && item.content && (
                    <p className="text-xs text-[#7D7387] mt-1">{item.content}</p>
                  )}

                  <div className="flex items-center gap-4 mt-2.5 flex-wrap">
                    {item.category && (
                      <span className="text-[10px] font-bold uppercase tracking-wide bg-[#F3F0FF] text-[#7004DC] px-2.5 py-0.5 rounded-md">
                        {item.category}
                      </span>
                    )}
                    {isQuestion && item.views !== undefined && (
                      <span className="text-xs text-slate-400">
                        👁 {item.views} views · 💬 {item.answerCount} answers
                      </span>
                    )}
                    {isAnswer && item.upvotes !== undefined && (
                      <span className="text-xs text-slate-400">👍 {item.upvotes} upvotes</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// REPORTS TAB — real data
// ─────────────────────────────────────────────
interface ReportItem {
  id: string;
  reason: string;
  createdAt: string;
  type: "question" | "answer";
  questionTitle?: string;
  answerContent?: string;
  reporterName?: string;
  isContentRemoved?: boolean;
}

interface ReportsData {
  reportsAgainst: ReportItem[];
  reportsSubmitted: ReportItem[];
  stats: { reportsAgainst: number; reportsSubmitted: number; contentRemoved: number };
  suspension: { isSuspended: boolean; suspendedUntil: string | null; reputation: number } | null;
}

function ReportsTab({ userId }: { userId: string }) {
  const [data, setData] = useState<ReportsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [activeSection, setActiveSection] = useState<"against" | "submitted">("against");

  useEffect(() => {
    setLoading(true);
    setError(false);
    fetch(`/api/users/${userId}/reports`)
      .then(r => r.json())
      .then(d => {
        if (d.success) setData(d);
        else setError(true);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [userId]);

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <div className="w-8 h-8 border-4 border-[#7004DC] border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (error) return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <AlertTriangle className="w-8 h-8 text-red-400 mb-3" />
      <p className="text-sm font-semibold text-slate-600">Failed to load reports</p>
    </div>
  );

  const stats = data?.stats ?? { reportsAgainst: 0, reportsSubmitted: 0, contentRemoved: 0 };
  const items = activeSection === "against" ? (data?.reportsAgainst ?? []) : (data?.reportsSubmitted ?? []);

  return (
    <div>
      {/* SUSPENSION BANNER */}
      {data?.suspension?.isSuspended && (
        <div className="mb-5 bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-center gap-3">
          <span className="text-red-500 text-lg">⊗</span>
          <div>
            <p className="text-sm font-bold text-red-700">User is currently suspended</p>
            {data.suspension.suspendedUntil ? (
              <p className="text-xs text-red-500 mt-0.5">Until: {data.suspension.suspendedUntil}</p>
            ) : (
              <p className="text-xs text-red-500 mt-0.5">Permanently suspended</p>
            )}
          </div>
        </div>
      )}

      {/* MINI STATS */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: "Reports Against", value: stats.reportsAgainst, color: "border-orange-400", icon: "⚠" },
          { label: "Content Removed", value: stats.contentRemoved, color: "border-red-500", icon: "🗑" },
          { label: "Reports Submitted", value: stats.reportsSubmitted, color: "border-[#7004DC]", icon: "🚩" },
        ].map((stat) => (
          <div key={stat.label} className={`bg-white rounded-xl border-l-4 ${stat.color} p-4 shadow-sm border border-gray-100 flex items-center gap-3`}>
            <span className="text-xl">{stat.icon}</span>
            <div>
              <p className="text-xs text-[#7D7387] font-medium">{stat.label}</p>
              <h3 className="text-2xl font-extrabold text-[#1A1C1C]">{stat.value}</h3>
            </div>
          </div>
        ))}
      </div>

      {/* SECTION TOGGLE */}
      <div className="flex items-center gap-2 mb-5">
        <button
          onClick={() => setActiveSection("against")}
          className={`h-9 px-4 rounded-lg text-xs font-bold transition ${
            activeSection === "against" ? "bg-[#7004DC] text-white" : "bg-[#F3F3F3] text-[#4B4355] hover:bg-[#E8E8E8]"
          }`}
        >
          Reports Against This User ({stats.reportsAgainst})
        </button>
        <button
          onClick={() => setActiveSection("submitted")}
          className={`h-9 px-4 rounded-lg text-xs font-bold transition ${
            activeSection === "submitted" ? "bg-[#7004DC] text-white" : "bg-[#F3F3F3] text-[#4B4355] hover:bg-[#E8E8E8]"
          }`}
        >
          Submitted by This User ({stats.reportsSubmitted})
        </button>
      </div>

      {/* REPORT ITEMS */}
      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-14 h-14 rounded-full bg-green-50 flex items-center justify-center mb-3">
            <CheckCircle2 className="w-6 h-6 text-green-500" />
          </div>
          <h3 className="text-sm font-semibold text-[#1A1C1C] mb-1">No reports found</h3>
          <p className="text-xs text-[#7D7387]">
            {activeSection === "against" ? "No reports have been filed against this user's content." : "This user has not submitted any reports."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((report) => (
            <div key={report.id} className={`bg-white rounded-2xl border shadow-sm p-5 ${
              report.isContentRemoved ? "border-red-100" : "border-gray-100"
            }`}>
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-base ${
                    activeSection === "against" ? "bg-orange-100" : "bg-violet-100"
                  }`}>
                    {activeSection === "against" ? "⚠" : "🚩"}
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-[#1A1C1C]">
                      {report.type === "question" ? (report.questionTitle || "Forum Question") : "Forum Answer"}
                    </h4>
                    <p className="text-xs text-[#7D7387] mt-0.5">
                      {report.createdAt}
                      {activeSection === "against" && report.reporterName && ` · Reported by ${report.reporterName}`}
                    </p>
                  </div>
                </div>
                {report.isContentRemoved && (
                  <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase bg-red-100 text-red-700">REMOVED</span>
                )}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">REASON</p>
                  <p className="text-xs font-semibold text-[#1A1C1C]">{report.reason}</p>
                </div>
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">TYPE</p>
                  <p className="text-xs font-semibold text-[#1A1C1C] capitalize">{report.type}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// INFO ITEM
// ─────────────────────────────────────────────
function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-extrabold uppercase tracking-[0.15em] text-slate-400 mb-1">{label}</p>
      <p className="text-sm font-semibold text-[#1A1C1C]">{value || "—"}</p>
    </div>
  );
}

// ─────────────────────────────────────────────
// EDIT USER MODAL
// ─────────────────────────────────────────────
function EditUserModal({
  user, onClose, onSaved,
}: { user: UserDetail; onClose: () => void; onSaved: () => void }) {
  const [activeTab, setActiveTab] = useState<"Basic Info" | "Roles" | "Accessibility">("Basic Info");
  const [fullName, setFullName] = useState(user.fullName || user.name);
  const [phone, setPhone] = useState(user.phoneNo || "");
  const [city, setCity] = useState(user.city || "");
  const [state, setState] = useState(user.state || "");
  const [gender, setGender] = useState(user.gender || "");
  // Roles tab
  const [selectedRoles, setSelectedRoles] = useState<string[]>(user.roles || []);
  // Accessibility tab
  const [disabilityType, setDisabilityType] = useState(user.disabilityType || "");
  const [disabilitySince, setDisabilitySince] = useState(user.disabilitySince?.toString() || "");
  const [supportNeeded, setSupportNeeded] = useState(user.supportNeeded || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  // Dynamic disability types from Master Data
  const [disabilityTypeOptions, setDisabilityTypeOptions] = useState<string[]>([]);
  useEffect(() => {
    fetch("/api/settings/disability-types")
      .then((r) => r.json())
      .then((d) => { if (d.success) setDisabilityTypeOptions(d.types.filter((t: { status: string }) => t.status === "Active").map((t: { name: string }) => t.name)); })
      .catch(() => {});
  }, []);

  const toggleRole = (role: string) => {
    setSelectedRoles(prev =>
      prev.includes(role) ? prev.filter(r => r !== role) : [...prev, role]
    );
  };

  const handleSave = async () => {
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update",
          fullName,
          phoneNo: phone,
          city,
          state,
          gender,
          roles: selectedRoles,
          disabilityType: disabilityType || null,
          disabilitySince: disabilitySince ? parseInt(disabilitySince) : null,
          supportNeeded: supportNeeded || null,
        }),
      });
      const data = await res.json();
      if (data.success) {
        onSaved();
      } else {
        setError("Failed to save changes. Please try again.");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-[24px] w-full max-w-xl shadow-2xl overflow-hidden">
        {/* HEADER */}
        <div className="flex items-center justify-between px-8 py-6 border-b border-gray-100">
          <h3 className="text-xl font-extrabold text-[#1A1C1C]">Edit User Profile</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center transition">
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>

        {/* TABS */}
        <div className="flex border-b border-gray-100 px-8">
          {(["Basic Info", "Roles", "Accessibility"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`mr-6 py-4 text-sm font-semibold transition border-b-2 -mb-px ${activeTab === tab ? "border-[#7004DC] text-[#7004DC]" : "border-transparent text-[#7D7387] hover:text-[#1A1C1C]"}`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* FORM */}
        <div className="px-8 py-6 space-y-5 overflow-y-auto max-h-[60vh]">
          {activeTab === "Basic Info" && (
            <>
              <FormField label="Full Name">
                <input value={fullName} onChange={e => setFullName(e.target.value)} className="w-full h-12 rounded-xl border border-gray-200 px-4 text-sm outline-none focus:border-[#8A38F5]" />
              </FormField>
              <FormField label="Email">
                <div className="relative">
                  <input defaultValue={user.email} readOnly className="w-full h-12 rounded-xl border border-gray-200 px-4 text-sm outline-none pr-24 bg-gray-50" />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 text-xs font-bold text-green-600 bg-green-50 px-2.5 py-1 rounded-lg">
                    <CheckCircle2 className="w-3 h-3" /> Verified
                  </span>
                </div>
              </FormField>
              <FormField label="Phone Number">
                <div className="relative">
                  <input value={phone} onChange={e => setPhone(e.target.value)} className="w-full h-12 rounded-xl border border-gray-200 px-4 text-sm outline-none focus:border-[#8A38F5] pr-24" />
                  {user.phoneNo && (
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 text-xs font-bold text-green-600 bg-green-50 px-2.5 py-1 rounded-lg">
                      <CheckCircle2 className="w-3 h-3" /> Verified
                    </span>
                  )}
                </div>
              </FormField>
              <FormField label="Gender">
                <div className="relative">
                  <select value={gender} onChange={e => setGender(e.target.value)} className="w-full h-12 rounded-xl border border-gray-200 px-4 text-sm outline-none focus:border-[#8A38F5] appearance-none bg-white pr-10">
                    <option value="">Select</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                </div>
              </FormField>
              <div className="grid grid-cols-2 gap-4">
                <FormField label="City">
                  <input value={city} onChange={e => setCity(e.target.value)} placeholder="Hyderabad" className="w-full h-12 rounded-xl border border-gray-200 px-4 text-sm outline-none focus:border-[#8A38F5]" />
                </FormField>
                <FormField label="State">
                  <input value={state} onChange={e => setState(e.target.value)} placeholder="Telangana" className="w-full h-12 rounded-xl border border-gray-200 px-4 text-sm outline-none focus:border-[#8A38F5]" />
                </FormField>
              </div>
              {error && <p className="text-xs text-red-500 font-semibold">{error}</p>}
            </>
          )}
          {/* ── ROLES TAB ── */}
          {activeTab === "Roles" && (() => {
            const ALL_ROLES = [
              { key: "PWD", label: "Person with Disability", description: "User identifies as a person with disability", color: "bg-[#EDDCFF] text-[#7004DC] border-[#D5B8FF]" },
              { key: "CAREGIVER", label: "Caregiver", description: "Supports a person with disability", color: "bg-yellow-50 text-yellow-700 border-yellow-200" },
              { key: "THERAPIST", label: "Therapist", description: "Provides therapy or medical support", color: "bg-green-50 text-green-700 border-green-200" },
              { key: "NGO", label: "NGO", description: "Works with a non-governmental organisation", color: "bg-blue-50 text-blue-700 border-blue-200" },
              { key: "VOLUNTEER", label: "Volunteer", description: "Community volunteer", color: "bg-orange-50 text-orange-700 border-orange-200" },
              { key: "STUDENT", label: "Student", description: "Student or young adult", color: "bg-pink-50 text-pink-700 border-pink-200" },
            ];
            return (
              <div className="space-y-3">
                <p className="text-xs text-[#7D7387] font-medium mb-4">Select all roles that apply to this user. At least one role is recommended.</p>
                {ALL_ROLES.map(({ key, label, description, color }) => {
                  const active = selectedRoles.includes(key);
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => toggleRole(key)}
                      className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 transition text-left ${
                        active ? `${color} border-current` : "border-gray-200 hover:border-gray-300 bg-white"
                      }`}
                    >
                      <div className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition ${
                        active ? "bg-[#7004DC] border-[#7004DC]" : "border-gray-300 bg-white"
                      }`}>
                        {active && (
                          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 12 12">
                            <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-bold ${active ? "" : "text-[#1A1C1C]"}`}>{label}</p>
                        <p className={`text-xs mt-0.5 ${active ? "opacity-80" : "text-[#7D7387]"}`}>{description}</p>
                      </div>
                      <span className={`text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-1 rounded-full border ${
                        active ? color : "border-gray-200 bg-gray-50 text-gray-400"
                      }`}>{key}</span>
                    </button>
                  );
                })}
                {selectedRoles.length === 0 && (
                  <p className="text-xs text-orange-500 font-semibold mt-2">⚠ No roles selected — the user will have limited access.</p>
                )}
                {error && <p className="text-xs text-red-500 font-semibold">{error}</p>}
              </div>
            );
          })()}

          {/* ── ACCESSIBILITY TAB ── */}
          {activeTab === "Accessibility" && (() => {
            const DISABILITY_TYPES = disabilityTypeOptions.length > 0
              ? disabilityTypeOptions
              : ["Visual Impairment", "Hearing Impairment", "Physical Disability",
                 "Intellectual Disability", "Autism Spectrum", "Mental Health",
                 "Speech & Language", "Learning Disability", "Multiple Disabilities", "Other"];
            const SUPPORT_OPTIONS = [
              "Physical Assistance", "Sign Language", "Braille",
              "Screen Reader", "Transportation", "Mental Health Support",
              "Financial Aid", "Medical Support",
            ];
            const currentSupport = supportNeeded ? supportNeeded.split(",").map(s => s.trim()).filter(Boolean) : [];
            const toggleSupport = (s: string) => {
              const updated = currentSupport.includes(s)
                ? currentSupport.filter(x => x !== s)
                : [...currentSupport, s];
              setSupportNeeded(updated.join(", "));
            };
            return (
              <div className="space-y-6">
                <FormField label="Primary Disability Type">
                  <div className="relative">
                    <select
                      value={disabilityType}
                      onChange={e => setDisabilityType(e.target.value)}
                      className="w-full h-12 rounded-xl border border-gray-200 px-4 text-sm outline-none focus:border-[#8A38F5] appearance-none bg-white pr-10"
                    >
                      <option value="">None / Not specified</option>
                      {DISABILITY_TYPES.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                  </div>
                </FormField>

                <FormField label="Living with Disability Since (Year)">
                  <input
                    type="number"
                    min="1900"
                    max={new Date().getFullYear()}
                    value={disabilitySince}
                    onChange={e => setDisabilitySince(e.target.value)}
                    placeholder={`e.g. ${new Date().getFullYear() - 5}`}
                    className="w-full h-12 rounded-xl border border-gray-200 px-4 text-sm outline-none focus:border-[#8A38F5]"
                  />
                </FormField>

                <div>
                  <p className="text-sm font-semibold text-[#1A1C1C] mb-3">Support Required</p>
                  <div className="grid grid-cols-2 gap-2">
                    {SUPPORT_OPTIONS.map(s => {
                      const active = currentSupport.includes(s);
                      return (
                        <button
                          key={s}
                          type="button"
                          onClick={() => toggleSupport(s)}
                          className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border text-left text-xs font-semibold transition ${
                            active
                              ? "border-[#7004DC] bg-[#F3EEFF] text-[#7004DC]"
                              : "border-gray-200 bg-white text-[#4B4355] hover:border-[#C4A8F0]"
                          }`}
                        >
                          <div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 ${
                            active ? "bg-[#7004DC] border-[#7004DC]" : "border-gray-300"
                          }`}>
                            {active && (
                              <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 12 12">
                                <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                              </svg>
                            )}
                          </div>
                          {s}
                        </button>
                      );
                    })}
                  </div>
                  {currentSupport.length > 0 && (
                    <p className="text-xs text-[#7D7387] mt-2">
                      Selected: <span className="font-semibold text-[#7004DC]">{currentSupport.join(", ")}</span>
                    </p>
                  )}
                </div>
                {error && <p className="text-xs text-red-500 font-semibold">{error}</p>}
              </div>
            );
          })()}
        </div>

        {/* FOOTER */}
        <div className="px-8 py-5 border-t border-gray-100 flex justify-end gap-3">
          <button onClick={onClose} className="h-11 px-6 rounded-xl border border-gray-200 text-[#4B4355] font-semibold text-sm hover:bg-gray-50 transition">Cancel</button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="h-11 px-6 rounded-xl bg-[#7004DC] hover:bg-[#5c03b7] disabled:bg-[#c5a0ef] text-white font-bold text-sm transition"
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// SUSPEND USER MODAL
// ─────────────────────────────────────────────
function SuspendUserModal({
  user, onClose, onConfirm,
}: { user: UserDetail; onClose: () => void; onConfirm: (reason: string, duration: string, message: string) => Promise<void>; }) {
  const [durationType, setDurationType] = useState<"Temporary" | "Permanent">("Temporary");
  const [duration, setDuration] = useState("30 days");
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [validationError, setValidationError] = useState("");

  const effects = [
    "User cannot log in",
    "Active sessions will be terminated",
    "Posts remain visible but cannot create new ones",
    "User notified via email",
    "Reversible anytime",
  ];

  const handleSubmit = async () => {
    if (!reason) {
      setValidationError("Please select a reason for suspension.");
      return;
    }
    setValidationError("");
    setSubmitting(true);
    await onConfirm(reason, durationType === "Permanent" ? "Permanent" : duration, message);
    setSubmitting(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-[24px] w-full max-w-md shadow-2xl overflow-hidden">
        {/* HEADER */}
        <div className="flex items-start justify-between px-8 py-6">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-600" />
            <h3 className="text-xl font-extrabold text-red-600">Suspend User Account?</h3>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center transition">
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>

        <div className="px-8 pb-8 space-y-5 overflow-y-auto max-h-[70vh]">
          {/* USER PREVIEW */}
          <div className="bg-[#F7F5FA] rounded-xl p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#7004DC] flex items-center justify-center text-white font-bold text-sm">
              {(user.name || "?").split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase() || "?"}
            </div>
            <div>
              <p className="font-bold text-sm text-[#1A1C1C]">{user.name}</p>
              <p className="text-xs text-[#7D7387] mt-0.5">{user.email}</p>
            </div>
          </div>

          {/* EFFECTS */}
          <div className="bg-red-50 rounded-xl p-4 border border-red-100">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-red-600 mt-0.5 shrink-0" />
              <ul className="space-y-1">
                {effects.map((e) => (
                  <li key={e} className="text-sm text-red-600 font-medium">• {e}</li>
                ))}
              </ul>
            </div>
          </div>

          {/* DURATION */}
          <div>
            <p className="text-sm font-extrabold text-[#1A1C1C] mb-3">Suspension Duration</p>
            <div className="flex items-center gap-6 mb-3">
              {(["Temporary", "Permanent"] as const).map((t) => (
                <label key={t} className="flex items-center gap-2 cursor-pointer">
                  <div
                    onClick={() => setDurationType(t)}
                    className={`w-4 h-4 rounded-full border-2 flex items-center justify-center cursor-pointer ${durationType === t ? "border-red-500" : "border-gray-300"}`}
                  >
                    {durationType === t && <div className="w-2 h-2 rounded-full bg-red-500" />}
                  </div>
                  <span className="text-sm font-semibold text-[#1A1C1C]">{t}</span>
                </label>
              ))}
            </div>
            {durationType === "Temporary" && (
              <div className="relative">
                <select
                  value={duration}
                  onChange={e => setDuration(e.target.value)}
                  className="w-full h-12 rounded-xl border border-gray-200 px-4 text-sm outline-none focus:border-red-400 appearance-none bg-white pr-10"
                >
                  {["7 days", "14 days", "30 days", "60 days", "90 days"].map(d => (
                    <option key={d}>{d}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              </div>
            )}
          </div>

          {/* REASON */}
          <div>
            <p className="text-sm font-extrabold text-[#1A1C1C] mb-2">
              Reason for Suspension <span className="text-red-500">*</span>
            </p>
            <div className="relative">
              <select
                value={reason}
                onChange={e => { setReason(e.target.value); setValidationError(""); }}
                className={`w-full h-12 rounded-xl border px-4 text-sm outline-none focus:border-red-400 appearance-none bg-white pr-10 ${validationError ? "border-red-400" : "border-gray-200"}`}
              >
                <option value="">Select a reason...</option>
                <option>Harassment or bullying</option>
                <option>Spam or misleading content</option>
                <option>Violation of community guidelines</option>
                <option>Fraudulent activity</option>
                <option>Other</option>
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            </div>
            {validationError && <p className="text-xs text-red-500 mt-1 font-semibold">{validationError}</p>}
          </div>

          {/* MESSAGE */}
          <div>
            <p className="text-sm font-extrabold text-[#1A1C1C] mb-2">Message to User <span className="text-[#7D7387] font-normal">(optional)</span></p>
            <textarea
              value={message}
              onChange={e => setMessage(e.target.value)}
              rows={3}
              placeholder="Explain why the account is suspended..."
              className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-red-400 resize-none"
            />
            <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
              <span className="w-3.5 h-3.5 rounded-full border border-slate-300 flex items-center justify-center text-[8px] font-bold">i</span>
              User will receive this message via email
            </p>
          </div>

          {/* BUTTONS */}
          <div className="flex gap-3 pt-1">
            <button onClick={onClose} className="flex-1 h-12 rounded-xl border border-gray-200 text-[#4B4355] font-semibold text-sm hover:bg-gray-50 transition">Cancel</button>
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="flex-1 h-12 rounded-xl bg-red-600 hover:bg-red-700 disabled:bg-red-300 text-white font-bold text-sm transition"
            >
              {submitting ? "Suspending..." : "Suspend Account"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// DELETE USER MODAL
// ─────────────────────────────────────────────
function DeleteUserModal({
  user, onClose, onConfirm,
}: { user: UserDetail; onClose: () => void; onConfirm: () => Promise<void>; }) {
  const [confirming, setConfirming] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const isMatch = confirmText === user.name;

  const handleDelete = async () => {
    if (!isMatch) return;
    setConfirming(true);
    await onConfirm();
    setConfirming(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-[24px] w-full max-w-md shadow-2xl overflow-hidden">
        <div className="flex items-start justify-between px-8 py-6">
          <div className="flex items-center gap-2">
            <Trash2 className="w-5 h-5 text-red-600" />
            <h3 className="text-xl font-extrabold text-red-600">Delete User Account?</h3>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center transition">
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>

        <div className="px-8 pb-8 space-y-5">
          <div className="bg-red-50 border border-red-200 rounded-xl p-4">
            <p className="text-sm font-bold text-red-700 mb-2">⚠ This action is irreversible</p>
            <ul className="space-y-1">
              {[
                "All personal information will be erased",
                "The user will be permanently locked out",
                "Forum posts will be anonymised",
                "This cannot be undone",
              ].map(e => (
                <li key={e} className="text-sm text-red-600 font-medium">• {e}</li>
              ))}
            </ul>
          </div>

          <div>
            <p className="text-sm font-semibold text-[#1A1C1C] mb-2">
              Type <span className="font-extrabold text-red-600">{user.name}</span> to confirm
            </p>
            <input
              value={confirmText}
              onChange={e => setConfirmText(e.target.value)}
              placeholder={user.name}
              className="w-full h-12 rounded-xl border border-gray-200 px-4 text-sm outline-none focus:border-red-400"
            />
          </div>

          <div className="flex gap-3">
            <button onClick={onClose} className="flex-1 h-12 rounded-xl border border-gray-200 text-[#4B4355] font-semibold text-sm hover:bg-gray-50 transition">Cancel</button>
            <button
              onClick={handleDelete}
              disabled={!isMatch || confirming}
              className="flex-1 h-12 rounded-xl bg-red-600 hover:bg-red-700 disabled:bg-red-200 disabled:text-red-400 text-white font-bold text-sm transition"
            >
              {confirming ? "Deleting..." : "Delete Account"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// FORM FIELD WRAPPER
// ─────────────────────────────────────────────
function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-semibold text-[#1A1C1C] mb-2">{label}</label>
      {children}
    </div>
  );
}
