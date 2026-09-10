"use client";

import { AlertTriangle } from "lucide-react";

/**
 * Validation/error banner for a modal, designed to live in the modal FOOTER
 * rather than at the top of its scrollable body.
 *
 * Admin modals share a shape: a `max-h-[90vh] flex flex-col` shell with a
 * `flex-1 overflow-y-auto` body and a footer holding the submit button. The
 * error used to be the first child of that scrolling body, so submitting from
 * the bottom of a long form put the explanation somewhere off-screen above —
 * the action just appeared to do nothing. Anchoring it beside the button that
 * produced it means it is always in view.
 *
 * Renders nothing when there is no message, so it can be left in place
 * unconditionally.
 */
export function ModalErrorBanner({ message }: { message?: string | null }) {
  if (!message) return null;

  return (
    <div
      // role="alert" so screen readers announce it when it appears, rather
      // than the admin having to discover it.
      role="alert"
      className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-600 rounded-xl px-4 py-3 text-sm font-semibold"
    >
      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
      <span className="min-w-0">{message}</span>
    </div>
  );
}
