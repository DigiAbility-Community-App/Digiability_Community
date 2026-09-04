"use client";

import { useState, useEffect } from "react";
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
  Menu,
  X,
  PanelLeftClose,
  PanelLeftOpen,
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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Restore collapsed preference from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("digiability_admin_sidebar_collapsed");
    if (saved === "true") {
      setIsCollapsed(true);
    }
  }, []);

  const toggleSidebar = () => {
    setIsCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem("digiability_admin_sidebar_collapsed", String(next));
      return next;
    });
  };

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
    <div className="h-screen w-screen bg-[#F6F6F6] flex flex-col lg:flex-row overflow-hidden select-none">
      {/* MOBILE TOP BAR (Fixed on Mobile/Tablet) */}
      <header className="lg:hidden h-16 bg-[#1A1A2E] text-white flex items-center justify-between px-4 shrink-0 z-40 shadow-md">
        <div className="flex items-center gap-3">
          <Image
            src="/logo.png"
            alt="DigiAbility Logo"
            width={36}
            height={36}
            className="rounded-lg object-contain"
          />
          <div>
            <h1 className="text-white font-extrabold text-base tracking-tight leading-none">
              DigiAbility
            </h1>
            <p className="text-[9px] uppercase tracking-[0.18em] text-[#E2E0FC]/50 mt-0.5">
              Admin Portal
            </p>
          </div>
        </div>
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition"
          aria-label="Toggle Navigation Menu"
        >
          {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </header>

      {/* MOBILE BACKDROP */}
      {mobileMenuOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* STABLE COLLAPSIBLE SIDEBAR */}
      <aside
        className={`fixed lg:relative top-0 left-0 z-50 h-screen bg-[#1A1A2E] border-r border-white/5 flex flex-col shrink-0 transition-all duration-300 ease-in-out ${
          isCollapsed ? "lg:w-[76px] overflow-visible" : "lg:w-[240px] overflow-hidden"
        } ${
          mobileMenuOpen ? "w-[240px] translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        {/* LOGO & EXPAND/COLLAPSE TOGGLE */}
        <div
          className={`h-[80px] border-b border-white/5 flex items-center shrink-0 transition-all duration-300 relative ${
            isCollapsed ? "justify-center px-2" : "justify-between px-5"
          }`}
        >
          <Link href="/dashboard" className="flex items-center gap-3 overflow-hidden">
            <Image
              src="/logo.png"
              alt="DigiAbility Logo"
              width={isCollapsed ? 38 : 42}
              height={isCollapsed ? 38 : 42}
              className="rounded-xl object-contain p-1 shadow-md shadow-violet-500/10 shrink-0 transition-all duration-300"
            />
            {!isCollapsed && (
              <div className="min-w-0 transition-opacity duration-300">
                <h1 className="text-white font-extrabold text-base tracking-tight leading-none truncate">
                  DigiAbility
                </h1>
                <p className="text-[9px] uppercase tracking-[0.18em] text-[#E2E0FC]/40 mt-1 truncate">
                  Admin Portal
                </p>
              </div>
            )}
          </Link>

          {/* MOBILE CLOSE BUTTON */}
          <button
            onClick={() => setMobileMenuOpen(false)}
            className="lg:hidden text-white/60 hover:text-white p-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* NAVIGATION LINKS */}
        <nav
          className={`flex-1 py-4 space-y-1.5 ${
            isCollapsed
              ? "px-2 overflow-visible"
              : "px-3 overflow-y-auto custom-scrollbar overflow-x-hidden"
          }`}
        >
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileMenuOpen(false)}
                title={isCollapsed ? item.label : undefined}
                className={`group relative flex items-center h-11 rounded-xl transition-all duration-200 ${
                  isCollapsed ? "justify-center px-0 w-full" : "gap-3.5 px-3.5"
                } ${
                  isActive
                    ? "bg-[#8A38F5] text-white shadow-lg shadow-violet-500/20 font-bold"
                    : "text-[#E2E0FC]/70 hover:bg-white/5 hover:text-white font-medium"
                }`}
              >
                <Icon className={`w-5 h-5 shrink-0 ${isActive ? "text-white" : "text-[#E2E0FC]/60 group-hover:text-white"}`} />
                
                {/* TEXT LABEL (Visible when expanded) */}
                {!isCollapsed && (
                  <span className="text-sm tracking-wide truncate transition-opacity duration-200">
                    {item.label}
                  </span>
                )}

                {/* FLOATING HOVER TOOLTIP (Shows when collapsed on desktop) */}
                {isCollapsed && (
                  <div className="hidden lg:flex items-center absolute left-[68px] top-1/2 -translate-y-1/2 bg-[#1A1A2E] text-white text-xs font-bold px-3 py-1.5 rounded-lg shadow-2xl border border-violet-500/30 opacity-0 group-hover:opacity-100 pointer-events-none transition-all duration-150 z-[999] whitespace-nowrap">
                    {/* Arrow pointer */}
                    <div className="absolute right-full top-1/2 -translate-y-1/2 w-0 h-0 border-y-[5px] border-y-transparent border-r-[6px] border-r-[#1A1A2E]" />
                    <span>{item.label}</span>
                  </div>
                )}
              </Link>
            );
          })}
        </nav>

        {/* FOOTER TOGGLE & LOGOUT */}
        <div className={`p-3 border-t border-white/5 shrink-0 space-y-2 ${isCollapsed ? "overflow-visible" : ""}`}>
          {/* Quick Collapse Switch at Bottom */}
          <button
            onClick={toggleSidebar}
            className={`group relative hidden lg:flex w-full h-10 rounded-xl bg-white/5 hover:bg-white/10 text-[#E2E0FC]/60 hover:text-white transition-all items-center text-xs font-medium ${
              isCollapsed ? "justify-center px-0" : "gap-3 px-3"
            }`}
            title={isCollapsed ? "Expand Menu" : "Collapse Menu"}
          >
            {isCollapsed ? (
              <>
                <PanelLeftOpen className="w-4 h-4 shrink-0" />
                <div className="hidden lg:flex items-center absolute left-[68px] top-1/2 -translate-y-1/2 bg-[#1A1A2E] text-white text-xs font-bold px-3 py-1.5 rounded-lg shadow-2xl border border-violet-500/30 opacity-0 group-hover:opacity-100 pointer-events-none transition-all duration-150 z-[999] whitespace-nowrap">
                  <div className="absolute right-full top-1/2 -translate-y-1/2 w-0 h-0 border-y-[5px] border-y-transparent border-r-[6px] border-r-[#1A1A2E]" />
                  <span>Expand Menu</span>
                </div>
              </>
            ) : (
              <>
                <PanelLeftClose className="w-4 h-4 shrink-0" />
                <span className="truncate">Collapse Sidebar</span>
              </>
            )}
          </button>

          {/* Logout Button */}
          <button
            onClick={handleLogout}
            className={`group relative w-full h-11 rounded-xl bg-white/5 hover:bg-red-500/20 text-[#E2E0FC]/70 hover:text-red-400 transition-all flex items-center font-medium text-sm ${
              isCollapsed ? "justify-center px-0" : "gap-3 px-3.5"
            }`}
            title={isCollapsed ? "Logout" : undefined}
          >
            <LogOut className="w-5 h-5 shrink-0" />
            {!isCollapsed ? (
              <span className="truncate">Logout</span>
            ) : (
              <div className="hidden lg:flex items-center absolute left-[68px] top-1/2 -translate-y-1/2 bg-[#1A1A2E] text-red-400 text-xs font-bold px-3 py-1.5 rounded-lg shadow-2xl border border-red-500/30 opacity-0 group-hover:opacity-100 pointer-events-none transition-all duration-150 z-[999] whitespace-nowrap">
                <div className="absolute right-full top-1/2 -translate-y-1/2 w-0 h-0 border-y-[5px] border-y-transparent border-r-[6px] border-r-[#1A1A2E]" />
                <span>Logout</span>
              </div>
            )}
          </button>
        </div>
      </aside>

      {/* INDEPENDENT SCROLLABLE CONTENT VIEWPORT */}
      <main className="flex-1 h-full min-w-0 w-full overflow-y-auto overflow-x-hidden bg-[#F6F6F6] transition-all duration-300">
        {children}
      </main>
    </div>
  );
}
