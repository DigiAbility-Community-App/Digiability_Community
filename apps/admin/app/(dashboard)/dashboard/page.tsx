"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Users, MessageSquare, ShieldAlert, CalendarDays,
  RefreshCw, AlertTriangle, TrendingUp, ChevronRight,
} from "lucide-react";

// ─────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────
interface DashboardStats {
  totalUsers: string;
  forumQuestions: string;
  pendingReports: string;
  eventsThisMonth: string;
  newUsersWeek: string;
}

interface ActivityItem {
  id?: string;
  name: string;
  initials: string;
  action: string;
  module: string;
  date: string;
  status: "OPEN" | "RESOLVED" | "PENDING" | "APPROVED";
}

interface AttentionItem {
  category: string;
  categoryColor: string;
  time: string;
  title: string;
  desc: string;
}

interface VerificationCounts {
  verified: number;
  pending: number;
  rejected: number;
  total: number;
}

interface GrowthPoint {
  month: string;
  count: string;
}

const MODULE_BADGE_STYLE: Record<string, { bg: string; text: string }> = {
  Auth:       { bg: "bg-purple-50",  text: "text-purple-700"  },
  Users:      { bg: "bg-purple-50",  text: "text-purple-700"  },
  Forums:     { bg: "bg-blue-50",    text: "text-blue-700"    },
  Events:     { bg: "bg-emerald-50", text: "text-emerald-700" },
  Moderation: { bg: "bg-orange-50",  text: "text-orange-700"  },
};

const STATUS_STYLE: Record<string, { bg: string; text: string }> = {
  OPEN:     { bg: "bg-blue-100",   text: "text-blue-700"   },
  RESOLVED: { bg: "bg-green-100",  text: "text-green-700"  },
  PENDING:  { bg: "bg-amber-100",  text: "text-amber-700"  },
  APPROVED: { bg: "bg-green-100",  text: "text-green-700"  },
};

// ─────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────
export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats>({
    totalUsers: "0", forumQuestions: "0",
    pendingReports: "0", eventsThisMonth: "0", newUsersWeek: "0",
  });
  const [activityRows, setActivityRows] = useState<ActivityItem[]>([]);
  const [attentionItems, setAttentionItems] = useState<AttentionItem[]>([]);
  const [verificationCounts, setVerificationCounts] = useState<VerificationCounts>({ verified: 0, pending: 0, rejected: 0, total: 0 });
  const [userGrowth, setUserGrowth] = useState<GrowthPoint[]>([]);
  const [growthPeriod, setGrowthPeriod] = useState<"6M" | "1Y">("1Y");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const today = new Date().toLocaleDateString("en-GB", {
    weekday: "long", day: "2-digit", month: "long", year: "numeric",
  });

  const fetchAll = useCallback(async () => {
    try {
      const [eventsRes, moderationRes, analyticsRes] = await Promise.all([
        fetch("/api/events"),
        fetch("/api/moderation"),
        fetch("/api/analytics"),
      ]);

      const [eventsData, modData, analyticsData] = await Promise.all([
        eventsRes.json(), moderationRes.json(), analyticsRes.json(),
      ]);

      // ── Accurate Platform Stats ──
      const totalUsers = analyticsData.success && analyticsData.users?.total
        ? Number(analyticsData.users.total).toLocaleString()
        : "0";
      const forumQ = analyticsData.success && analyticsData.forums?.totalQuestions
        ? Number(analyticsData.forums.totalQuestions).toLocaleString()
        : "0";
      const pendingRep = modData.success && modData.stats?.totalReports
        ? String(modData.stats.totalReports)
        : "0";
      const eventsCount = eventsData.success && Array.isArray(eventsData.events)
        ? String(eventsData.events.length)
        : "0";
      const newWeek = analyticsData.success && analyticsData.users?.newThisWeek
        ? String(analyticsData.users.newThisWeek)
        : "0";

      setStats({
        totalUsers,
        forumQuestions: forumQ,
        pendingReports: pendingRep,
        eventsThisMonth: eventsCount,
        newUsersWeek: newWeek,
      });

      // ── Continuous User Growth Chart ──
      if (analyticsData.success && Array.isArray(analyticsData.userGrowth)) {
        setUserGrowth(analyticsData.userGrowth);
      }

      // ── Real Unified Recent Activity Feed ──
      if (analyticsData.success && Array.isArray(analyticsData.recentActivity) && analyticsData.recentActivity.length > 0) {
        setActivityRows(analyticsData.recentActivity);
      } else if (modData.success && Array.isArray(modData.reports)) {
        // Fallback if analytics recentActivity is empty
        const rows: ActivityItem[] = modData.reports.slice(0, 5).map((r: any) => {
          const name = r.reporterName || "User";
          const words = name.trim().split(/\s+/);
          const initials = ((words[0]?.[0] ?? "") + (words[1]?.[0] ?? "")).toUpperCase() || "U";
          return {
            name,
            initials,
            action: `Reported content: ${r.reason || "Violation"}`,
            module: "Moderation",
            date: r.createdAt || "—",
            status: "PENDING" as const,
          };
        });
        setActivityRows(rows);
      }

      // ── Needs Attention (Pending Moderation Reports) ──
      if (modData.success && Array.isArray(modData.reports) && modData.reports.length > 0) {
        const items: AttentionItem[] = modData.reports.slice(0, 3).map((r: any, i: number) => {
          const colors = ["text-orange-600", "text-red-600", "text-[#7004DC]"];
          const cats = ["CONTENT REPORT", "MODERATION FLAG", "USER REPORT"];
          return {
            category: cats[i % cats.length],
            categoryColor: colors[i % colors.length],
            time: r.createdAt || "Recently",
            title: r.questionTitle || r.answerContent || "Reported Content",
            desc: r.reason || "Requires moderation review.",
          };
        });
        setAttentionItems(items);
      } else {
        setAttentionItems([]);
      }

      // ── Full-database User status breakdown for Donut ──
      if (analyticsData.success && analyticsData.users) {
        const totalU = Math.max(Number(analyticsData.users.total) || 0, 0);
        const verified = Math.max(Number(analyticsData.users.active) || 0, 0);
        const inactive = Math.max(Number(analyticsData.users.inactive) || 0, 0);
        const suspended = Math.max(Number(analyticsData.users.suspended) || 0, 0);
        setVerificationCounts({ verified, pending: inactive, rejected: suspended, total: totalU });
      }
    } catch (e) {
      console.error("Dashboard fetch error:", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const handleRefresh = () => { setRefreshing(true); fetchAll(); };

  // ── Chart computations ──
  const growthPoints: GrowthPoint[] = userGrowth.length > 0
    ? (growthPeriod === "6M" ? userGrowth.slice(-6) : userGrowth)
    : [
        { month: "M1", count: "0" },
        { month: "M2", count: "0" },
        { month: "M3", count: "0" },
        { month: "M4", count: "0" },
        { month: "M5", count: "0" },
        { month: "M6", count: "0" },
      ];

  const growthCounts = growthPoints.map((p) => Math.max(0, Number(p.count) || 0));
  const maxVal = Math.max(...growthCounts, 1);
  const W = 600, H = 220, padL = 20, padR = 20, padB = 28, padT = 15;
  const innerW = W - padL - padR;
  const innerH = H - padB - padT;
  const n = Math.max(growthPoints.length, 1);

  const pts = growthPoints.map((p, i) => ({
    x: padL + (n > 1 ? (i / (n - 1)) : 0.5) * innerW,
    y: padT + innerH - (Math.max(0, Number(p.count) || 0) / maxVal) * innerH,
    label: p.month,
    count: p.count,
  }));

  const linePath = pts.length > 1
    ? pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ")
    : "";
  const areaPath = linePath && pts.length > 1
    ? `${linePath} L${pts[pts.length - 1].x.toFixed(1)},${(H - padB).toFixed(1)} L${pts[0].x.toFixed(1)},${(H - padB).toFixed(1)} Z`
    : "";

  // ── Donut (user status breakdown) ──
  const total = verificationCounts.total || 1;
  const verifiedPct = Math.round((verificationCounts.verified / total) * 100);
  const pendingPct = Math.round((verificationCounts.pending / total) * 100);
  const rejectedPct = Math.max(0, 100 - verifiedPct - pendingPct);
  const donutData = [
    { label: "Active", pct: verifiedPct || 0, color: "#7004DC" },
    { label: "Inactive", pct: pendingPct || 0, color: "#D2A500" },
    { label: "Suspended", pct: rejectedPct || 0, color: "#DC2626" },
  ];
  const r = 56, cx = 80, cy = 80, strokeW = 20;
  const circ = 2 * Math.PI * r;
  let cumPct = 0;

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 space-y-6 w-full max-w-full">

      {/* TOP HEADER */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-[#1A1C1C] tracking-tight">Admin Dashboard</h1>
          <p className="text-xs sm:text-sm text-[#7D7387] mt-0.5">Today: {today}</p>
        </div>
        <button
          onClick={handleRefresh}
          className={`h-9 sm:h-10 px-3.5 sm:px-4 rounded-xl flex items-center gap-2 bg-white border border-gray-200 shadow-sm hover:bg-gray-50 transition text-xs sm:text-sm font-semibold text-[#4B4355] ${refreshing ? "opacity-75" : ""}`}
        >
          <RefreshCw className={`w-4 h-4 text-[#7004DC] ${refreshing ? "animate-spin" : ""}`} />
          <span className="hidden sm:inline">Refresh</span>
        </button>
      </div>

      {/* STATS ROW */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 w-full">
        <StatsCard
          icon={<Users className="w-5 h-5 text-[#7004DC]" />}
          iconBg="bg-violet-50"
          badge={loading ? "—" : `+${stats.newUsersWeek} this week`}
          badgeBg="bg-[#D2A500]/20"
          badgeText="text-[#755B00]"
          label="Total Users"
          value={loading ? "—" : stats.totalUsers}
        />
        <StatsCard
          icon={<MessageSquare className="w-5 h-5 text-[#7004DC]" />}
          iconBg="bg-violet-50"
          label="Forum Questions"
          value={loading ? "—" : stats.forumQuestions}
        />
        <StatsCard
          icon={<ShieldAlert className="w-5 h-5 text-orange-500" />}
          iconBg="bg-orange-50"
          badge={Number(stats.pendingReports) > 0 ? "Needs Attention" : undefined}
          badgeBg="bg-red-100"
          badgeText="text-red-700"
          label="Pending Reports"
          value={loading ? "—" : stats.pendingReports}
        />
        <StatsCard
          icon={<CalendarDays className="w-5 h-5 text-[#7004DC]" />}
          iconBg="bg-violet-50"
          label="Events Published"
          value={loading ? "—" : stats.eventsThisMonth}
        />
      </div>

      {/* MAIN PROPORTIONAL GRID */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 w-full items-start">

        {/* LEFT COLUMN (8 of 12 columns on desktop) */}
        <div className="xl:col-span-8 space-y-6 min-w-0 w-full">

          {/* USER GROWTH CHART */}
          <div className="bg-white rounded-2xl p-5 sm:p-7 shadow-sm border border-gray-100 w-full">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
              <div>
                <h3 className="text-base sm:text-lg font-extrabold text-[#1A1C1C]">User Growth</h3>
                <p className="text-xs text-[#7D7387] mt-0.5">Real registration trend over time</p>
              </div>
              <div className="flex gap-1 bg-[#F3F3F3] p-1 rounded-lg">
                <button
                  onClick={() => setGrowthPeriod("6M")}
                  className={`px-3.5 py-1 rounded-md text-xs font-bold transition ${growthPeriod === "6M" ? "bg-white text-[#7004DC] shadow-sm" : "text-slate-500"}`}
                >
                  6 Months
                </button>
                <button
                  onClick={() => setGrowthPeriod("1Y")}
                  className={`px-3.5 py-1 rounded-md text-xs font-bold transition ${growthPeriod === "1Y" ? "bg-[#7004DC] text-white shadow-sm" : "text-slate-500"}`}
                >
                  1 Year
                </button>
              </div>
            </div>

            {loading ? (
              <div className="flex items-center justify-center h-44 text-slate-400 text-sm">
                <div className="w-6 h-6 border-2 border-[#7004DC] border-t-transparent rounded-full animate-spin" />
              </div>
            ) : pts.length === 0 ? (
              <div className="flex items-center justify-center h-44 text-slate-400 text-sm">No registration data recorded</div>
            ) : (
              <div className="w-full overflow-hidden">
                <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto max-h-[220px]" preserveAspectRatio="none">
                  <defs>
                    <linearGradient id="growthGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#8A38F5" stopOpacity="0.22" />
                      <stop offset="100%" stopColor="#8A38F5" stopOpacity="0.0" />
                    </linearGradient>
                  </defs>

                  {/* Horizontal Guide lines */}
                  {[0.25, 0.5, 0.75, 1].map((t, i) => {
                    const y = padT + innerH * (1 - t);
                    return (
                      <g key={i}>
                        <line x1={padL} y1={y} x2={W - padR} y2={y} stroke="#F0EEF5" strokeWidth="1" strokeDasharray="3 3" />
                        <text x={padL - 4} y={y + 3} fontSize="8" textAnchor="end" fill="#A098AD">
                          {Math.round(maxVal * t)}
                        </text>
                      </g>
                    );
                  })}

                  {areaPath && <path d={areaPath} fill="url(#growthGrad)" />}
                  {linePath && <path d={linePath} fill="none" stroke="#8A38F5" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />}
                  
                  {pts.map((p, i) => (
                    <g key={i}>
                      <circle cx={p.x} cy={p.y} r="4" fill="#7004DC" stroke="#FFFFFF" strokeWidth="2" />
                      <text x={p.x.toFixed(1)} y={H - 4} fontSize="9" textAnchor="middle" fill="#7D7387" fontWeight="600">
                        {p.label}
                      </text>
                    </g>
                  ))}
                </svg>
              </div>
            )}
          </div>

          {/* RECENT ACTIVITY */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden w-full">
            <div className="px-5 sm:px-7 pt-5 pb-3.5 flex flex-wrap items-center justify-between gap-2 border-b border-gray-100">
              <div>
                <h3 className="text-base sm:text-lg font-extrabold text-[#1A1C1C]">Recent Platform Activity</h3>
                <p className="text-xs text-[#7D7387] mt-0.5">Live activities across Signups, Community Forums, Events & Moderation</p>
              </div>
              <span className="px-2.5 py-1 bg-green-50 text-green-700 text-xs font-bold rounded-full flex items-center gap-1.5 shrink-0">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" /> Live Stream
              </span>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-8 h-8 border-4 border-[#7004DC] border-t-transparent rounded-full animate-spin" />
              </div>
            ) : activityRows.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                <p className="text-sm font-semibold">No recent activity recorded</p>
                <p className="text-xs text-slate-400 mt-1">Platform actions will appear here automatically</p>
              </div>
            ) : (
              <div className="overflow-x-auto w-full">
                <table className="w-full text-left">
                  <thead className="bg-[#F8F7FB]">
                    <tr>
                      {["USER / ACTOR", "ACTION", "MODULE", "TIMESTAMP", "STATUS"].map((h) => (
                        <th key={h} className="px-4 sm:px-6 py-3 text-[10px] font-bold uppercase tracking-[0.15em] text-[#7D7387]">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {activityRows.map((row, i) => {
                      const modStyle = MODULE_BADGE_STYLE[row.module] ?? { bg: "bg-gray-100", text: "text-gray-700" };
                      const statStyle = STATUS_STYLE[row.status] ?? { bg: "bg-gray-100", text: "text-gray-600" };
                      return (
                        <tr key={row.id ?? i} className="hover:bg-[#FAFAFA] transition">
                          <td className="px-4 sm:px-6 py-3.5">
                            <div className="flex items-center gap-2.5">
                              <div className="w-8 h-8 rounded-full bg-[#EDDCFF] text-[#7004DC] flex items-center justify-center text-xs font-bold shrink-0">
                                {row.initials}
                              </div>
                              <span className="font-semibold text-sm text-[#1A1C1C] whitespace-nowrap">{row.name}</span>
                            </div>
                          </td>
                          <td className="px-4 sm:px-6 py-3.5 text-sm text-[#3E3845] font-medium max-w-xs">
                            <span className="line-clamp-1">{row.action}</span>
                          </td>
                          <td className="px-4 sm:px-6 py-3.5">
                            <span className={`inline-block px-2.5 py-0.5 rounded-md text-xs font-bold ${modStyle.bg} ${modStyle.text}`}>
                              {row.module}
                            </span>
                          </td>
                          <td className="px-4 sm:px-6 py-3.5 whitespace-nowrap">
                            <p className="text-xs font-medium text-[#7D7387]">{row.date}</p>
                          </td>
                          <td className="px-4 sm:px-6 py-3.5">
                            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${statStyle.bg} ${statStyle.text}`}>
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

            <div className="border-t border-gray-100 px-5 sm:px-7 py-3 bg-[#FCFBFE] flex items-center justify-between">
              <span className="text-xs text-[#7D7387]">Showing latest {activityRows.length} platform events</span>
              <Link href="/analytics" className="text-xs font-bold text-[#7004DC] hover:underline flex items-center gap-1">
                View Full Analytics <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN (4 of 12 columns on desktop) */}
        <div className="xl:col-span-4 space-y-6 min-w-0 w-full">

          {/* NEEDS ATTENTION */}
          <div className="bg-white rounded-2xl p-5 sm:p-6 shadow-sm border border-gray-100 w-full">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-6 h-6 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-3.5 h-3.5 text-red-600" />
              </div>
              <h3 className="text-base font-extrabold text-[#1A1C1C]">Needs Attention</h3>
            </div>

            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((k) => <div key={k} className="h-20 bg-[#F3F3F3] rounded-xl animate-pulse" />)}
              </div>
            ) : attentionItems.length === 0 ? (
              <div className="text-center py-6 text-slate-400">
                <p className="text-sm font-semibold text-emerald-600">✓ All clear</p>
                <p className="text-xs text-slate-400 mt-0.5">No pending moderation flags</p>
              </div>
            ) : (
              <div className="space-y-3">
                {attentionItems.map((item, i) => (
                  <div key={i} className="bg-[#F7F5FA] rounded-xl p-3.5">
                    <div className="flex items-center justify-between mb-1">
                      <span className={`text-[10px] font-extrabold uppercase tracking-wider ${item.categoryColor}`}>{item.category}</span>
                      <span className="text-[10px] text-slate-400 font-medium">{item.time}</span>
                    </div>
                    <p className="text-sm font-bold text-[#1A1C1C] line-clamp-1">{item.title}</p>
                    <p className="text-xs text-slate-500 mt-0.5 leading-4 line-clamp-2">{item.desc}</p>
                  </div>
                ))}
              </div>
            )}

            <Link href="/moderation" className="block w-full">
              <button className="w-full mt-4 h-10 rounded-xl bg-[#F3F3F3] hover:bg-[#EBEBEB] transition text-xs font-bold uppercase tracking-[0.08em] text-[#4B4355] truncate px-3">
                Go to Moderation Center
              </button>
            </Link>
          </div>

          {/* USER STATUS BREAKDOWN */}
          <div className="bg-white rounded-2xl p-5 sm:p-6 shadow-sm border border-gray-100 w-full">
            <h3 className="text-base font-extrabold text-[#1A1C1C] mb-4">User Status Distribution</h3>

            <div className="flex items-center justify-center py-2">
              <svg width="150" height="150" viewBox="0 0 160 160" className="max-w-full h-auto">
                {donutData.map((seg) => {
                  if (seg.pct <= 0) return null;
                  const offset = circ - (seg.pct / 100) * circ;
                  const rotation = cumPct * 3.6 - 90;
                  cumPct += seg.pct;
                  return (
                    <circle key={seg.label} cx={cx} cy={cy} r={r} fill="none"
                      stroke={seg.color} strokeWidth={strokeW}
                      strokeDasharray={`${circ} ${circ}`} strokeDashoffset={offset}
                      transform={`rotate(${rotation} ${cx} ${cy})`} strokeLinecap="butt"
                    />
                  );
                })}
                <circle cx={cx} cy={cy} r={r - strokeW / 2 - 2} fill="white" />
                <text x={cx} y={cy - 6} textAnchor="middle" fontSize="18" fontWeight="800" fill="#1A1C1C">
                  {loading ? "—" : verificationCounts.total}
                </text>
                <text x={cx} y={cy + 10} textAnchor="middle" fontSize="8" fontWeight="600" fill="#7D7387" letterSpacing="1">TOTAL USERS</text>
              </svg>
            </div>

            <div className="space-y-2 mt-2">
              {donutData.map((seg) => (
                <div key={seg.label} className="flex items-center justify-between text-xs sm:text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: seg.color }} />
                    <span className="text-[#4B4355] font-medium">{seg.label}</span>
                  </div>
                  <span className="font-bold text-[#1A1C1C]">{loading ? "—" : `${seg.pct}%`}</span>
                </div>
              ))}
            </div>
          </div>

          {/* QUICK CONTROLS */}
          <div className="bg-white rounded-2xl p-5 sm:p-6 shadow-sm border border-gray-100 w-full">
            <h3 className="text-base font-extrabold text-[#1A1C1C] mb-3">Quick Navigation</h3>
            <div className="space-y-2">
              {[
                { label: "Analytics & Trends", href: "/analytics", icon: <TrendingUp className="w-4 h-4" /> },
                { label: "Content Moderation", href: "/moderation", icon: <ShieldAlert className="w-4 h-4" /> },
                { label: "Community Forums", href: "/forums", icon: <MessageSquare className="w-4 h-4" /> },
                { label: "User Management", href: "/users", icon: <Users className="w-4 h-4" /> },
              ].map((link) => (
                <Link key={link.href} href={link.href}
                  className="flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-[#F7F5FA] hover:bg-[#EDE8F5] transition text-xs sm:text-sm font-semibold text-[#4B4355]"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="text-[#7004DC] shrink-0">{link.icon}</span>
                    <span className="truncate">{link.label}</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// STATS CARD
// ─────────────────────────────────────────────
function StatsCard({ icon, iconBg, badge, badgeBg, badgeText, label, value }: {
  icon: React.ReactNode; iconBg: string;
  badge?: string; badgeBg?: string; badgeText?: string;
  label: string; value: string;
}) {
  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 w-full">
      <div className="flex items-start justify-between mb-4">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${iconBg} shrink-0`}>{icon}</div>
        {badge && (
          <span className={`px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-bold uppercase tracking-wide truncate max-w-[130px] ${badgeBg ?? ""} ${badgeText ?? ""}`}>
            {badge}
          </span>
        )}
      </div>
      <p className="text-xs sm:text-sm font-medium text-[#7D7387]">{label}</p>
      <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#1A1C1C] mt-0.5">{value}</h2>
    </div>
  );
}
