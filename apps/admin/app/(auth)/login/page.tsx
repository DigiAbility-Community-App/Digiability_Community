"use client";

// ----------------------
// IMPORTS
// ----------------------

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";

import {
    ShieldCheck,
    Mail,
    Lock,
    Eye,
    EyeOff,
    ArrowRight,
    Users,
    Activity,
} from "lucide-react";

// ----------------------
// COMPONENT
// ----------------------

const AdminLoginPage = () => {
    const router = useRouter();

    // ----------------------
    // STATES
    // ----------------------

    const [showPassword, setShowPassword] =
        useState(false);

    const [loading, setLoading] =
        useState(false);

    const [error, setError] =
        useState("");

    // ----------------------
    // FUNCTIONS
    // ----------------------

    const handleLogin = async (
        e: React.FormEvent<HTMLFormElement>
    ) => {
        e.preventDefault();
        setError("");
        setLoading(true);

        try {
            const formData = new FormData(e.currentTarget);
            const email = formData.get("email") as string;
            const password = formData.get("password") as string;
            // The checkbox was previously unnamed and never read — ticking it
            // did nothing, while the cookie was always persistent anyway.
            const rememberMe = formData.get("rememberMe") === "on";

            const response = await fetch("/api/auth/login", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ email, password, rememberMe }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || "Invalid email or password");
            }

            // Redirect to dashboard
            router.push("/dashboard");
        } catch (err: any) {
            setError(err.message || "Something went wrong. Please try again.");
            setLoading(false);
        }
    };

    // ----------------------
    // RENDER
    // ----------------------

    return (
        <div className="h-screen overflow-y-auto bg-[#F6F6F6] flex flex-col">
            {/* MAIN LAYOUT */}
            <div className="flex flex-1 flex-col lg:flex-row">

                {/* LEFT PANEL */}
                <div className="hidden lg:flex relative w-[45%] bg-[#1A1A2E] overflow-hidden">

                    {/* GRADIENT */}
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_30%,rgba(138,56,245,0.35),transparent_45%)]" />

                    <div className="relative z-10 flex flex-col justify-between h-full w-full px-16 py-8">

                        {/* TOP */}
                        <div>
                            {/* LOGO */}
                            <div className="flex items-center gap-3 mb-8">
                                <Image
                                    src="/logo.png"
                                    alt="DigiAbility Logo"
                                    width={40}
                                    height={40}
                                    className="rounded-xl object-contain bg-white p-1 shadow-lg shadow-violet-500/10"
                                />

                                <h1 className="text-white text-3xl font-extrabold tracking-tight">
                                    DigiAbility
                                </h1>
                            </div>

                            {/* HERO */}
                            <div className="max-w-md">
                                <h2 className="text-white text-4xl font-bold leading-tight mb-4">
                                    Empowering Communities Through Smart Administration
                                </h2>

                                <p className="text-[#E2E0FC]/80 text-base leading-6">
                                    The ultimate administrative engine designed for scale,
                                    transparency, accessibility, and seamless community
                                    management.
                                </p>
                            </div>

                            {/* FEATURES */}
                            <div className="mt-8 space-y-5">

                                <FeatureItem
                                    icon={
                                        <ShieldCheck className="w-4 h-4" />
                                    }
                                    title="Secure Access"
                                    description="Enterprise-grade authentication and access control."
                                />

                                <FeatureItem
                                    icon={
                                        <Users className="w-4 h-4" />
                                    }
                                    title="Community Management"
                                    description="Manage users, services, events and moderation."
                                />

                                <FeatureItem
                                    icon={
                                        <Activity className="w-4 h-4" />
                                    }
                                    title="Analytics & Monitoring"
                                    description="Track engagement and platform activity."
                                />
                            </div>
                        </div>

                        {/* BOTTOM */}
                        <div className="text-xs uppercase tracking-[0.2em] text-[#E2E0FC]/40 font-medium">
                            Enterprise Administration Portal v1.0
                        </div>
                    </div>
                </div>

                {/* RIGHT PANEL */}
                <div className="flex flex-1 items-center justify-center px-6 py-6 lg:px-16">

                    <div className="w-full max-w-md">

                        {/* HEADER */}
                        <div className="mb-5">
                            <h2 className="text-[32px] font-bold text-[#232222]">
                                Admin Login
                            </h2>

                            <p className="text-[#4B4355] mt-2">
                                Access the DigiAbility management portal
                            </p>
                        </div>

                        {/* LOGIN CARD */}
                        <div className="bg-white rounded-[28px] shadow-[0px_12px_32px_rgba(26,26,46,0.06)] p-6">

                            <form
                                onSubmit={handleLogin}
                                className="space-y-4"
                            >
                                {error && (
                                    <div className="bg-red-50 border border-red-200 text-red-600 rounded-xl p-4 text-sm font-medium">
                                        {error}
                                    </div>
                                )}

                                {/* EMAIL */}
                                <div>
                                    <label className="block text-xs font-semibold uppercase tracking-[0.15em] text-[#4B4355] mb-2">
                                        Email Address
                                    </label>

                                    <div className="relative">
                                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-[#7D7387] w-5 h-5" />

                                        <input
                                            type="email"
                                            name="email"
                                            placeholder="admin@digiability.com"
                                            required
                                            className="w-full h-12 rounded-xl bg-[#FCF8FF] border border-transparent focus:border-[#8A38F5] focus:ring-4 focus:ring-violet-200 outline-none pl-12 pr-4 text-sm transition-all"
                                        />
                                    </div>
                                </div>

                                {/* PASSWORD */}
                                <div>
                                    <label className="block text-xs font-semibold uppercase tracking-[0.15em] text-[#4B4355] mb-2">
                                        Password
                                    </label>

                                    <div className="relative">
                                        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-[#7D7387] w-5 h-5" />

                                        <input
                                            type={
                                                showPassword
                                                    ? "text"
                                                    : "password"
                                            }
                                            name="password"
                                            placeholder="••••••••"
                                            required
                                            className="w-full h-12 rounded-xl bg-[#FCF8FF] border border-transparent focus:border-[#8A38F5] focus:ring-4 focus:ring-violet-200 outline-none pl-12 pr-12 text-sm transition-all"
                                        />

                                        <button
                                            type="button"
                                            onClick={() =>
                                                setShowPassword(
                                                    !showPassword
                                                )
                                            }
                                            className="absolute right-4 top-1/2 -translate-y-1/2 text-[#7D7387]"
                                        >
                                            {showPassword ? (
                                                <EyeOff className="w-5 h-5" />
                                            ) : (
                                                <Eye className="w-5 h-5" />
                                            )}
                                        </button>
                                    </div>
                                </div>

                                {/* UTILITIES */}
                                <div className="flex items-center">

                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            name="rememberMe"
                                            className="w-4 h-4 rounded border-[#CEC2D8]"
                                        />

                                        <span className="text-sm font-medium text-[#4B4355]">
                                            Keep me signed in on this device
                                        </span>
                                    </label>
                                </div>

                                {/* LOGIN BUTTON */}
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="w-full h-12 rounded-xl bg-[#8A38F5] hover:bg-[#7B2EF0] transition-all text-white font-bold flex items-center justify-center gap-2 shadow-lg shadow-violet-500/20 disabled:opacity-70"
                                >
                                    {loading ? (
                                        <>
                                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                            Signing In...
                                        </>
                                    ) : (
                                        <>
                                            Login to Dashboard

                                            <ArrowRight className="w-4 h-4" />
                                        </>
                                    )}
                                </button>

                                {/* RESTRICTION NOTE */}
                                <div className="flex items-start gap-3 bg-red-50 border border-red-100 rounded-xl p-4">
                                    <div className="w-2 h-2 bg-red-500 rounded-full mt-2" />

                                    <p className="text-[11px] uppercase tracking-[0.12em] font-semibold leading-5 text-[#4B4355]">
                                        Authorized administrators only.
                                        Unauthorized access is monitored
                                        and strictly prohibited.
                                    </p>
                                </div>
                            </form>
                        </div>

                        {/* MOBILE BRANDING */}
                        <div className="lg:hidden mt-8 flex justify-center">
                            <div className="flex items-center gap-2">

                                <Image
                                    src="/logo.png"
                                    alt="DigiAbility Logo"
                                    width={32}
                                    height={32}
                                    className="rounded-lg object-contain bg-white p-0.5 shadow-md shadow-violet-500/10"
                                />

                                <span className="text-xl font-bold text-[#1A1A2E]">
                                    DigiAbility
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* FOOTER */}
            <footer className="border-t border-gray-200 bg-[#F6F6F6] px-6 py-3">

                <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">

                    <p className="text-[11px] uppercase tracking-[0.15em] text-slate-500 font-semibold">
                        © 2026 DigiAbility Community Platform
                    </p>

                    <div className="flex items-center gap-6 text-[11px] uppercase tracking-[0.15em] text-slate-500 font-semibold">

                        {/* No deployed web app URL exists yet, and the legal
                            copy itself is still draft/pending review — shown
                            as inactive rather than linking to nothing/unreviewed
                            content. */}
                        <span aria-disabled="true" title="Coming soon" className="cursor-not-allowed opacity-50">
                            Privacy Policy
                        </span>

                        <span aria-disabled="true" title="Coming soon" className="cursor-not-allowed opacity-50">
                            Terms & Conditions
                        </span>

                        <a href="mailto:support@digiability.org" className="hover:text-[#7004DC] transition">
                            Support
                        </a>

                        <Link href="/security" className="hover:text-[#7004DC] transition">
                            Security
                        </Link>
                    </div>
                </div>
            </footer>
        </div>
    );
};

export default AdminLoginPage;

// ----------------------
// FEATURE ITEM
// ----------------------

type FeatureItemProps = {
    icon: React.ReactNode;
    title: string;
    description: string;
};

const FeatureItem = ({
    icon,
    title,
    description,
}: FeatureItemProps) => {
    return (
        <div className="flex items-start gap-4">

            <div className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center text-[#8A38F5]">
                {icon}
            </div>

            <div>
                <h3 className="text-white font-semibold">
                    {title}
                </h3>

                <p className="text-sm text-[#E2E0FC]/60 mt-1">
                    {description}
                </p>
            </div>
        </div>
    );
};