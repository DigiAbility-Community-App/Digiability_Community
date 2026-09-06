"use client";

import Link from "next/link";
import { ArrowLeft, ShieldCheck, KeyRound, Lock, FileClock, Mail } from "lucide-react";

// ----------------------
// SECURITY — public, pre-login page linked from the Admin Login footer.
// Registered as a public route in middleware.ts's isPublic allowlist.
// ----------------------

function Section({
    icon,
    title,
    children,
}: {
    icon: React.ReactNode;
    title: string;
    children: React.ReactNode;
}) {
    return (
        <div className="flex gap-4">
            <div className="w-10 h-10 shrink-0 rounded-xl bg-[#F0EAF9] text-[#7004DC] flex items-center justify-center">
                {icon}
            </div>
            <div>
                <h2 className="text-base font-bold text-[#1A1C1C] mb-1">{title}</h2>
                <p className="text-sm text-[#4B4355] leading-6">{children}</p>
            </div>
        </div>
    );
}

export default function SecurityPage() {
    return (
        <div className="min-h-screen bg-[#F6F6F6] px-6 py-10">
            <div className="max-w-2xl mx-auto">
                <Link
                    href="/login"
                    className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.15em] text-slate-500 hover:text-[#7004DC] transition mb-8"
                >
                    <ArrowLeft className="w-3.5 h-3.5" /> Back to Login
                </Link>

                <div className="bg-white rounded-[24px] shadow-sm border border-gray-100 p-8 sm:p-10">
                    <h1 className="text-2xl font-extrabold text-[#1A1C1C] mb-2">
                        Security at DigiAbility Community
                    </h1>
                    <p className="text-sm text-[#7D7387] mb-8">
                        An overview of how we protect accounts and data across the platform.
                    </p>

                    <div className="space-y-7">
                        <Section icon={<KeyRound className="w-5 h-5" />} title="Authentication">
                            Sign-in uses RS256-signed JWT access tokens with a short 15-minute
                            lifetime, paired with a separate refresh token for staying signed
                            in. Only the identity service holds the private signing key — every
                            other service can verify a token but never issue one.
                        </Section>

                        <Section icon={<Lock className="w-5 h-5" />} title="Credential storage">
                            Passwords are hashed, never stored or logged in plain text. Refresh
                            tokens are stored as one-way SHA-256 hashes, so the raw token itself
                            never sits in our database. Admin accounts can additionally enable
                            two-factor authentication from Settings → Security.
                        </Section>

                        <Section icon={<FileClock className="w-5 h-5" />} title="Access control &amp; auditing">
                            Admin actions are role-gated and recorded in an audit log, so
                            changes to users, groups, and content can be traced back to who
                            made them and when.
                        </Section>

                        <Section icon={<ShieldCheck className="w-5 h-5" />} title="Ongoing hardening">
                            Security work continues on an ongoing basis, including rate
                            limiting, input validation, and periodic review of how tokens and
                            personal data are stored and transmitted.
                        </Section>

                        <Section icon={<Mail className="w-5 h-5" />} title="Report a concern">
                            If you believe you've found a security issue, please email{" "}
                            <a
                                href="mailto:support@digiability.org"
                                className="text-[#7004DC] font-semibold hover:underline"
                            >
                                support@digiability.org
                            </a>{" "}
                            with details so we can investigate promptly.
                        </Section>
                    </div>
                </div>
            </div>
        </div>
    );
}
