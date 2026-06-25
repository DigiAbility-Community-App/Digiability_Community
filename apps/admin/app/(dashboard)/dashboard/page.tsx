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

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });

  const fetchAll = useCallback(async () => {
    try {
      const [usersRes, eventsRes, moderationRes, analyticsRes] = await Promise.all([
        fetch("/api/users"),
        fetch("/api/events"),
        fetch("/api/moderation"),
        fetch("/api/analytics"),
      ]);

      const [usersData, eventsData, modData, analyticsData] = await Promise.all([
        usersRes.json(), eventsRes.json(), moderationRes.json(), analyticsRes.json(),
      ]);

      // ── Stats ──
      const totalUsers = usersData.success ? usersData.stats.total : "0";
      const forumQ = analyticsData.success ? analyticsData.forums.totalQuestions : "0";
      const pendingRep = modData.success ? modData.stats.totalReports : "0";
      const eventsCount = eventsData.success ? String(eventsData.events?.length ?? 0) : "0";
      const newWeek = analyticsData.success ? analyticsData.users.newThisWeek : "0";

      setStats({ totalUsers, forumQuestions: forumQ, pendingReports: pendingRep, eventsThisMonth: eventsCount, newUsersWeek: newWeek });

      // ── User Growth Chart ──
      if (analyticsData.success && Array.isArray(analyticsData.userGrowth)) {
        setUserGrowth(analyticsData.userGrowth);
      }

      // ── Recent Activity from reports ──
      if (modData.success && Array.isArray(modData.reports)) {
        const rows: ActivityItem[] = modData.reports.slice(0, 5).map((r: any) => {
          const name = r.reporterName || "Unknown";
          const words = name.trim().split(/\s+/);
          const initials = (words[0]?.[0] ?? "") + (words[1]?.[0] ?? "");
          return {
            name,
            initials: initials.toUpperCase() || "?",
            action: "Filed report",
            module: r.type === "question" ? "Forums" : "Community",
            date: r.createdAt || "—",
            status: "OPEN" as const,
          };
        });
        setActivityRows(rows);
      }

      // ── Needs Attention from pending reports ──
      if (modData.success && Array.isArray(modData.reports)) {
        const items: AttentionItem[] = modData.reports.slice(0, 3).map((r: any, i: number) => {
          const colors = ["text-orange-600", "text-red-600", "text-[#7004DC]"];
          const cats = ["CONTENT REPORT", "MODERATION FLAG", "USER REPORT"];
          return {
            category: cats[i % cats.length],
            categoryColor: colors[i % colors.length],
            time: r.createdAt || "Recently",
            title: r.questionTitle || "Reported Content",
            desc: r.reason || "Requires review.",
          };
        });
        setAttentionItems(items);
      }

      // ── Verification counts for donut ──
      if (usersData.success && Array.isArray(usersData.users)) {
        const users = usersData.users as any[];
        const verified = users.filter((u: any) => u.status === "Active").length;
        const inactive = users.filter((u: any) => u.status === "Inactive").length;
        const suspended = users.filter((u: any) => u.status === "Suspended").length;
        const total = users.length;
        setVerificationCounts({ verified, pending: inactive, rejected: suspended, total });
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
  // Use real growth data when available, fall back to illustrative data
  const growthPoints: GrowthPoint[] = userGrowth.length > 0
    ? (growthPeriod === "6M" ? userGrowth.slice(-6) : userGrowth)
    : growthPeriod === "1Y"
      ? [10,22,18,30,25,45,42,55,60,72,85,78].map((c,i) => ({ month: ["M1","M2","M3","M4","M5","M6","M7","M8","M9","M10","M11","M12"][i], count: String(c) }))
      : [45,42,55,60,72,85].map((c,i) => ({ month: ["M1","M2","M3","M4","M5","M6"][i], count: String(c) }));

  const growthCounts = growthPoints.map((p) => Math.max(0, Number(p.count) || 0));
  const maxVal = Math.max(...growthCounts, 1); // always ≥ 1 → no division by zero
  const W = 600, H = 220, padL = 10, padR = 10, padB = 28, padT = 10;
  const innerW = W - padL - padR;
  const innerH = H - padB - padT;
  const n = Math.max(growthPoints.length, 1);

  const pts = growthPoints.map((p, i) => ({
    x: padL + (n > 1 ? (i / (n - 1)) : 0.5) * innerW,
    y: padT + innerH - (Math.max(0, Number(p.count) || 0) / maxVal) * innerH,
    label: p.month,
  }));

  const linePath = pts.length > 1
    ? pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ")
    : "";
  const areaPath = linePath && pts.length > 1
    ? `${linePath} L${pts[pts.length - 1].x.toFixed(1)},${(H - padB).toFixed(1)} L${pts[0].x.toFixed(1)},${(H - padB).toFixed(1)} Z`
    : "";

  // ── Donut (user status breakdown) ──
  const total = verificationCounts.total || 1; // guard div by zero
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

  const STATUS_STYLE: Record<string, { bg: string; text: string }> = {
    OPEN:     { bg: "bg-orange-100", text: "text-orange-700" },
    RESOLVED: { bg: "bg-green-100",  text: "text-green-700"  },
    PENDING:  { bg: "bg-yellow-100", text: "text-yellow-700" },
    APPROVED: { bg: "bg-green-100",  text: "text-green-700"  },
  };

  return (
    <div className="px-8 py-6 space-y-6 max-w-[1400px]">

      {/* TOP HEADER */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-[#1A1C1C] tracking-tight">Dashboard</h1>
          <p className="text-sm text-[#7D7387] mt-0.5">Today: {today}</p>
        </div>
        <button
          onClick={handleRefresh}
          className={`w-9 h-9 rounded-full flex items-center justify-center bg-white border border-gray-200 shadow-sm hover:bg-gray-50 transition ${refreshing ? "animate-spin" : ""}`}
        >
          <RefreshCw className="w-4 h-4 text-[#7D7387]" />
        </button>
      </div>

      {/* STATS ROW */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-5">
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

      {/* MAIN GRID */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_340px] gap-6">

        {/* LEFT */}
        <div className="space-y-6">

          {/* USER GROWTH CHART */}
          <div className="bg-white rounded-[24px] p-7 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-extrabold text-[#1A1C1C]">User Growth</h3>
              <div className="flex gap-1 bg-[#F3F3F3] p-1 rounded-lg">
                <button onClick={() => setGrowthPeriod("6M")} className={`px-4 py-1.5 rounded-md text-xs font-bold transition ${growthPeriod === "6M" ? "bg-white text-[#7004DC] shadow-sm" : "text-slate-500"}`}>6 Months</button>
                <button onClick={() => setGrowthPeriod("1Y")} className={`px-4 py-1.5 rounded-md text-xs font-bold transition ${growthPeriod === "1Y" ? "bg-[#7004DC] text-white shadow-sm" : "text-slate-500"}`}>1 Year</button>
              </div>
            </div>

            {pts.length === 0 ? (
              <div className="flex items-center justify-center h-40 text-slate-400 text-sm">No growth data yet</div>
            ) : (
              <svg viewBox={`0 0 ${W} ${H}`} className="w-full" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="growthGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#8A38F5" stopOpacity="0.18" />
                    <stop offset="100%" stopColor="#8A38F5" stopOpacity="0" />
                  </linearGradient>
                </defs>
                {areaPath && <path d={areaPath} fill="url(#growthGrad)" />}
                {linePath && <path d={linePath} fill="none" stroke="#8A38F5" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />}
                {pts.length > 0 && <circle cx={pts[pts.length - 1].x} cy={pts[pts.length - 1].y} r="5" fill="#8A38F5" />}
                {pts.map((p, i) => (
                  <text key={i} x={p.x.toFixed(1)} y={H - 4} fontSize="9" textAnchor="middle" fill="#94a3b8" fontWeight="600">
                    {p.label}
                  </text>
                ))}
              </svg>
            )}
          </div>

          {/* RECENT ACTIVITY */}
          <div className="bg-white rounded-[24px] shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-7 pt-6 pb-4">
              <h3 className="text-lg font-extrabold text-[#1A1C1C]">Recent Activity</h3>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-10">
                <div className="w-8 h-8 border-4 border-[#7004DC] border-t-transparent rounded-full animate-spin" />
              </div>
            ) : activityRows.length === 0 ? (
              <div className="flex items-center justify-center py-10 text-slate-400">
                <p className="text-sm font-semibold">No recent activity</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-[#F3F3F3]">
                    <tr>
                      {["USER", "ACTION", "MODULE", "DATE", "STATUS"].map((h) => (
                        <th key={h} className="px-6 py-3 text-left text-[10px] font-bold uppercase tracking-[0.15em] text-[#7D7387]">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {activityRows.map((row, i) => {
                      const style = STATUS_STYLE[row.status] ?? { bg: "bg-gray-100", text: "text-gray-600" };
                      return (
                        <tr key={i} className="border-t border-gray-100 hover:bg-[#FAFAFA] transition">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-full bg-[#EDDCFF] text-[#7004DC] flex items-center justify-center text-xs font-bold shrink-0">
                                {row.initials}
                              </div>
                              <span className="font-semibold text-sm text-[#1A1C1C] whitespace-nowrap">{row.name}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-sm text-[#4B4355]">{row.action}</td>
                          <td className="px-6 py-4 text-sm font-semibold text-[#7004DC]">{row.module}</td>
                          <td className="px-6 py-4">
                            <p className="text-xs font-semibold text-[#4B4355]">{row.date}</p>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide ${style.bg} ${style.text}`}>
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

            <div className="border-t border-gray-100 px-7 py-4">
              <Link href="/moderation" className="text-sm font-bold text-[#7004DC] hover:underline">
                View All Activities
              </Link>
            </div>
          </div>
        </div>

        {/* RIGHT */}
        <div className="space-y-6">

          {/* NEEDS ATTENTION */}
          <div className="bg-white rounded-[24px] p-6 shadow-sm border border-gray-100">
            <div className="flex items-center gap-2 mb-5">
              <div className="w-6 h-6 rounded-full bg-red-100 flex items-center justify-center">
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
                <p className="text-sm font-semibold">All clear — no pending reports</p>
              </div>
            ) : (
              <div className="space-y-3">
                {attentionItems.map((item, i) => (
                  <div key={i} className="bg-[#F7F5FA] rounded-xl p-4">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className={`text-[10px] font-extrabold uppercase tracking-wider ${item.categoryColor}`}>{item.category}</span>
                      <span className="text-[10px] text-slate-400 font-medium">{item.time}</span>
                    </div>
                    <p className="text-sm font-bold text-[#1A1C1C] line-clamp-1">{item.title}</p>
                    <p className="text-xs text-slate-500 mt-1 leading-4 line-clamp-2">{item.desc}</p>
                  </div>
                ))}
              </div>
            )}

            <Link href="/moderation">
              <button className="w-full mt-4 h-11 rounded-xl bg-[#F3F3F3] hover:bg-[#EBEBEB] transition text-xs font-extrabold uppercase tracking-[0.12em] text-[#4B4355]">
                GO TO ACTION CENTER
              </button>
            </Link>
          </div>

          {/* USER STATUS BREAKDOWN */}
          <div className="bg-white rounded-[24px] p-6 shadow-sm border border-gray-100">
            <h3 className="text-base font-extrabold text-[#1A1C1C] mb-5">User Status</h3>

            <div className="flex items-center justify-center py-2">
              <svg width="160" height="160" viewBox="0 0 160 160">
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
                <text x={cx} y={cy - 6} textAnchor="middle" fontSize="20" fontWeight="800" fill="#1A1C1C">
                  {loading ? "—" : verificationCounts.total}
                </text>
                <text x={cx} y={cy + 12} textAnchor="middle" fontSize="9" fontWeight="600" fill="#7D7387" letterSpacing="2">TOTAL</text>
              </svg>
            </div>

            <div className="space-y-2 mt-2">
              {donutData.map((seg) => (
                <div key={seg.label} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: seg.color }} />
                    <span className="text-sm text-[#4B4355] font-medium">{seg.label}</span>
                  </div>
                  <span className="text-sm font-bold text-[#1A1C1C]">{loading ? "—" : `${seg.pct}%`}</span>
                </div>
              ))}
            </div>
          </div>

          {/* QUICK CONTROLS */}
          <div className="bg-white rounded-[24px] p-6 shadow-sm border border-gray-100">
            <h3 className="text-base font-extrabold text-[#1A1C1C] mb-4">Quick Controls</h3>
            <div className="space-y-2">
              {[
                { label: "Analytics", href: "/analytics", icon: <TrendingUp className="w-4 h-4" /> },
                { label: "Moderation", href: "/moderation", icon: <ShieldAlert className="w-4 h-4" /> },
                { label: "Forums", href: "/forums", icon: <MessageSquare className="w-4 h-4" /> },
              ].map((link) => (
                <Link key={link.href} href={link.href}
                  className="flex items-center justify-between px-4 py-3 rounded-xl bg-[#F7F5FA] hover:bg-[#EDE8F5] transition"
                >
                  <div className="flex items-center gap-3 text-sm font-semibold text-[#4B4355]">
                    <span className="text-[#7004DC]">{link.icon}</span>
                    {link.label}
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400" />
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
    <div className="bg-white rounded-[20px] p-6 shadow-sm border border-gray-100">
      <div className="flex items-start justify-between mb-5">
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${iconBg}`}>{icon}</div>
        {badge && (
          <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide ${badgeBg ?? ""} ${badgeText ?? ""}`}>
            {badge}
          </span>
        )}
      </div>
      <p className="text-sm font-medium text-[#7D7387]">{label}</p>
      <h2 className="text-4xl font-extrabold tracking-tight text-[#1A1C1C] mt-1">{value}</h2>
    </div>
  );
}
