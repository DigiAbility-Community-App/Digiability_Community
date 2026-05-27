"use client";

// ----------------------
// IMPORTS
// ----------------------

import Link from "next/link";
import { useState, useEffect } from "react";

import {
  Search,
  ChevronDown,
  Eye,
  MoreHorizontal,
  Download,
  Ban,
  Trash2,
  CheckCircle2,
  Users,
  UserCheck,
  UserX,
  ShieldAlert,
} from "lucide-react";

// ----------------------
// COMPONENT
// ----------------------

export default function UserManagementPage() {
  // ----------------------
  // STATES
  // ----------------------

  const [usersList, setUsersList] = useState<any[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [stats, setStats] = useState({ total: "0", active: "0", inactive: "0", suspended: "0" });
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  const [selectedRole, setSelectedRole] = useState("ALL");
  const [selectedStatus, setSelectedStatus] = useState("ALL");
  const [roleDropdownOpen, setRoleDropdownOpen] = useState(false);
  const [statusDropdownOpen, setStatusDropdownOpen] = useState(false);

  // ----------------------
  // EFFECTS
  // ----------------------

  useEffect(() => {
    async function fetchUsers() {
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
    }
    fetchUsers();
  }, []);

  // ----------------------
  // FUNCTIONS
  // ----------------------

  const toggleUserSelection = (id: string) => {
    setSelectedUsers((prev) =>
      prev.includes(id)
        ? prev.filter((item) => item !== id)
        : [...prev, id]
    );
  };

  const toggleAllUsers = () => {
    if (selectedUsers.length === filteredUsers.length) {
      setSelectedUsers([]);
    } else {
      setSelectedUsers(filteredUsers.map((user) => user.id));
    }
  };

  // Filter users based on search query, role, and status
  const filteredUsers = usersList.filter(user => {
    const matchesSearch =
      user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.location.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesRole =
      selectedRole === "ALL" ||
      (user.roles && user.roles.includes(selectedRole));

    const matchesStatus =
      selectedStatus === "ALL" ||
      user.status === selectedStatus;

    return matchesSearch && matchesRole && matchesStatus;
  });

  // ----------------------
  // RENDER
  // ----------------------

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-10 h-10 border-4 border-[#7004DC] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="px-8 py-8 space-y-6 relative">
      {/* HEADER */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-extrabold tracking-tight text-[#1A1C1C]">
            User Management
          </h1>
          <p className="text-sm text-[#7D7387] mt-2">
            Manage all registered community users and permissions
          </p>
        </div>

        <button className="h-12 px-5 rounded-xl bg-[#7004DC] hover:bg-[#5f03bb] transition text-white font-bold shadow-lg shadow-violet-300/30">
          Add New User
        </button>
      </div>

      {/* STATS ROW */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        <StatsCard
          title="Total Users"
          value={stats.total}
          icon={<Users className="w-5 h-5" />}
          valueColor="text-[#1A1C1C]"
        />

        <StatsCard
          title="Active"
          value={stats.active}
          growth="+12%"
          icon={<UserCheck className="w-5 h-5" />}
          valueColor="text-green-600"
        />

        <StatsCard
          title="Inactive"
          value={stats.inactive}
          icon={<UserX className="w-5 h-5" />}
          valueColor="text-slate-400"
        />

        <StatsCard
          title="Suspended"
          value={stats.suspended}
          icon={<ShieldAlert className="w-5 h-5" />}
          valueColor="text-red-600"
        />
      </div>

      {/* FILTER BAR */}
      <div className="bg-[#F3F3F3] rounded-2xl p-4 flex flex-col xl:flex-row xl:items-center gap-4">
        {/* SEARCH */}
        <div className="relative w-full xl:w-[320px]">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#7D7387]" />
          <input
            type="text"
            placeholder="Search by name, email or ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-11 rounded-xl bg-white pl-11 pr-4 text-sm outline-none border border-transparent focus:border-[#8A38F5]"
          />
        </div>

        {/* ROLE FILTER */}
        <div className="relative z-50">
          <button
            onClick={() => {
              setRoleDropdownOpen(!roleDropdownOpen);
              setStatusDropdownOpen(false);
            }}
            className="h-11 px-4 bg-white rounded-xl flex items-center justify-between gap-6 text-sm font-medium text-[#1A1C1C] min-w-[160px] border border-gray-200/50 shadow-sm"
          >
            <span>{selectedRole === "ALL" ? "All Roles" : selectedRole}</span>
            <ChevronDown className="w-4 h-4 text-slate-500" />
          </button>

          {roleDropdownOpen && (
            <div className="absolute left-0 mt-2 w-48 bg-white border border-gray-100 rounded-xl shadow-lg z-50 py-1">
              <button
                onClick={() => {
                  setSelectedRole("ALL");
                  setRoleDropdownOpen(false);
                }}
                className={`w-full text-left px-4 py-2.5 text-xs font-semibold hover:bg-[#F3F3F3] ${selectedRole === "ALL" ? "font-bold text-[#7004DC]" : "text-[#4B4355]"}`}
              >
                All Roles
              </button>
              {["PWD", "CAREGIVER", "THERAPIST", "NGO", "VOLUNTEER", "STUDENT"].map((role) => (
                <button
                  key={role}
                  onClick={() => {
                    setSelectedRole(role);
                    setRoleDropdownOpen(false);
                  }}
                  className={`w-full text-left px-4 py-2.5 text-xs font-semibold hover:bg-[#F3F3F3] ${selectedRole === role ? "font-bold text-[#7004DC]" : "text-[#4B4355]"}`}
                >
                  {role}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* STATUS FILTER */}
        <div className="relative z-50">
          <button
            onClick={() => {
              setStatusDropdownOpen(!statusDropdownOpen);
              setRoleDropdownOpen(false);
            }}
            className="h-11 px-4 bg-white rounded-xl flex items-center justify-between gap-6 text-sm font-medium text-[#1A1C1C] min-w-[160px] border border-gray-200/50 shadow-sm"
          >
            <span>{selectedStatus === "ALL" ? "All Statuses" : selectedStatus}</span>
            <ChevronDown className="w-4 h-4 text-slate-500" />
          </button>

          {statusDropdownOpen && (
            <div className="absolute left-0 mt-2 w-48 bg-white border border-gray-100 rounded-xl shadow-lg z-50 py-1">
              <button
                onClick={() => {
                  setSelectedStatus("ALL");
                  setStatusDropdownOpen(false);
                }}
                className={`w-full text-left px-4 py-2.5 text-xs font-semibold hover:bg-[#F3F3F3] ${selectedStatus === "ALL" ? "font-bold text-[#7004DC]" : "text-[#4B4355]"}`}
              >
                All Statuses
              </button>
              {["Active", "Inactive", "Suspended"].map((status) => (
                <button
                  key={status}
                  onClick={() => {
                    setSelectedStatus(status);
                    setStatusDropdownOpen(false);
                  }}
                  className={`w-full text-left px-4 py-2.5 text-xs font-semibold hover:bg-[#F3F3F3] ${selectedStatus === status ? "font-bold text-[#7004DC]" : "text-[#4B4355]"}`}
                >
                  {status}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* EXPORT */}
        <button className="h-11 px-5 bg-white rounded-xl flex items-center gap-2 text-sm font-semibold text-[#7004DC]">
          <Download className="w-4 h-4" />
          Export Users
        </button>
      </div>

      {/* TABLE */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {/* TABLE HEADER */}
        <div className="bg-[#F3F3F3] border-b border-gray-200">
          <div className="grid grid-cols-[60px_2fr_1fr_1fr_1fr_1fr_120px] items-center">
            {/* CHECKBOX */}
            <div className="p-6">
              <input
                type="checkbox"
                checked={
                  filteredUsers.length > 0 &&
                  selectedUsers.length === filteredUsers.length
                }
                onChange={toggleAllUsers}
                className="w-4 h-4 rounded border-gray-400 accent-[#7004DC]"
              />
            </div>

            <TableHeading label="User" />
            <TableHeading label="Role" />
            <TableHeading label="Joined" />
            <TableHeading label="Location" />
            <TableHeading label="Status" />
            <TableHeading label="Actions" />
          </div>
        </div>

        {/* TABLE BODY */}
        <div>
          {filteredUsers.length === 0 ? (
            <div className="h-64 flex items-center justify-center text-[#7D7387] font-semibold">
              No users found matching your search.
            </div>
          ) : (
            filteredUsers.map((user) => (
              <div
                key={user.id}
                className="grid grid-cols-[60px_2fr_1fr_1fr_1fr_1fr_120px] items-center border-b border-gray-100 hover:bg-[#FAFAFA] transition"
              >
                {/* CHECKBOX */}
                <div className="p-6">
                  <input
                    type="checkbox"
                    checked={selectedUsers.includes(user.id)}
                    onChange={() => toggleUserSelection(user.id)}
                    className="w-4 h-4 rounded border-gray-400 accent-[#7004DC]"
                  />
                </div>

                {/* USER */}
                <div className="flex items-center gap-4 py-5">
                  <div
                    className={`w-11 h-11 rounded-full flex items-center justify-center font-bold text-sm ${user.status === "Suspended"
                        ? "bg-gray-200 text-gray-700"
                        : "bg-[#EDDCFF] text-[#7004DC]"
                      }`}
                  >
                    {user.name
                      .split(" ")
                      .map((n: string) => n[0])
                      .join("")}
                  </div>

                  <div>
                    <h3 className="font-bold text-sm text-[#1A1C1C]">
                      {user.name}
                    </h3>
                    <p className="text-xs text-[#7D7387] mt-1">
                      {user.email}
                    </p>
                  </div>
                </div>

                {/* ROLE */}
                <div className="flex flex-wrap gap-1">
                  {user.roles && user.roles.length > 0 ? (
                    user.roles.map((r: string, idx: number) => (
                      <span
                        key={idx}
                        className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase ${r === "NGO"
                            ? "bg-gray-200 text-[#4B4355]"
                            : "bg-[#EEDBFF] text-[#7004DC]"
                          }`}
                      >
                        {r}
                      </span>
                    ))
                  ) : (
                    <span className="px-2 py-1 rounded-md text-[10px] font-bold uppercase bg-slate-100 text-slate-500">
                      USER
                    </span>
                  )}
                </div>

                {/* JOINED */}
                <div className="text-sm text-[#4B4355]">
                  {user.joined}
                </div>

                {/* LOCATION */}
                <div className="text-sm text-[#4B4355]">
                  {user.location}
                </div>

                {/* STATUS */}
                <div>
                  <span
                    className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold ${user.status === "Active"
                        ? "bg-green-100 text-green-700"
                        : user.status === "Inactive"
                          ? "bg-gray-200 text-gray-600"
                          : "bg-red-100 text-red-700"
                      }`}
                  >
                    <div
                      className={`w-2 h-2 rounded-full ${user.status === "Active"
                          ? "bg-green-600"
                          : user.status === "Inactive"
                            ? "bg-gray-500"
                            : "bg-red-600"
                        }`}
                    />
                    {user.status}
                  </span>
                </div>

                {/* ACTIONS */}
                <div className="flex items-center gap-2">
                  <button className="w-9 h-9 rounded-lg hover:bg-violet-50 flex items-center justify-center text-[#8A38F5] transition">
                    <Eye className="w-4 h-4" />
                  </button>
                  <button className="w-9 h-9 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-500 transition">
                    <MoreHorizontal className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* FOOTER */}
        <div className="bg-[#F3F3F3] px-6 py-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          {/* LEFT */}
          <div className="flex items-center gap-4 text-sm text-[#7D7387]">
            <span>Rows per page</span>
            <button className="h-9 px-3 rounded-lg bg-white flex items-center gap-2">
              10
              <ChevronDown className="w-4 h-4" />
            </button>
            <span>
              Showing 1–{filteredUsers.length} of {usersList.length} users
            </span>
          </div>

          {/* PAGINATION */}
          <div className="flex items-center gap-2">
            <button className="w-9 h-9 rounded-lg bg-white text-slate-400">
              ←
            </button>
            <button className="w-9 h-9 rounded-lg bg-[#7004DC] text-white font-bold">
              1
            </button>
            <button className="w-9 h-9 rounded-lg bg-white text-slate-500 font-bold">
              2
            </button>
            <button className="w-9 h-9 rounded-lg bg-white text-slate-500 font-bold">
              3
            </button>
            <button className="w-9 h-9 rounded-lg bg-white text-slate-500">
              →
            </button>
          </div>
        </div>
      </div>

      {/* BULK ACTIONS */}
      {selectedUsers.length > 0 && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 bg-[#280056] shadow-2xl rounded-2xl px-6 py-4 flex items-center gap-8">
          {/* SELECTED */}
          <div className="flex items-center gap-3 border-r border-white/20 pr-8">
            <div className="w-7 h-7 rounded-full bg-[#D2A500] flex items-center justify-center text-xs font-bold text-[#4F3D00]">
              {selectedUsers.length}
            </div>
            <span className="text-white font-semibold text-sm">
              Selected Users
            </span>
          </div>

          {/* ACTIONS */}
          <div className="flex items-center gap-4">
            <button className="flex items-center gap-2 text-sm text-white hover:text-violet-200 transition">
              <CheckCircle2 className="w-4 h-4" />
              Activate
            </button>
            <button className="flex items-center gap-2 text-sm text-white hover:text-yellow-300 transition">
              <Ban className="w-4 h-4" />
              Suspend
            </button>
            <button className="flex items-center gap-2 text-sm text-red-300 hover:text-red-200 transition">
              <Trash2 className="w-4 h-4" />
              Delete
            </button>
          </div>
        </div>
      )}

      {/* DROPDOWN BACKDROP */}
      {(roleDropdownOpen || statusDropdownOpen) && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => {
            setRoleDropdownOpen(false);
            setStatusDropdownOpen(false);
          }}
        />
      )}
    </div>
  );
}

// ----------------------
// STATS CARD
// ----------------------

type StatsCardProps = {
  title: string;
  value: string;
  icon: React.ReactNode;
  valueColor: string;
  growth?: string;
};

const StatsCard = ({
  title,
  value,
  icon,
  valueColor,
  growth,
}: StatsCardProps) => {
  return (
    <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-semibold text-[#7D7387]">
            {title}
          </p>
          <div className="flex items-end gap-2 mt-3">
            <h2 className={`text-4xl font-extrabold tracking-tight ${valueColor}`}>
              {value}
            </h2>
            {growth && (
              <span className="text-xs font-bold text-green-600 mb-2">
                {growth}
              </span>
            )}
          </div>
        </div>
        <div className="w-11 h-11 rounded-xl bg-[#F3E8FF] flex items-center justify-center text-[#7004DC]">
          {icon}
        </div>
      </div>
    </div>
  );
};

// ----------------------
// TABLE HEADER
// ----------------------

type TableHeadingProps = {
  label: string;
};

const TableHeading = ({
  label,
}: TableHeadingProps) => {
  return (
    <div className="px-6 py-5 text-[11px] font-bold uppercase tracking-[0.15em] text-[#7D7387]">
      {label}
    </div>
  );
};