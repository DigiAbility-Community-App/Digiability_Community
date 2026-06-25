"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  ShieldAlert,
  MessageSquare,
  Bell,
  CalendarDays,
  Activity,
  Settings,
  LogOut,
  UsersRound,
} from "lucide-react";

const navItems = [
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    label: "Users",
    href: "/users",
    icon: Users,
  },
  {
    label: "Groups",
    href: "/groups",
    icon: UsersRound,
  },
  {
    label: "Moderation",
    href: "/moderation",
    icon: ShieldAlert,
  },
  {
    label: "Forums",
    href: "/forums",
    icon: MessageSquare,
  },
  {
    label: "Events",
    href: "/events",
    icon: CalendarDays,
  },
  {
    label: "Analytics",
    href: "/analytics",
    icon: Activity,
  },
  {
    label: "Notifications",
    href: "/notifications",
    icon: Bell,
  },
  {
    label: "Settings",
    href: "/settings",
    icon: Settings,
  },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/login");
      router.refresh();
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  return (
    <div className="min-h-screen bg-[#F6F6F6] flex">
      {/* SIDEBAR */}
      <aside className="fixed left-0 top-0 z-50 h-screen w-[240px] bg-[#1A1A2E] border-r border-white/5 flex flex-col">
        {/* LOGO */}
        <div className="h-[88px] px-6 flex items-center border-b border-white/5">
          <div className="flex items-center gap-3">
            <Image
              src="/logo.png"
              alt="DigiAbility Logo"
              width={60}
              height={60}
              className="rounded-xl object-contain p-1 shadow-md shadow-violet-500/10"
            />
            <div>
              <h1 className="text-white font-extrabold text-lg tracking-tight">
                DigiAbility
              </h1>
              <p className="text-[10px] uppercase tracking-[0.18em] text-[#E2E0FC]/40 mt-1">
                Admin Portal
              </p>
            </div>
          </div>
        </div>

        {/* NAVIGATION */}
        <div className="flex-1 overflow-y-auto px-4 py-6">
          <div className="space-y-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`group flex items-center gap-4 px-4 h-14 rounded-2xl transition-all duration-200 ${isActive
                    ? "bg-[#8A38F5] text-white shadow-lg shadow-violet-500/20"
                    : "text-[#E2E0FC]/70 hover:bg-white/5 hover:text-white"
                    }`}
                >
                  <Icon className="w-5 h-5" />
                  <span className="font-semibold text-sm tracking-wide">
                    {item.label}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>

        {/* FOOTER */}
        <div className="p-4 border-t border-white/5">
          <button
            onClick={handleLogout}
            className="w-full h-14 rounded-2xl bg-white/5 hover:bg-red-50/10 text-[#E2E0FC]/70 hover:text-red-400 transition-all flex items-center gap-4 px-4"
          >
            <LogOut className="w-5 h-5" />
            <span className="font-semibold text-sm">Logout</span>
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT WRAPPER */}
      <div className="flex-1 ml-[240px] flex flex-col min-h-screen">
        {children}
      </div>
    </div>
  );
}
