import prisma from "../models/prisma.client";
import { getTransporter } from "./email.service";

// ─────────────────────────────────────────────────────
// Operational alerting
//
// The admin settings page has had an "email me about system errors" toggle
// since before this file existed. Nothing read it. It was written and read
// only by its own settings CRUD, so switching it on did nothing at all.
//
// This wires it to an actual send, because the CERT-In 6-hour reporting clock
// and the DPDP notification duty cannot depend entirely on someone happening
// to notice.
//
// ⚠️ HONEST LIMITATION — read docs/runbooks/incident-response.md.
// There is no error capture in this system: no Sentry, no APM, no aggregated
// logs. So this channel only fires on the conditions that explicitly call
// raiseAlert() below. It is a way to be told about things we already detect —
// not a way to detect things. Automated detection needs error capture first.
// ─────────────────────────────────────────────────────

export type AlertSeverity = "critical" | "warning";

export interface Alert {
  severity: AlertSeverity;
  /** Short, scannable. Becomes the email subject. */
  title: string;
  detail: string;
  /** Anything useful for triage — counts, ids, error messages. */
  context?: Record<string, unknown>;
}

/** Where alerts go, when nothing is configured in the admin settings. */
const FALLBACK_RECIPIENT = process.env.INCIDENT_ALERT_EMAIL;
/** Optional generic webhook (Slack, PagerDuty inbound, etc.). */
const WEBHOOK_URL = process.env.INCIDENT_WEBHOOK_URL;

async function alertingEnabled(): Promise<boolean> {
  try {
    const settings = await prisma.adminNotificationSettings.findFirst({
      select: { emailSystemErrors: true },
    });
    // Absent settings row means nobody has configured this yet. Default to
    // alerting: silence is the worse failure here.
    return settings?.emailSystemErrors ?? true;
  } catch {
    return true;
  }
}

async function recipient(): Promise<string | null> {
  if (FALLBACK_RECIPIENT) return FALLBACK_RECIPIENT;
  try {
    const general = await prisma.adminGeneralSettings.findFirst({
      select: { emailConfig: true },
    });
    return general?.emailConfig ?? null;
  } catch {
    return null;
  }
}

function formatBody(alert: Alert): string {
  const lines = [
    `Severity: ${alert.severity.toUpperCase()}`,
    `Time:     ${new Date().toISOString()}`,
    "",
    alert.detail,
  ];
  if (alert.context && Object.keys(alert.context).length > 0) {
    lines.push("", "Context:", JSON.stringify(alert.context, null, 2));
  }
  lines.push(
    "",
    "— Digiability Community automated alert.",
    "Incident procedure: docs/runbooks/incident-response.md"
  );
  return lines.join("\n");
}

/**
 * Raise an operational alert.
 *
 * Never throws: an alerting failure must not take down the thing it was
 * reporting on. Failures are written to stderr so they are at least visible in
 * container logs.
 */
export async function raiseAlert(alert: Alert): Promise<void> {
  const body = formatBody(alert);

  // Always write it to the log, whether or not a channel is configured — this
  // is the floor, so an alert is never lost entirely.
  process.stderr.write(
    JSON.stringify({
      event: "alert.raised",
      severity: alert.severity,
      title: alert.title,
      detail: alert.detail,
      context: alert.context ?? {},
      timestamp: new Date().toISOString(),
    }) + "\n"
  );

  if (!(await alertingEnabled())) return;

  // Webhook first: it is the faster path, and the 6-hour clock is short.
  if (WEBHOOK_URL) {
    try {
      await fetch(WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: `[${alert.severity.toUpperCase()}] ${alert.title}\n\n${body}`,
        }),
        signal: AbortSignal.timeout(5000),
      });
    } catch (err) {
      process.stderr.write(`[alert] webhook failed: ${(err as Error).message}\n`);
    }
  }

  const to = await recipient();
  if (!to) {
    process.stderr.write(
      "[alert] no recipient configured — set INCIDENT_ALERT_EMAIL or the admin " +
        "general settings email, or alerts stay in the logs only.\n"
    );
    return;
  }

  try {
    await getTransporter().sendMail({
      from: process.env.EMAIL_FROM,
      to,
      subject: `[${alert.severity.toUpperCase()}] Digiability — ${alert.title}`,
      text: body,
    });
  } catch (err) {
    process.stderr.write(`[alert] email failed: ${(err as Error).message}\n`);
  }
}
