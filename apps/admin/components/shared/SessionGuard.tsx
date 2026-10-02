"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { IDLE_WARNING_SECONDS } from "@/lib/session";
import { ConfirmModal } from "./ConfirmModal";
import { Clock } from "lucide-react";

/** At most one renewal request this often while the admin is active. */
const RENEW_INTERVAL_MS = 60_000;

/** Tabs share session updates on this channel. */
const CHANNEL_NAME = "admin-session";

type SessionMessage =
  | { type: "renewed"; expiresIn: number }
  | { type: "logged-out" };

/**
 * Enforces the idle timeout in the browser.
 *
 * Middleware only gates *navigation*, so a dashboard tab left open all
 * afternoon never re-checked anything and kept looking signed in. This
 * watches for real activity, slides the server-side session while the admin
 * is working, warns shortly before the deadline, and signs them out when it
 * passes — including the case where the laptop was asleep, since the check is
 * against the server's expiry rather than a local timer.
 *
 * Every tab runs its own countdown, and a hidden tab never sees activity in
 * the tab being used. It used to reach zero anyway and call logout — which
 * clears the one shared cookie and signed the admin out of every tab mid-task.
 * Now a tab only acts on the SERVER's answer, and renewals are broadcast so
 * all tabs keep the same deadline.
 *
 * "Keep me signed in" sessions have no idle window: no countdown or warning,
 * only a re-check when the tab is shown, which catches the 7-day expiry and
 * sign-outs from another device.
 */
export function SessionGuard() {
  const router = useRouter();
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const [showWarning, setShowWarning] = useState(false);
  const [remember, setRemember] = useState(false);

  // Activity since the last renewal. A ref (not state) so listeners don't
  // re-render the whole dashboard on every mouse move.
  const activeSinceLastPing = useRef(false);
  const lastRenewAt = useRef(0);
  const checking = useRef(false);
  const loggingOut = useRef(false);
  const channel = useRef<BroadcastChannel | null>(null);

  const goToLogin = useCallback(() => {
    if (loggingOut.current) return;
    loggingOut.current = true;
    router.push("/login");
    router.refresh();
  }, [router]);

  /** Explicit sign-out: revoke the session server-side, then tell other tabs. */
  const logout = useCallback(async () => {
    if (loggingOut.current) return;
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // Even if the call fails, still send them to /login — middleware will
      // reject the dead cookie on the way in.
    }
    channel.current?.postMessage({ type: "logged-out" } satisfies SessionMessage);
    goToLogin();
  }, [goToLogin]);

  /**
   * Ask the server (GET: read only, POST: renew). Returns the seconds left, or
   * null on a network error. A 401 means the session really is over.
   */
  const syncSession = useCallback(async (extend: boolean): Promise<number | null> => {
    try {
      const res = await fetch("/api/auth/session", { method: extend ? "POST" : "GET" });
      if (res.status === 401) {
        channel.current?.postMessage({ type: "logged-out" } satisfies SessionMessage);
        goToLogin();
        return 0;
      }
      const data = await res.json().catch(() => null);
      if (data?.authenticated && typeof data.expiresIn === "number") {
        setRemember(data.remember === true);
        setSecondsLeft(data.expiresIn);
        if (data.expiresIn > IDLE_WARNING_SECONDS) setShowWarning(false);
        if (extend) {
          lastRenewAt.current = Date.now();
          channel.current?.postMessage({
            type: "renewed",
            expiresIn: data.expiresIn,
          } satisfies SessionMessage);
        }
        return data.expiresIn;
      }
    } catch {
      // Network hiccup — leave the countdown alone and retry on the next tick
      // rather than logging someone out for a dropped request.
    }
    return null;
  }, [goToLogin]);

  /** The local countdown says time is up: confirm with the server first. */
  const recheck = useCallback(async () => {
    if (checking.current) return;
    checking.current = true;
    try {
      await syncSession(false);
    } finally {
      checking.current = false;
    }
  }, [syncSession]);

  // Keep every open tab on the same deadline.
  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return;
    const bc = new BroadcastChannel(CHANNEL_NAME);
    channel.current = bc;
    bc.onmessage = (event: MessageEvent<SessionMessage>) => {
      if (event.data?.type === "renewed") {
        setSecondsLeft(event.data.expiresIn);
        setShowWarning(false);
      } else if (event.data?.type === "logged-out") {
        goToLogin();
      }
    };
    return () => {
      bc.close();
      channel.current = null;
    };
  }, [goToLogin]);

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

  // One-second countdown. Pure: it only moves the number.
  useEffect(() => {
    if (remember) return;
    const tick = setInterval(() => {
      setSecondsLeft((prev) => (prev === null ? prev : Math.max(0, prev - 1)));
    }, 1000);
    return () => clearInterval(tick);
  }, [remember]);

  // React to the countdown: renew on activity, re-check with the server at the
  // warning threshold and at zero. Never logs out on the local number alone.
  useEffect(() => {
    if (remember || secondsLeft === null || loggingOut.current) return;

    if (secondsLeft <= 0) {
      recheck();
      return;
    }

    if (secondsLeft <= IDLE_WARNING_SECONDS) {
      // Another tab may have renewed without this one hearing it (no
      // BroadcastChannel). Only warn once the server confirms.
      if (!showWarning && !checking.current) {
        checking.current = true;
        syncSession(false).then((left) => {
          checking.current = false;
          if (left !== null && left > 0 && left <= IDLE_WARNING_SECONDS) setShowWarning(true);
        });
      }
      return;
    }

    if (activeSinceLastPing.current && Date.now() - lastRenewAt.current >= RENEW_INTERVAL_MS) {
      activeSinceLastPing.current = false;
      syncSession(true);
    }
  }, [secondsLeft, remember, showWarning, recheck, syncSession]);

  return (
    <ConfirmModal
      open={showWarning && !remember}
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
