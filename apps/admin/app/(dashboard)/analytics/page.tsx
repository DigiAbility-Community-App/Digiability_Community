"use client";

import { useEffect, useState } from "react";
import {
  Users,
  MessageSquare,
  CalendarDays,
  Eye,
  TrendingUp,
  UserCheck,
  RefreshCw,
} from "lucide-react";

interface Analytics {
  users: {
    total: string;
    active: string;
    newThisMonth: string;
    newThisWeek: string;
  };
  forums: {
    totalQuestions: string;
    totalViews: string;
    totalAnswers: string;
    solved: string;
  };
  events: { totalEvents: string };
  userGrowth: { month: string; count: string }[];
  rolesDistribution: { role: string; count: string }[];
}

const ROLE_COLORS: Record<string, string> = {
  pwd: "#8A38F5",
  caregiver: "#D2A500",
  therapist: "#22c55e",
  ngo: "#3b82f6",
  volunteer: "#f97316",
  student: "#ec4899",
  mentor: "#06b6d4",
};

export default function AnalyticsPage() {
  const [data, setData] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/analytics");
      const json = await res.json();
      if (json.success) setData(json);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-10 h-10 border-4 border-[#7004DC] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="px-8 py-8 text-center text-slate-400">Failed to load analytics.</div>
    );
  }

  const topCards = [
    {
      label: "Total Users",
      value: data.users.total,
      sub: `${data.users.newThisMonth} new this month`,
      icon: <Users className="w-5 h-5" />,
      bg: "bg-violet-50",
      text: "text-violet-600",
    },
    {
      label: "Active Users",
      value: data.users.active,
      sub: `${data.users.newThisWeek} new this week`,
      icon: <UserCheck className="w-5 h-5" />,
      bg: "bg-green-50",
      text: "text-green-600",
    },
    {
      label: "Forum Questions",
      value: data.forums.totalQuestions,
      sub: `${data.forums.solved} solved`,
      icon: <MessageSquare className="w-5 h-5" />,
      bg: "bg-blue-50",
      text: "text-blue-600",
    },
    {
      label: "Total Forum Views",
      value: Number(data.forums.totalViews).toLocaleString(),
      sub: `${data.forums.totalAnswers} answers posted`,
      icon: <Eye className="w-5 h-5" />,
      bg: "bg-orange-50",
      text: "text-orange-600",
    },
  ];

  // Chart dimensions
  const chartW = 600;
  const chartH = 220;
  const padL = 40;
  const padB = 30;
  const innerW = chartW - padL - 20;
  const innerH = chartH - padB - 10;

  const growthCounts = data.userGrowth.map((g) => Number(g.count));
  const maxCount = Math.max(...growthCounts, 1);
  const n = data.userGrowth.length;

  const points = data.userGrowth.map((g, i) => {
    const x = padL + (i / Math.max(n - 1, 1)) * innerW;
    const y = (chartH - padB) - (Number(g.count) / maxCount) * innerH;
    return { x, y, month: g.month, count: g.count };
  });

  const linePath = points
    .map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`)
    .join(" ");

  const areaPath =
    points.length > 0
      ? `${linePath} L${points[points.length - 1].x},${chartH - padB} L${points[0].x},${chartH - padB} Z`
      : "";

  // Roles distribution
  const totalRoleCount = data.rolesDistribution.reduce(
    (sum, r) => sum + Number(r.count),
    0
  );

  return (
    <div className="px-8 py-8 space-y-8">
      {/* HEADER */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-extrabold tracking-tight text-[#1A1C1C]">Analytics</h1>
          <p className="text-sm text-[#7D7387] mt-2">Platform-wide metrics and engagement data</p>
        </div>
        <button
          onClick={fetchData}
          className="h-11 px-4 rounded-xl bg-[#F3F3F3] hover:bg-[#EBEBEB] transition flex items-center gap-2 text-sm font-semibold text-[#4B4355]"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* TOP STATS */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-5">
        {topCards.map((card, i) => (
          <div key={i} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between">
              <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${card.bg} ${card.text}`}>
                {card.icon}
              </div>
              <TrendingUp className="w-4 h-4 text-green-500" />
            </div>
            <h2 className="text-4xl font-extrabold text-[#1A1C1C] mt-5">{card.value}</h2>
            <p className="text-xs font-semibold text-[#7D7387] mt-1 uppercase tracking-wide">{card.label}</p>
            <p className="text-xs text-slate-400 mt-2">{card.sub}</p>
          </div>
        ))}
      </div>

      {/* CHARTS ROW */}
      <div className="grid grid-cols-1 xl:grid-cols-[2fr_1fr] gap-6">
        {/* USER GROWTH CHART */}
        <div className="bg-white rounded-[24px] p-8 shadow-sm border border-gray-100">
          <div className="mb-6">
            <h3 className="text-xl font-extrabold text-[#1A1C1C]">User Growth</h3>
            <p className="text-sm text-slate-500 mt-1">New registrations over the last 6 months</p>
          </div>

          {data.userGrowth.length === 0 ? (
            <div className="flex items-center justify-center h-48 text-slate-400">
              <p>Not enough data yet</p>
            </div>
          ) : (
            <svg viewBox={`0 0 ${chartW} ${chartH}`} className="w-full" preserveAspectRatio="none">
              <defs>
                <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#8A38F5" stopOpacity="0.2" />
                  <stop offset="100%" stopColor="#8A38F5" stopOpacity="0" />
                </linearGradient>
              </defs>

              {/* Grid lines */}
              {[0.25, 0.5, 0.75, 1].map((t, i) => {
                const y = (chartH - padB) - t * innerH;
                return (
                  <g key={i}>
                    <line x1={padL} y1={y} x2={chartW - 20} y2={y} stroke="#E8E8E8" strokeWidth="1" />
                    <text x={padL - 6} y={y + 4} fontSize="9" textAnchor="end" fill="#7D7387">
                      {Math.round(maxCount * t)}
                    </text>
                  </g>
                );
              })}

              {/* Area */}
              {areaPath && <path d={areaPath} fill="url(#areaGrad)" />}

              {/* Line */}
              {linePath && (
                <path d={linePath} fill="none" stroke="#8A38F5" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
              )}

              {/* Points */}
              {points.map((p, i) => (
                <g key={i}>
                  <circle cx={p.x} cy={p.y} r="5" fill="#8A38F5" />
                  <text x={p.x} y={chartH - 5} fontSize="9" textAnchor="middle" fill="#7D7387">
                    {p.month}
                  </text>
                </g>
              ))}
            </svg>
          )}
        </div>

        {/* ROLES DISTRIBUTION */}
        <div className="bg-white rounded-[24px] p-8 shadow-sm border border-gray-100">
          <h3 className="text-xl font-extrabold text-[#1A1C1C] mb-6">User Roles</h3>

          {data.rolesDistribution.length === 0 ? (
            <div className="flex items-center justify-center h-40 text-slate-400">
              <p>No role data yet</p>
            </div>
          ) : (
            <div className="space-y-4">
              {data.rolesDistribution.map((r) => {
                const pct = totalRoleCount > 0
                  ? Math.round((Number(r.count) / totalRoleCount) * 100)
                  : 0;
                const color = ROLE_COLORS[r.role] || "#8A38F5";
                return (
                  <div key={r.role}>
                    <div className="flex justify-between items-center mb-1.5">
                      <span className="text-sm font-semibold text-[#1A1C1C] capitalize">{r.role}</span>
                      <span className="text-xs font-bold text-[#7D7387]">{r.count} ({pct}%)</span>
                    </div>
                    <div className="h-2 bg-[#F3F3F3] rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${pct}%`, backgroundColor: color }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* BOTTOM STATS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* FORUM SUMMARY */}
        <div className="bg-white rounded-2xl p-7 shadow-sm border border-gray-100">
          <h4 className="text-base font-extrabold text-[#1A1C1C] mb-5 flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-[#7004DC]" />
            Forum Summary
          </h4>
          <div className="space-y-3">
            <StatRow label="Total Questions" value={data.forums.totalQuestions} />
            <StatRow label="Solved" value={data.forums.solved} valueColor="text-green-600" />
            <StatRow label="Total Answers" value={data.forums.totalAnswers} />
            <StatRow label="Total Views" value={Number(data.forums.totalViews).toLocaleString()} />
          </div>
        </div>

        {/* USER SUMMARY */}
        <div className="bg-white rounded-2xl p-7 shadow-sm border border-gray-100">
          <h4 className="text-base font-extrabold text-[#1A1C1C] mb-5 flex items-center gap-2">
            <Users className="w-4 h-4 text-[#7004DC]" />
            User Summary
          </h4>
          <div className="space-y-3">
            <StatRow label="Total Registered" value={data.users.total} />
            <StatRow label="Active (verified)" value={data.users.active} valueColor="text-green-600" />
            <StatRow label="New This Month" value={data.users.newThisMonth} />
            <StatRow label="New This Week" value={data.users.newThisWeek} />
          </div>
        </div>

        {/* EVENTS SUMMARY */}
        <div className="bg-white rounded-2xl p-7 shadow-sm border border-gray-100">
          <h4 className="text-base font-extrabold text-[#1A1C1C] mb-5 flex items-center gap-2">
            <CalendarDays className="w-4 h-4 text-[#7004DC]" />
            Events Summary
          </h4>
          <div className="space-y-3">
            <StatRow label="Total Events" value={data.events.totalEvents} />
          </div>
          <div className="mt-6 p-4 bg-[#F3F3F3] rounded-xl">
            <p className="text-xs text-slate-500 font-medium">
              Events are published by admins and appear on the mobile app community feed.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ----------------------
// STAT ROW
// ----------------------
function StatRow({
  label,
  value,
  valueColor = "text-[#1A1C1C]",
}: {
  label: string;
  value: string;
  valueColor?: string;
}) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-[#F3F3F3]">
      <span className="text-sm text-[#7D7387]">{label}</span>
      <span className={`text-sm font-extrabold ${valueColor}`}>{value}</span>
    </div>
  );
}
