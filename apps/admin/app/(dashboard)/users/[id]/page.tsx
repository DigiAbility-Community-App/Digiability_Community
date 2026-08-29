"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Clock, Shield, Bell, Pencil,
  UserX, ChevronDown, X, AlertTriangle,
  Heart, Users, MessageSquare, CheckCircle2, ChevronRight, Trash2,
  Briefcase, Building2, Star,
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
  addressLine1: string | null;
  streetArea: string | null;
  locationDistrict: string | null;
  pincode: string | null;
  disabilityType: string | null;
  disabilitySince: number | null;
  carePersonName: string | null;
  careRelation: string | null;
  careDob: string | null;
  careDisabilityType: string | null;
  verificationStatus: string | null;
  verificationDoc: string | null;
  ngoName: string | null;
  ngoRole: string | null;
  district: string | null;
  speciality: string | null;
  organization: string | null;
  yearsOfExperience: number | null;
  supportNeeded: string | null;
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
      const res = await fetch(`/api/users/${encodeURIComponent(id)}`);
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
    const res = await fetch(`/api/users/${encodeURIComponent(id)}`, {
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
    const res = await fetch(`/api/users/${encodeURIComponent(id)}`, {
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
    const res = await fetch(`/api/users/${encodeURIComponent(id)}`, { method: "DELETE" });
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
        <div className={`mb-4 rounded-xl px-4 py-3 text-sm font-semibold flex items-center gap-2 ${actionMsg.type === "success"
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
          <div className={`w-20 h-20 rounded-2xl flex items-center justify-center text-white font-extrabold text-2xl mb-4 ${user.isSuspended ? "bg-red-400" : "bg-[#7004DC]"
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

            {/* <button
              className="w-full h-11 rounded-xl border-2 border-gray-200 text-[#4B4355] font-semibold text-sm hover:bg-gray-50 transition flex items-center justify-center gap-2"
            >
              <Bell className="w-4 h-4" /> Send Notification
            </button> */}

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

/** Small reusable section header */
function SectionHeader({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-2 mb-5">
      <div className="w-7 h-7 rounded-lg bg-violet-100 flex items-center justify-center text-[#7004DC]">
        {icon}
      </div>
      <h3 className="text-base font-extrabold text-[#1A1C1C]">{title}</h3>
    </div>
  );
}

function ProfileTab({ user }: { user: UserDetail }) {
  const hasRole = (r: string) => user.roles.includes(r);

  /** Role label → friendly display name */
  const ROLE_LABELS: Record<string, string> = {
    PWD: "Person with Disability (PwD)",
    CAREGIVER: "Caregiver",
    THERAPIST: "Therapist",
    NGO: "NGO Worker",
    VOLUNTEER: "Volunteer",
    STUDENT: "Student",
    MENTOR: "Mentor",
  };

  /** Role → one-line subtitle using real data */
  const roleSubtitle = (role: string): string => {
    if (role === "PWD") return user.disabilityType ? `Disability: ${user.disabilityType}` : "Profile active";
    if (role === "CAREGIVER") return user.careRelation ? `Relation: ${user.careRelation}` : "Care profile active";
    if (role === "THERAPIST") return user.speciality ? `Speciality: ${user.speciality}` : "Therapist profile active";
    if (role === "NGO") return user.ngoName ? `${user.ngoName}` : "NGO profile active";
    if (role === "VOLUNTEER") return "Community volunteer";
    if (role === "STUDENT") return "Student member";
    if (role === "MENTOR") return "Community mentor";
    return "Active";
  };

  /** Icon per role */
  const roleIcon = (role: string) => {
    if (role === "PWD") return <Shield className="w-4 h-4" />;
    if (role === "CAREGIVER") return <Heart className="w-4 h-4" />;
    if (role === "THERAPIST") return <Star className="w-4 h-4" />;
    if (role === "NGO") return <Building2 className="w-4 h-4" />;
    if (role === "VOLUNTEER") return <Users className="w-4 h-4" />;
    if (role === "STUDENT") return <Briefcase className="w-4 h-4" />;
    return <Users className="w-4 h-4" />;
  };

  const hasAddress = user.addressLine1 || user.streetArea || user.city || user.locationDistrict || user.state || user.pincode;

  return (
    <div className="space-y-8">

      {/* ── PERSONAL INFORMATION ── */}
      <section>
        <SectionHeader icon={<Shield className="w-3.5 h-3.5" />} title="Personal Information" />
        <div className="grid grid-cols-2 gap-x-8 gap-y-5">
          <InfoItem label="FULL NAME" value={user.fullName || user.name} />
          <InfoItem label="USERNAME" value={user.username ? `@${user.username}` : "—"} />
          <InfoItem label="DATE OF BIRTH" value={(() => {
            if (!user.dob) return "—";
            const d = new Date(user.dob);
            return isNaN(d.getTime()) ? "—" : d.toLocaleDateString("en-GB");
          })()} />
          <InfoItem label="GENDER" value={user.gender || "—"} />
          <InfoItem label="PHONE NUMBER" value={user.phoneNo || "—"} />
          <InfoItem label="EMAIL" value={user.email} />
        </div>
      </section>

      {/* ── ADDRESS DETAILS ── */}
      {hasAddress && (
        <section>
          <SectionHeader icon={<Building2 className="w-3.5 h-3.5" />} title="Address & Location" />
          <div className="grid grid-cols-2 gap-x-8 gap-y-5">
            <InfoItem label="FLAT / HOUSE / BUILDING" value={user.addressLine1 || "—"} />
            <InfoItem label="STREET / COLONY / LOCALITY" value={user.streetArea || "—"} />
            <InfoItem label="CITY" value={user.city || "—"} />
            <InfoItem label="DISTRICT" value={user.locationDistrict || user.district || "—"} />
            <InfoItem label="STATE" value={user.state || "—"} />
            <InfoItem label="PINCODE" value={user.pincode || "—"} />
          </div>
        </section>
      )}

      {/* ── DISABILITY DETAILS (PWD) ── */}
      {(user.disabilityType || hasRole("PWD")) && (
        <section>
          <SectionHeader icon={<Shield className="w-3.5 h-3.5" />} title="Disability Details" />
          <div className="grid grid-cols-2 gap-6 items-start">
            <div>
              <p className="text-[10px] font-extrabold uppercase tracking-[0.15em] text-slate-400 mb-2">PRIMARY DISABILITY TYPE(S)</p>
              {user.disabilityType ? (
                <div className="flex flex-wrap gap-2">
                  {user.disabilityType.split(",").map(d => d.trim()).filter(Boolean).map(d => (
                    <span key={d} className="px-3 py-1.5 rounded-full bg-[#EDDCFF] text-[#7004DC] text-xs font-bold">
                      {d}
                    </span>
                  ))}
                </div>
              ) : <p className="text-sm text-slate-400">—</p>}
            </div>
            <div>
              <p className="text-[10px] font-extrabold uppercase tracking-[0.15em] text-slate-400 mb-2">LIVING WITH DISABILITY SINCE</p>
              <p className="text-sm font-semibold text-[#1A1C1C]">
                {user.disabilitySince ? `${user.disabilitySince}` : "—"}
              </p>
            </div>
          </div>
        </section>
      )}

      {/* ── CAREGIVER DETAILS ── */}
      {(hasRole("CAREGIVER") || user.careRelation || user.carePersonName || user.careDisabilityType) && (
        <section>
          <SectionHeader icon={<Heart className="w-3.5 h-3.5" />} title="Caregiver Details" />
          <div className="grid grid-cols-2 gap-x-8 gap-y-5">
            <InfoItem label="PERSON BEING CARED FOR" value={user.carePersonName || "—"} />
            <InfoItem label="RELATION TO PERSON" value={user.careRelation || "—"} />
            <InfoItem label="CARE PERSON DATE OF BIRTH" value={(() => {
              if (!user.careDob) return "—";
              const d = new Date(user.careDob);
              return isNaN(d.getTime()) ? "—" : d.toLocaleDateString("en-GB");
            })()} />
            <div>
              <p className="text-[10px] font-extrabold uppercase tracking-[0.15em] text-slate-400 mb-1">CARE PERSON DISABILITY TYPE(S)</p>
              {user.careDisabilityType ? (
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {user.careDisabilityType.split(",").map(d => d.trim()).filter(Boolean).map(d => (
                    <span key={d} className="px-2.5 py-1 rounded-full bg-pink-100 text-pink-700 text-xs font-bold">
                      {d}
                    </span>
                  ))}
                </div>
              ) : <p className="text-sm font-semibold text-[#1A1C1C]">—</p>}
            </div>
          </div>
        </section>
      )}

      {/* ── THERAPIST / PROFESSIONAL DETAILS ── */}
      {(hasRole("THERAPIST") || user.speciality || user.organization) && (
        <section>
          <SectionHeader icon={<Star className="w-3.5 h-3.5" />} title="Professional Details" />
          <div className="grid grid-cols-2 gap-x-8 gap-y-5">
            <InfoItem label="SPECIALITY" value={user.speciality || "—"} />
            <InfoItem label="ORGANISATION / CLINIC / HOSPITAL" value={user.organization || "—"} />
            <InfoItem label="YEARS OF EXPERIENCE" value={user.yearsOfExperience != null ? `${user.yearsOfExperience} years` : "—"} />
          </div>
        </section>
      )}

      {/* ── NGO DETAILS ── */}
      {(hasRole("NGO") || user.ngoName) && (
        <section>
          <SectionHeader icon={<Building2 className="w-3.5 h-3.5" />} title="NGO Details" />
          <div className="grid grid-cols-2 gap-x-8 gap-y-5">
            <InfoItem label="NGO NAME" value={user.ngoName || "—"} />
            <InfoItem label="ROLE IN NGO" value={user.ngoRole || "—"} />
            {user.district && <InfoItem label="OPERATIONAL DISTRICT" value={user.district} />}
          </div>
        </section>
      )}

      {/* ── VERIFICATION STATUS ── */}
      <section>
        <SectionHeader icon={<CheckCircle2 className="w-3.5 h-3.5" />} title="Verification Status" />
        <div className="grid grid-cols-2 gap-x-8 gap-y-5">
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-[0.15em] text-slate-400 mb-1">STATUS</p>
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase ${
              (user.isEmailVerified || user.verificationStatus === "verified") ? "bg-green-100 text-green-700" :
              user.verificationStatus === "rejected" ? "bg-red-100 text-red-700" :
              "bg-yellow-100 text-yellow-700"
            }`}>
              {(user.isEmailVerified || user.verificationStatus === "verified") ? "Verified" : (user.verificationStatus || "Pending")}
            </span>
          </div>
          {user.verificationDoc && (
            <div>
              <p className="text-[10px] font-extrabold uppercase tracking-[0.15em] text-slate-400 mb-1">DOCUMENT</p>
              <a href={user.verificationDoc} target="_blank" rel="noreferrer" className="text-xs font-bold text-[#7004DC] hover:underline">
                View Uploaded Document ↗
              </a>
            </div>
          )}
        </div>
      </section>

      {/* ── PLATFORM ROLES ── */}
      {user.roles.length > 0 && (
        <section>
          <SectionHeader icon={<Users className="w-3.5 h-3.5" />} title="Platform Roles" />
          <div className="grid grid-cols-2 gap-4">
            {user.roles.map((role) => (
              <div key={role} className="bg-[#F7F5FA] rounded-xl p-4 border border-[#ECE7F2] flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-[#EDDCFF] flex items-center justify-center text-[#7004DC] shrink-0">
                  {roleIcon(role)}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-[#1A1C1C]">
                    {ROLE_LABELS[role] ?? (role.charAt(0) + role.slice(1).toLowerCase())}
                  </p>
                  <p className="text-xs text-[#7D7387] mt-0.5 truncate">
                    {roleSubtitle(role)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── FORUM ACTIVITY ── */}
      <section>
        <SectionHeader icon={<MessageSquare className="w-3.5 h-3.5" />} title="Forum Activity" />
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
// CARE CIRCLES & GROUPS TAB
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
  const [filter, setFilter] = useState<"ALL" | "CARE_CIRCLE" | "GENERAL">("ALL");

  useEffect(() => {
    setLoading(true);
    fetch(`/api/users/${userId}/groups`)
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setData(d);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [userId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-[#7004DC] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <AlertTriangle className="w-8 h-8 text-red-400 mb-3" />
        <p className="text-sm font-semibold text-slate-600">Failed to load care circles and groups</p>
      </div>
    );
  }

  const displayedGroups =
    filter === "ALL"
      ? (data.allGroups || [])
      : filter === "CARE_CIRCLE"
        ? (data.careCircles || [])
        : (data.generalGroups || []);

  return (
    <div className="space-y-6">
      {/* SUMMARY STATS */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
          <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 mb-1">Total Memberships</p>
          <p className="text-2xl font-extrabold text-[#7004DC]">{data.total || 0}</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
          <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 mb-1">Care Circles</p>
          <p className="text-2xl font-extrabold text-pink-600">{data.careCirclesCount || 0}</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
          <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 mb-1">Community Groups</p>
          <p className="text-2xl font-extrabold text-violet-600">{data.generalGroupsCount || 0}</p>
        </div>
      </div>

      {/* FILTER PILLS */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {(
            [
              { key: "ALL", label: `All Groups (${data.total || 0})` },
              { key: "CARE_CIRCLE", label: `Care Circles (${data.careCirclesCount || 0})` },
              { key: "GENERAL", label: `Community Groups (${data.generalGroupsCount || 0})` },
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
// ACTIVITY TAB
// ─────────────────────────────────────────────
interface ActivityItem {
  id: string;
  type: string;
  title?: string;
  questionTitle?: string;
  content?: string;
  category?: string;
  time: string;
}

function ActivityTab({ userId }: { userId: string }) {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [counts, setCounts] = useState({ all: 0, questions: 0, answers: 0, groups: 0, account: 0 });
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<"all" | "question" | "answer" | "groups" | "account">("all");

  useEffect(() => {
    setLoading(true);
    fetch(`/api/users/${userId}/activity`)
      .then((r) => r.json())
      .then((data) => {
        if (data.success) {
          setActivities(data.activities || []);
          if (data.counts) setCounts(data.counts);
        }
      })
      .catch(() => { })
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

  return (
    <div className="space-y-6">
      {/* FILTER PILLS */}
      <div className="flex flex-wrap items-center gap-2 border-b border-gray-100 pb-4">
        {[
          { key: "all", label: `All Activity (${counts.all})` },
          { key: "question", label: `Questions (${counts.questions})` },
          { key: "answer", label: `Answers (${counts.answers})` },
          { key: "groups", label: `Groups (${counts.groups})` },
          { key: "account", label: `Account (${counts.account})` },
        ].map((f) => (
          <button
            key={f.key}
            onClick={() => setTypeFilter(f.key as any)}
            className={`h-9 px-4 rounded-xl text-xs font-bold transition ${typeFilter === f.key
                ? "bg-[#7004DC] text-white shadow-sm"
                : "bg-[#F7F5FA] text-[#4B4355] hover:bg-violet-100/50"
              }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* TIMELINE */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center border border-dashed border-gray-200 rounded-2xl bg-[#FAF9FC]">
          <Clock className="w-8 h-8 text-slate-300 mb-2" />
          <p className="text-sm font-semibold text-slate-500">No activities found</p>
        </div>
      ) : (
        <div className="relative pl-6 space-y-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-violet-100">
          {filtered.map((item) => (
            <div key={item.id} className="relative group">
              {/* TIMELINE DOT */}
              <div className="absolute -left-6 top-1 w-4 h-4 rounded-full border-2 border-white bg-[#7004DC] shadow-sm ring-2 ring-violet-100" />
              <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm hover:border-violet-200 transition">
                <div className="flex items-start justify-between gap-4 mb-2">
                  <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase bg-violet-50 text-[#7004DC]">
                    {item.category || item.type}
                  </span>
                  <span className="text-xs font-semibold text-[#7D7387]">{item.time}</span>
                </div>
                <h4 className="font-bold text-sm text-[#1A1C1C] mb-1">
                  {item.title || item.questionTitle || item.content}
                </h4>
                {item.content && item.title && (
                  <p className="text-xs text-[#7D7387] line-clamp-2 leading-relaxed">{item.content}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// REPORTS TAB
// ─────────────────────────────────────────────
interface ReportItem {
  id: string;
  reason: string;
  createdAt: string;
  type: "question" | "answer";
  questionId?: string;
  answerId?: string;
  questionTitle?: string;
  reporterName?: string;
  isContentRemoved?: boolean;
}

function ReportsTab({ userId }: { userId: string }) {
  const [reportsAgainst, setReportsAgainst] = useState<ReportItem[]>([]);
  const [reportsSubmitted, setReportsSubmitted] = useState<ReportItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState<"against" | "submitted">("against");

  useEffect(() => {
    setLoading(true);
    fetch(`/api/users/${userId}/reports`)
      .then((r) => r.json())
      .then((d) => {
        if (d.success) {
          setReportsAgainst(d.reportsAgainst || []);
          setReportsSubmitted(d.reportsSubmitted || []);
        }
      })
      .catch(() => { })
      .finally(() => setLoading(false));
  }, [userId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-[#7004DC] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const items = activeSection === "against" ? reportsAgainst : reportsSubmitted;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 border-b border-gray-100 pb-4">
        <button
          onClick={() => setActiveSection("against")}
          className={`h-9 px-4 rounded-xl text-xs font-bold transition ${activeSection === "against" ? "bg-red-500 text-white shadow-sm" : "bg-[#F7F5FA] text-[#4B4355] hover:bg-red-50"}`}
        >
          Reports Against User ({reportsAgainst.length})
        </button>
        <button
          onClick={() => setActiveSection("submitted")}
          className={`h-9 px-4 rounded-xl text-xs font-bold transition ${activeSection === "submitted" ? "bg-[#7004DC] text-white shadow-sm" : "bg-[#F7F5FA] text-[#4B4355] hover:bg-violet-100/50"}`}
        >
          Reports Submitted ({reportsSubmitted.length})
        </button>
      </div>

      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center border border-dashed border-gray-200 rounded-2xl bg-[#FAF9FC]">
          <Shield className="w-8 h-8 text-slate-300 mb-2" />
          <p className="text-sm font-semibold text-slate-500">No {activeSection === "against" ? "reports filed against this user" : "reports submitted by this user"}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((report) => (
            <div key={report.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <div className="flex items-start justify-between mb-2">
                <h4 className="font-bold text-sm text-[#1A1C1C]">Reason: {report.reason}</h4>
                <span className="text-xs text-[#7D7387]">{report.createdAt}</span>
              </div>
              {report.reporterName && (
                <p className="text-xs text-[#7D7387]">Reported by: {report.reporterName}</p>
              )}
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
  type TabKey = "Basic Info & Address" | "Roles" | "Disability" | "Role Details";
  const [activeTab, setActiveTab] = useState<TabKey>("Basic Info & Address");

  // ── Basic Info & Address ──
  const [fullName, setFullName] = useState(user.fullName || user.name || "");
  const [username, setUsername] = useState(user.username || "");
  const [phone, setPhone] = useState(user.phoneNo || "");
  const [gender, setGender] = useState(user.gender || "");
  const [dob, setDob] = useState(() => {
    if (!user.dob) return "";
    const d = new Date(user.dob);
    if (isNaN(d.getTime())) return "";
    return d.toISOString().split("T")[0]; // yyyy-mm-dd
  });
  const [addressLine1, setAddressLine1] = useState(user.addressLine1 || "");
  const [streetArea, setStreetArea] = useState(user.streetArea || "");
  const [city, setCity] = useState(user.city || "");
  const [locationDistrict, setLocationDistrict] = useState(user.locationDistrict || user.district || "");
  const [state, setState] = useState(user.state || "");
  const [pincode, setPincode] = useState(user.pincode || "");

  // ── Roles ──
  const [selectedRoles, setSelectedRoles] = useState<string[]>(user.roles || []);

  // ── Disability (PwD) ──
  const [selectedDisabilities, setSelectedDisabilities] = useState<string[]>(() => {
    if (!user.disabilityType) return [];
    return user.disabilityType.split(",").map(d => d.trim()).filter(Boolean);
  });
  const [disabilitySince, setDisabilitySince] = useState(user.disabilitySince?.toString() || "");

  // ── Role Details ──
  // Caregiver
  const [carePersonName, setCarePersonName] = useState(user.carePersonName || "");
  const [careRelation, setCareRelation] = useState(user.careRelation || "");
  const [careDob, setCareDob] = useState(() => {
    if (!user.careDob) return "";
    const d = new Date(user.careDob);
    if (isNaN(d.getTime())) return "";
    return d.toISOString().split("T")[0];
  });
  const [selectedCareDisabilities, setSelectedCareDisabilities] = useState<string[]>(() => {
    if (!user.careDisabilityType) return [];
    return user.careDisabilityType.split(",").map(d => d.trim()).filter(Boolean);
  });

  // Therapist
  const [speciality, setSpeciality] = useState(user.speciality || "");
  const [organization, setOrganization] = useState(user.organization || "");
  const [yearsOfExperience, setYearsOfExperience] = useState(user.yearsOfExperience?.toString() || "");

  // NGO
  const [ngoName, setNgoName] = useState(user.ngoName || "");
  const [ngoRole, setNgoRole] = useState(user.ngoRole || "");
  const [district, setDistrict] = useState(user.district || "");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Vocabulary options
  const DEFAULT_DISABILITIES = [
    "Visual Impairment",
    "Locomotor Disability",
    "Hearing Impairment",
    "Speech & Language",
    "Intellectual Disability",
    "Autism Spectrum",
    "Mental Health",
    "Learning Disability",
    "Multiple Disabilities",
    "Cerebral Palsy",
    "Chronic Neurological Conditions",
    "Other",
  ];
  const [disabilityOptions, setDisabilityOptions] = useState<string[]>(DEFAULT_DISABILITIES);

  useEffect(() => {
    fetch("/api/settings/disability-types")
      .then((r) => r.json())
      .then((d) => {
        if (d.success && Array.isArray(d.types) && d.types.length > 0) {
          const names = d.types
            .filter((t: { status: string }) => t.status === "Active")
            .map((t: { name: string }) => t.name);
          if (names.length > 0) {
            setDisabilityOptions(Array.from(new Set([...DEFAULT_DISABILITIES, ...names])));
          }
        }
      })
      .catch(() => { });
  }, []);

  const hasRole = (r: string) => selectedRoles.includes(r);
  const hasRoleDetails = hasRole("CAREGIVER") || hasRole("THERAPIST") || hasRole("NGO");

  const TABS: TabKey[] = ["Basic Info & Address", "Roles", "Disability", ...(hasRoleDetails ? ["Role Details" as TabKey] : [])];

  const toggleRole = (role: string) => {
    setSelectedRoles(prev =>
      prev.includes(role) ? prev.filter(r => r !== role) : [...prev, role]
    );
  };

  const toggleDisability = (name: string) => {
    setSelectedDisabilities(prev =>
      prev.includes(name) ? prev.filter(d => d !== name) : [...prev, name]
    );
  };

  const toggleCareDisability = (name: string) => {
    setSelectedCareDisabilities(prev =>
      prev.includes(name) ? prev.filter(d => d !== name) : [...prev, name]
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
          username: username ? username.replace(/^@/, "").trim() : null,
          phoneNo: phone || null,
          gender: gender || null,
          dob: dob || null,
          addressLine1: addressLine1 || null,
          streetArea: streetArea || null,
          city: city || null,
          locationDistrict: locationDistrict || null,
          state: state || null,
          pincode: pincode || null,
          roles: selectedRoles,
          disabilityType: selectedDisabilities.length > 0 ? selectedDisabilities.join(", ") : null,
          disabilitySince: disabilitySince ? parseInt(disabilitySince, 10) : null,
          carePersonName: carePersonName || null,
          careRelation: careRelation || null,
          careDob: careDob || null,
          careDisabilityType: selectedCareDisabilities.length > 0 ? selectedCareDisabilities.join(", ") : null,
          speciality: speciality || null,
          organization: organization || null,
          yearsOfExperience: yearsOfExperience ? parseInt(yearsOfExperience, 10) : null,
          ngoName: ngoName || null,
          ngoRole: ngoRole || null,
          district: district || null,
        }),
      });
      const data = await res.json();
      if (data.success) {
        onSaved();
      } else {
        setError(data.message || "Failed to save changes.");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-[24px] w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* HEADER */}
        <div className="flex items-center justify-between px-8 py-5 border-b border-gray-100">
          <div>
            <h3 className="text-xl font-extrabold text-[#1A1C1C]">Edit User Profile</h3>
            <p className="text-xs text-[#7D7387] mt-0.5">Manage all user data, address, roles & accessibility</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center transition">
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>

        {/* TABS */}
        <div className="flex border-b border-gray-100 px-8 overflow-x-auto shrink-0">
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`mr-6 py-4 text-sm font-semibold transition border-b-2 -mb-px whitespace-nowrap ${activeTab === tab ? "border-[#7004DC] text-[#7004DC]" : "border-transparent text-[#7D7387] hover:text-[#1A1C1C]"}`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* FORM BODY */}
        <div className="px-8 py-6 space-y-5 overflow-y-auto flex-1">
          {/* ── TAB 1: BASIC INFO & ADDRESS ── */}
          {activeTab === "Basic Info & Address" && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField label="Full Name">
                  <input
                    value={fullName}
                    onChange={e => setFullName(e.target.value)}
                    placeholder="e.g. Prathmesh Sunil Kadam"
                    className="w-full h-12 rounded-xl border border-gray-200 px-4 text-sm outline-none focus:border-[#8A38F5]"
                  />
                </FormField>
                <FormField label="Username">
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">@</span>
                    <input
                      value={username.replace(/^@/, "")}
                      onChange={e => setUsername(e.target.value)}
                      placeholder="p7953k"
                      className="w-full h-12 rounded-xl border border-gray-200 pl-8 pr-4 text-sm outline-none focus:border-[#8A38F5]"
                    />
                  </div>
                </FormField>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField label="Email Address">
                  <div className="relative">
                    <input defaultValue={user.email} readOnly className="w-full h-12 rounded-xl border border-gray-200 px-4 text-sm outline-none pr-24 bg-gray-50 text-slate-600" />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 text-xs font-bold text-green-600 bg-green-50 px-2.5 py-1 rounded-lg">
                      <CheckCircle2 className="w-3 h-3" /> Verified
                    </span>
                  </div>
                </FormField>
                <FormField label="Phone Number">
                  <input
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    placeholder="e.g. 9175177953"
                    className="w-full h-12 rounded-xl border border-gray-200 px-4 text-sm outline-none focus:border-[#8A38F5]"
                  />
                </FormField>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField label="Gender">
                  <div className="relative">
                    <select
                      value={gender}
                      onChange={e => setGender(e.target.value)}
                      className="w-full h-12 rounded-xl border border-gray-200 px-4 text-sm outline-none focus:border-[#8A38F5] appearance-none bg-white pr-10"
                    >
                      <option value="">Select Gender</option>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                      <option value="Prefer not to say">Prefer not to say</option>
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                  </div>
                </FormField>
                <FormField label="Date of Birth">
                  <input
                    type="date"
                    value={dob}
                    onChange={e => setDob(e.target.value)}
                    className="w-full h-12 rounded-xl border border-gray-200 px-4 text-sm outline-none focus:border-[#8A38F5]"
                  />
                </FormField>
              </div>

              <div className="pt-2 border-t border-gray-100">
                <p className="text-xs font-extrabold uppercase tracking-wider text-[#7004DC] mb-3">Address & Location Details</p>
                <div className="space-y-3">
                  <FormField label="Flat / House / Building / Apartment">
                    <input
                      value={addressLine1}
                      onChange={e => setAddressLine1(e.target.value)}
                      placeholder="e.g. Namrata Crystal Park"
                      className="w-full h-12 rounded-xl border border-gray-200 px-4 text-sm outline-none focus:border-[#8A38F5]"
                    />
                  </FormField>
                  <FormField label="Street / Colony / Area / Locality">
                    <input
                      value={streetArea}
                      onChange={e => setStreetArea(e.target.value)}
                      placeholder="e.g. Kalewadi"
                      className="w-full h-12 rounded-xl border border-gray-200 px-4 text-sm outline-none focus:border-[#8A38F5]"
                    />
                  </FormField>
                  <div className="grid grid-cols-2 gap-4">
                    <FormField label="City / Town">
                      <input
                        value={city}
                        onChange={e => setCity(e.target.value)}
                        placeholder="e.g. Pimpri-Chinchwad"
                        className="w-full h-12 rounded-xl border border-gray-200 px-4 text-sm outline-none focus:border-[#8A38F5]"
                      />
                    </FormField>
                    <FormField label="District">
                      <input
                        value={locationDistrict}
                        onChange={e => setLocationDistrict(e.target.value)}
                        placeholder="e.g. Pune District"
                        className="w-full h-12 rounded-xl border border-gray-200 px-4 text-sm outline-none focus:border-[#8A38F5]"
                      />
                    </FormField>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <FormField label="State">
                      <input
                        value={state}
                        onChange={e => setState(e.target.value)}
                        placeholder="e.g. Maharashtra"
                        className="w-full h-12 rounded-xl border border-gray-200 px-4 text-sm outline-none focus:border-[#8A38F5]"
                      />
                    </FormField>
                    <FormField label="Pincode">
                      <input
                        value={pincode}
                        onChange={e => setPincode(e.target.value)}
                        placeholder="e.g. 411017"
                        className="w-full h-12 rounded-xl border border-gray-200 px-4 text-sm outline-none focus:border-[#8A38F5]"
                      />
                    </FormField>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── TAB 2: ROLES ── */}
          {activeTab === "Roles" && (() => {
            const ALL_ROLES = [
              { key: "PWD", label: "Person with Disability", description: "User identifies as a person with disability", color: "bg-[#EDDCFF] text-[#7004DC] border-[#D5B8FF]" },
              { key: "CAREGIVER", label: "Caregiver", description: "Supports a person with disability", color: "bg-yellow-50 text-yellow-700 border-yellow-200" },
              { key: "THERAPIST", label: "Therapist / Medical Professional", description: "Provides therapy or medical support", color: "bg-green-50 text-green-700 border-green-200" },
              { key: "NGO", label: "NGO Worker", description: "Works with a non-governmental organisation", color: "bg-blue-50 text-blue-700 border-blue-200" },
              { key: "VOLUNTEER", label: "Volunteer", description: "Community volunteer", color: "bg-orange-50 text-orange-700 border-orange-200" },
              { key: "STUDENT", label: "Student", description: "Student or young adult", color: "bg-pink-50 text-pink-700 border-pink-200" },
              { key: "MENTOR", label: "Mentor", description: "Community peer mentor", color: "bg-indigo-50 text-indigo-700 border-indigo-200" },
            ];
            return (
              <div className="space-y-3">
                <p className="text-xs text-[#7D7387] font-medium mb-2">Select all roles that apply to this user. You can select multiple roles.</p>
                {ALL_ROLES.map(({ key, label, description, color }) => {
                  const active = selectedRoles.includes(key);
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => toggleRole(key)}
                      className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 transition text-left ${active ? `${color} border-current` : "border-gray-200 hover:border-gray-300 bg-white"}`}
                    >
                      <div className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition ${active ? "bg-[#7004DC] border-[#7004DC]" : "border-gray-300 bg-white"}`}>
                        {active && (
                          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 12 12">
                            <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-bold ${active ? "" : "text-[#1A1C1C]"}`}>{label}</p>
                        <p className={`text-xs mt-0.5 ${active ? "opacity-80" : "text-[#7D7387]"}`}>{description}</p>
                      </div>
                      <span className={`text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-1 rounded-full border ${active ? color : "border-gray-200 bg-gray-50 text-gray-400"}`}>
                        {key}
                      </span>
                    </button>
                  );
                })}
              </div>
            );
          })()}

          {/* ── TAB 3: DISABILITY (PwD) ── */}
          {activeTab === "Disability" && (
            <div className="space-y-6">
              <div>
                <p className="text-sm font-bold text-[#1A1C1C] mb-1">Disability Type(s)</p>
                <p className="text-xs text-[#7D7387] mb-3">Select one or more disability types that apply:</p>
                <div className="flex flex-wrap gap-2">
                  {disabilityOptions.map((name) => {
                    const selected = selectedDisabilities.includes(name);
                    return (
                      <button
                        key={name}
                        type="button"
                        onClick={() => toggleDisability(name)}
                        className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 border ${
                          selected
                            ? "bg-[#7004DC] text-white border-[#7004DC] shadow-sm"
                            : "bg-[#F7F5FA] text-[#4B4355] border-gray-200 hover:border-[#7004DC]/40"
                        }`}
                      >
                        {selected && <CheckCircle2 className="w-3.5 h-3.5" />}
                        {name}
                      </button>
                    );
                  })}
                </div>
                {selectedDisabilities.length > 0 && (
                  <p className="text-xs text-[#7D7387] mt-3">
                    Selected ({selectedDisabilities.length}): <span className="font-bold text-[#7004DC]">{selectedDisabilities.join(", ")}</span>
                  </p>
                )}
              </div>

              <FormField label="Living with Disability Since (Year)">
                <input
                  type="number"
                  min="1900"
                  max={new Date().getFullYear()}
                  value={disabilitySince}
                  onChange={e => setDisabilitySince(e.target.value)}
                  placeholder="e.g. 2004"
                  className="w-full h-12 rounded-xl border border-gray-200 px-4 text-sm outline-none focus:border-[#8A38F5]"
                />
              </FormField>
            </div>
          )}

          {/* ── TAB 4: ROLE DETAILS (CAREGIVER, THERAPIST, NGO) ── */}
          {activeTab === "Role Details" && (
            <div className="space-y-6">
              {/* Caregiver Details */}
              {hasRole("CAREGIVER") && (
                <div className="bg-[#FAF9FC] p-5 rounded-2xl border border-gray-100 space-y-4">
                  <div className="flex items-center gap-2 mb-1">
                    <Heart className="w-4 h-4 text-pink-600" />
                    <h4 className="text-sm font-extrabold text-[#1A1C1C]">Caregiver Information</h4>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <FormField label="Person Name (Being Cared For)">
                      <input
                        value={carePersonName}
                        onChange={e => setCarePersonName(e.target.value)}
                        placeholder="e.g. John Doe"
                        className="w-full h-12 rounded-xl border border-gray-200 px-4 text-sm outline-none focus:border-[#8A38F5] bg-white"
                      />
                    </FormField>
                    <FormField label="Relation to Person">
                      <input
                        value={careRelation}
                        onChange={e => setCareRelation(e.target.value)}
                        placeholder="e.g. Brother, Parent, Spouse"
                        className="w-full h-12 rounded-xl border border-gray-200 px-4 text-sm outline-none focus:border-[#8A38F5] bg-white"
                      />
                    </FormField>
                  </div>
                  <FormField label="Care Person Date of Birth">
                    <input
                      type="date"
                      value={careDob}
                      onChange={e => setCareDob(e.target.value)}
                      className="w-full h-12 rounded-xl border border-gray-200 px-4 text-sm outline-none focus:border-[#8A38F5] bg-white"
                    />
                  </FormField>
                  <div>
                    <p className="text-xs font-bold text-[#1A1C1C] mb-1.5">Care Person Disability Type(s)</p>
                    <div className="flex flex-wrap gap-2">
                      {disabilityOptions.map((name) => {
                        const selected = selectedCareDisabilities.includes(name);
                        return (
                          <button
                            key={name}
                            type="button"
                            onClick={() => toggleCareDisability(name)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 border ${
                              selected
                                ? "bg-pink-600 text-white border-pink-600 shadow-sm"
                                : "bg-white text-[#4B4355] border-gray-200 hover:border-pink-300"
                            }`}
                          >
                            {selected && <CheckCircle2 className="w-3.5 h-3.5" />}
                            {name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* Therapist Details */}
              {hasRole("THERAPIST") && (
                <div className="bg-[#FAF9FC] p-5 rounded-2xl border border-gray-100 space-y-4">
                  <div className="flex items-center gap-2 mb-1">
                    <Star className="w-4 h-4 text-green-600" />
                    <h4 className="text-sm font-extrabold text-[#1A1C1C]">Professional / Therapist Details</h4>
                  </div>
                  <FormField label="Speciality / Field">
                    <input
                      value={speciality}
                      onChange={e => setSpeciality(e.target.value)}
                      placeholder="e.g. Occupational Therapy, Special Education"
                      className="w-full h-12 rounded-xl border border-gray-200 px-4 text-sm outline-none focus:border-[#8A38F5] bg-white"
                    />
                  </FormField>
                  <div className="grid grid-cols-2 gap-4">
                    <FormField label="Organisation / Hospital / Clinic">
                      <input
                        value={organization}
                        onChange={e => setOrganization(e.target.value)}
                        placeholder="e.g. Apollo Hospitals"
                        className="w-full h-12 rounded-xl border border-gray-200 px-4 text-sm outline-none focus:border-[#8A38F5] bg-white"
                      />
                    </FormField>
                    <FormField label="Years of Experience">
                      <input
                        type="number"
                        min="0"
                        max="60"
                        value={yearsOfExperience}
                        onChange={e => setYearsOfExperience(e.target.value)}
                        placeholder="e.g. 5"
                        className="w-full h-12 rounded-xl border border-gray-200 px-4 text-sm outline-none focus:border-[#8A38F5] bg-white"
                      />
                    </FormField>
                  </div>
                </div>
              )}

              {/* NGO Details */}
              {hasRole("NGO") && (
                <div className="bg-[#FAF9FC] p-5 rounded-2xl border border-gray-100 space-y-4">
                  <div className="flex items-center gap-2 mb-1">
                    <Building2 className="w-4 h-4 text-blue-600" />
                    <h4 className="text-sm font-extrabold text-[#1A1C1C]">NGO Information</h4>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <FormField label="NGO Name">
                      <input
                        value={ngoName}
                        onChange={e => setNgoName(e.target.value)}
                        placeholder="e.g. HelpAge India"
                        className="w-full h-12 rounded-xl border border-gray-200 px-4 text-sm outline-none focus:border-[#8A38F5] bg-white"
                      />
                    </FormField>
                    <FormField label="Role in NGO">
                      <input
                        value={ngoRole}
                        onChange={e => setNgoRole(e.target.value)}
                        placeholder="e.g. Coordinator"
                        className="w-full h-12 rounded-xl border border-gray-200 px-4 text-sm outline-none focus:border-[#8A38F5] bg-white"
                      />
                    </FormField>
                  </div>
                  <FormField label="Operational District">
                    <input
                      value={district}
                      onChange={e => setDistrict(e.target.value)}
                      placeholder="e.g. Pune"
                      className="w-full h-12 rounded-xl border border-gray-200 px-4 text-sm outline-none focus:border-[#8A38F5] bg-white"
                    />
                  </FormField>
                </div>
              )}
              {error && <p className="text-xs text-red-500 font-semibold">{error}</p>}
            </div>
          )}

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
