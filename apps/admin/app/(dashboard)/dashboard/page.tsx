"use client";

import {
  Users,
  ShieldAlert,
  MessageSquare,
  CalendarDays,
  Activity,
  Settings,
  TrendingUp,
  AlertTriangle,
  FileText,
  HelpCircle,
} from "lucide-react";
import Link from "next/link";

// ----------------------
// STATS DATA
// ----------------------

const statsCards = [
  {
    title: "Total Users",
    value: "148",
    change: "+12%",
    description: "Registered community members",
    icon: <Users className="w-5 h-5 text-[#7004DC]" />,
    badgeBg: "bg-[#D2A500]/20",
    badgeText: "text-[#755B00]",
    iconBg: "bg-[#8A38F5]/10",
  },

  {
    title: "Active Forums",
    value: "24",
    change: "Live",
    description: "Running discussion forums",
    icon: (
      <MessageSquare className="w-5 h-5 text-[#7004DC]" />
    ),
    badgeBg: "bg-[#EEEEEE]",
    badgeText: "text-slate-500",
    iconBg: "bg-[#8A38F5]/10",
  },

  {
    title: "Pending Actions",
    value: "3",
    change: "Urgent",
    description: "Reports requiring review",
    icon: (
      <ShieldAlert className="w-5 h-5 text-[#755B00]" />
    ),
    badgeBg: "bg-red-100",
    badgeText: "text-red-700",
    iconBg: "bg-[#D2A500]/10",
  },

  {
    title: "Events This Month",
    value: "8",
    description: "Scheduled accessibility events",
    icon: (
      <CalendarDays className="w-5 h-5 text-[#7004DC]" />
    ),
    iconBg: "bg-[#8A38F5]/10",
  },
];

// ----------------------
// ACTIVITY DATA
// ----------------------

const activityRows = [
  {
    name: "Anaya",
    category: "Forum",
    action: "Posted Comment",
    time: "2 min ago",
    status: "Completed",
    statusColor: "bg-green-100 text-green-700",
  },

  {
    name: "Rahul",
    category: "NGO",
    action: "Application Review",
    time: "10 min ago",
    status: "Pending",
    statusColor: "bg-yellow-100 text-yellow-700",
  },

  {
    name: "Sarah",
    category: "Community",
    action: "Accessibility Report",
    time: "25 min ago",
    status: "In Progress",
    statusColor: "bg-blue-100 text-blue-700",
  },

  {
    name: "Vikram",
    category: "Moderation",
    action: "Comment Removal",
    time: "1 hr ago",
    status: "Rejected",
    statusColor: "bg-red-100 text-red-700",
  },
];

// ----------------------
// COMPONENT
// ----------------------

export default function DashboardPage() {
  return (
    <div className="max-w-7xl mx-auto px-6 lg:px-8 py-10 space-y-8">

      {/* HEADER */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">

        <div>
          <h1 className="text-4xl font-extrabold tracking-tight text-[#1A1C1C]">
            Dashboard Overview
          </h1>

          <p className="text-slate-500 mt-2 text-sm md:text-base">
            Monitor platform activity, user engagement and administrative actions.
          </p>
        </div>

        <button className="h-12 px-5 rounded-2xl bg-[#7004DC] hover:bg-[#5c03b7] transition text-white font-semibold shadow-lg shadow-violet-300/30">
          Generate Report
        </button>
      </div>

      {/* STATS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">

        {statsCards.map((card, index) => (
          <div
            key={index}
            className="bg-white rounded-[24px] p-6 shadow-sm border border-gray-100"
          >

            <div className="flex items-start justify-between">

              <div
                className={`w-12 h-12 rounded-xl flex items-center justify-center ${card.iconBg}`}
              >
                {card.icon}
              </div>

              {card.change && (
                <div
                  className={`px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wide ${card.badgeBg} ${card.badgeText}`}
                >
                  {card.change}
                </div>
              )}
            </div>

            <div className="mt-8">

              <p className="text-sm font-medium text-slate-500">
                {card.title}
              </p>

              <h2 className="text-4xl font-extrabold tracking-tight text-[#1A1C1C] mt-2">
                {card.value}
              </h2>

              <p className="text-xs text-slate-400 mt-4">
                {card.description}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* GRID */}
      <div className="grid grid-cols-1 xl:grid-cols-[2fr_1fr] gap-8">

        {/* LEFT */}
        <div className="space-y-8">

          {/* ANALYTICS */}
          <div className="bg-white rounded-[24px] p-8 shadow-sm border border-gray-100">

            <div className="flex items-center justify-between">

              <div>
                <h3 className="text-xl font-extrabold text-[#1A1C1C]">
                  User Growth
                </h3>

                <p className="text-sm text-slate-500 mt-1">
                  Platform engagement over the last 7 months
                </p>
              </div>

              <div className="flex items-center gap-2">

                <button className="px-4 py-1.5 rounded-lg bg-[#EEEEEE] text-xs font-bold">
                  Monthly
                </button>

                <button className="px-4 py-1.5 rounded-lg bg-[#7004DC] text-white text-xs font-bold">
                  Weekly
                </button>
              </div>
            </div>

            {/* CHART */}
            <div className="mt-10">

              {/* CHART CONTAINER */}
              <div className="relative h-[320px]">

                {/* GRID LINES */}
                <div className="absolute inset-0 flex flex-col justify-between">

                  {[1, 2, 3, 4].map((line) => (
                    <div
                      key={line}
                      className="border-b border-[#CEC2D8]/20"
                    />
                  ))}
                </div>

                {/* SVG GRAPH */}
                <svg
                  viewBox="0 0 600 260"
                  className="absolute inset-0 w-full h-full"
                  preserveAspectRatio="none"
                >
                  {/* GRADIENT */}
                  <defs>
                    <linearGradient
                      id="paintGradient"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop
                        offset="0%"
                        stopColor="#8A38F5"
                        stopOpacity="0.25"
                      />

                      <stop
                        offset="100%"
                        stopColor="#8A38F5"
                        stopOpacity="0"
                      />
                    </linearGradient>
                  </defs>

                  {/* AREA */}
                  <path
                    d="
      M0,180
      C50,160 80,120 120,130
      C170,145 210,80 260,90
      C310,100 350,40 400,60
      C450,75 500,20 600,40
      L600,260
      L0,260
      Z
    "
                    fill="url(#paintGradient)"
                  />

                  {/* LINE */}
                  <path
                    d="
      M0,180
      C50,160 80,120 120,130
      C170,145 210,80 260,90
      C310,100 350,40 400,60
      C450,75 500,20 600,40
    "
                    fill="none"
                    stroke="#8A38F5"
                    strokeWidth="4"
                    strokeLinecap="round"
                  />

                  {/* FINAL POINT */}
                  <circle
                    cx="600"
                    cy="40"
                    r="7"
                    fill="#8A38F5"
                  />
                </svg>

                {/* LABELS */}
                <div className="absolute bottom-0 left-0 right-0 flex justify-between pt-6 text-[10px] font-bold tracking-wide uppercase text-slate-400 translate-y-8">

                  <span>Jan</span>
                  <span>Feb</span>
                  <span>Mar</span>
                  <span>Apr</span>
                  <span>May</span>
                  <span>Jun</span>
                  <span>Jul</span>
                </div>
              </div>
            </div>
          </div>

          {/* TABLE */}
          <div className="bg-white rounded-[24px] shadow-sm border border-gray-100 overflow-hidden">

            <div className="px-8 pt-8 pb-6">

              <h3 className="text-xl font-extrabold text-[#1A1C1C]">
                Recent Activity
              </h3>
            </div>

            <div className="overflow-x-auto">

              <table className="w-full">

                <thead className="bg-[#F3F3F3]">
                  <tr>

                    <th className="px-8 py-4 text-left text-[11px] uppercase tracking-wider text-slate-500">
                      User
                    </th>

                    <th className="px-6 py-4 text-left text-[11px] uppercase tracking-wider text-slate-500">
                      Category
                    </th>

                    <th className="px-6 py-4 text-left text-[11px] uppercase tracking-wider text-slate-500">
                      Action
                    </th>

                    <th className="px-6 py-4 text-left text-[11px] uppercase tracking-wider text-slate-500">
                      Time
                    </th>

                    <th className="px-8 py-4 text-right text-[11px] uppercase tracking-wider text-slate-500">
                      Status
                    </th>
                  </tr>
                </thead>

                <tbody>

                  {activityRows.map((row, index) => (
                    <tr
                      key={index}
                      className="border-t border-gray-100"
                    >

                      <td className="px-8 py-6">

                        <div className="flex items-center gap-3">

                          <div className="w-10 h-10 rounded-full bg-[#7004DC]/10 flex items-center justify-center text-[#7004DC] font-bold text-sm">
                            {row.name.charAt(0)}
                          </div>

                          <span className="font-semibold text-[#1A1C1C]">
                            {row.name}
                          </span>
                        </div>
                      </td>

                      <td className="px-6 py-6 text-sm text-slate-600">
                        {row.category}
                      </td>

                      <td className="px-6 py-6 text-sm font-medium text-[#7004DC]">
                        {row.action}
                      </td>

                      <td className="px-6 py-6 text-sm text-slate-400">
                        {row.time}
                      </td>

                      <td className="px-8 py-6 text-right">

                        <span
                          className={`px-4 py-1.5 rounded-full text-[11px] uppercase tracking-wide font-bold ${row.statusColor}`}
                        >
                          {row.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="bg-[#F3F3F3] p-4 text-center">

              <button className="text-[#7004DC] font-bold text-sm">
                View Full Activity Log
              </button>
            </div>
          </div>
        </div>

        {/* RIGHT */}
        <div className="space-y-8">

          {/* ATTENTION */}
          <div className="bg-white border-l-4 border-red-600 rounded-[24px] p-8 shadow-sm border border-gray-100">

            <div className="flex items-center gap-3">

              <AlertTriangle className="w-5 h-5 text-red-600" />

              <h3 className="text-xl font-extrabold text-[#1A1C1C]">
                Needs Attention
              </h3>
            </div>

            <div className="mt-8 space-y-4">

              <AttentionCard
                title="NGO Verification"
                subtitle="Clean Water Project"
                desc="Verification of NGO banking documents required."
                danger={false}
              />

              <AttentionCard
                title="Reported Content"
                subtitle="Mental Health Forum"
                desc="Reported by multiple independent users."
                danger
              />

              <AttentionCard
                title="New Registration"
                subtitle="Bright Futures Education"
                desc="New registration requires manual review."
                danger={false}
              />
            </div>

            <button className="w-full h-11 rounded-xl bg-[#EEEEEE] hover:bg-[#e5e5e5] transition mt-6 text-sm font-extrabold tracking-wide uppercase">
              Resolve All Issues
            </button>
          </div>

          {/* QUICK LINKS */}
          <div className="bg-white rounded-[24px] p-8 shadow-sm border border-gray-100">

            <h3 className="text-xl font-extrabold text-[#1A1C1C]">
              Quick Controls
            </h3>

            <div className="grid grid-cols-2 gap-4 mt-8">

              <QuickLink
                href="/settings"
                icon={<Settings className="w-5 h-5" />}
                label="Settings"
              />

              <QuickLink
                href="/analytics"
                icon={<Activity className="w-5 h-5" />}
                label="Analytics"
              />

              <QuickLink
                href="#"
                icon={<FileText className="w-5 h-5" />}
                label="Logs"
              />

              <QuickLink
                href="#"
                icon={<HelpCircle className="w-5 h-5" />}
                label="Support"
              />
            </div>
          </div>

          {/* DONUT */}
          <div className="bg-white rounded-[24px] p-8 shadow-sm border border-gray-100">

            <h3 className="text-xl font-extrabold text-[#1A1C1C]">
              Applications Status
            </h3>

            <div className="flex items-center justify-center py-10">

              <div className="relative w-48 h-48 rounded-full border-[22px] border-[#EEEEEE]">

                <div className="absolute inset-0 rounded-full border-[22px] border-transparent border-t-[#8A38F5] border-r-[#8A38F5] rotate-45" />

                <div className="absolute inset-4 bg-white rounded-full flex items-center justify-center flex-col">

                  <TrendingUp className="w-6 h-6 text-[#7004DC]" />

                  <span className="text-3xl font-extrabold mt-2">
                    74%
                  </span>

                  <span className="text-xs text-slate-400 mt-1">
                    Approved
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ----------------------
// ATTENTION CARD
// ----------------------

type AttentionCardProps = {
  title: string;
  subtitle: string;
  desc: string;
  danger?: boolean;
};

const AttentionCard = ({
  title,
  subtitle,
  desc,
  danger,
}: AttentionCardProps) => {
  return (
    <div className="bg-[#F3F3F3] rounded-2xl p-4">

      <div className="flex items-center justify-between">

        <span
          className={`text-[11px] font-extrabold uppercase tracking-wide ${danger ? "text-red-700" : "text-[#7004DC]"
            }`}
        >
          {title}
        </span>

        <span className="text-[10px] text-slate-400 font-bold">
          Today
        </span>
      </div>

      <h4 className="mt-3 text-sm font-bold text-[#1A1C1C]">
        {subtitle}
      </h4>

      <p className="mt-2 text-xs text-slate-500 leading-5">
        {desc}
      </p>
    </div>
  );
};

// ----------------------
// QUICK LINK
// ----------------------

type QuickLinkProps = {
  href: string;
  icon: React.ReactNode;
  label: string;
};

const QuickLink = ({
  href,
  icon,
  label,
}: QuickLinkProps) => {
  return (
    <Link
      href={href}
      className="bg-[#F3F3F3] rounded-2xl p-5 hover:bg-[#8A38F5]/10 hover:text-[#7004DC] transition flex flex-col items-center justify-center gap-3 text-slate-700 font-semibold"
    >
      {icon}

      <span className="text-sm">
        {label}
      </span>
    </Link>
  );
};