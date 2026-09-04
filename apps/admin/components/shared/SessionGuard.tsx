"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { IDLE_WARNING_SECONDS } from "@/lib/session";
import { ConfirmModal } from "./ConfirmModal";
import { Clock } from "lucide-react";

/**
 * Enforces the idle timeout in the browser.
 *
 * Middleware only gates *navigation*, so a dashboard tab left open all
 * afternoon never re-checked anything and kept looking signed in. This
 * watches for real activity, slides the server-side session while the admin
 * is working, warns shortly before the deadline, and signs them out when it
 * passes — including the case where the laptop was asleep, since the check is
 * against the server's expiry rather than a local timer.
 */
export function SessionGuard() {
  const router = useRouter();
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const [showWarning, setShowWarning] = useState(false);

  // Activity since the last renewal. A ref (not state) so listeners don't
  // re-render the whole dashboard on every mouse move.
  const activeSinceLastPing = useRef(false);
  const loggingOut = useRef(false);

  const logout = useCallback(async () => {
    if (loggingOut.current) return;
    loggingOut.current = true;
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // Even if the call fails, still send them to /login — middleware will
      // reject the dead cookie on the way in.
    }
    router.push("/login");
    router.refresh();
  }, [router]);

  const syncSession = useCallback(async (extend: boolean) => {
    try {
      const res = await fetch("/api/auth/session", { method: extend ? "POST" : "GET" });
      if (res.status === 401) {
        await logout();
        return;
      }
      const data = await res.json().catch(() => null);
      if (data?.authenticated && typeof data.expiresIn === "number") {
        setSecondsLeft(data.expiresIn);
      }
    } catch {
      // Network hiccup — leave the countdown alone and retry on the next tick
      // rather than logging someone out for a dropped request.
    }
  }, [logout]);

  // Track activity cheaply.
  useEffect(() => {
    const markActive = () => { activeSinceLastPing.current = true; };
    const events: (keyof WindowEventMap)[] = ["pointerdown", "keydown", "wheel", "touchstart"];
    events.forEach((e) => window.addEventListener(e, markActive, { passive: true }));
    return () => events.forEach((e) => window.removeEventListener(e, markActive));
  }, []);

  // Re-check immediately when the tab is shown again — this is what catches
  // "closed the laptop, came back hours later".
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") syncSession(false);
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [syncSession]);

  // Initial read.
  useEffect(() => { syncSession(false); }, [syncSession]);

  // One-second countdown; renews from the server only when there's been real
  // activity, so an idle tab genuinely expires.
  useEffect(() => {
    const tick = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev === null) return prev;
        const next = prev - 1;

        if (next <= 0) {
          logout();
          return 0;
        }

        if (activeSinceLastPing.current && next > IDLE_WARNING_SECONDS) {
          // Only extend while comfortably inside the window; once the warning
          // is up the admin must confirm explicitly.
          activeSinceLastPing.current = false;
          syncSession(true);
        }

        setShowWarning(next <= IDLE_WARNING_SECONDS);
        return next;
      });
    }, 1000);
    return () => clearInterval(tick);
  }, [logout, syncSession]);

  return (
    <ConfirmModal
      open={showWarning}
      title="Still there?"
      message={`You'll be signed out in ${Math.max(0, secondsLeft ?? 0)} second${(secondsLeft ?? 0) === 1 ? "" : "s"} due to inactivity.`}
      confirmLabel="Stay signed in"
      cancelLabel="Log out now"
      icon={Clock}
      onConfirm={() => {
        setShowWarning(false);
        activeSinceLastPing.current = false;
        syncSession(true);
      }}
      onCancel={logout}
    />
  );
}
