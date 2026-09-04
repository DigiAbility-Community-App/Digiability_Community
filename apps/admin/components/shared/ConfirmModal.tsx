"use client";

import { Loader2, AlertTriangle } from "lucide-react";

type IconComponent = React.ComponentType<{ className?: string }>;

/**
 * In-app replacement for window.confirm(). Matches the Transfer Ownership
 * modal's visual template so confirmations look the same everywhere in the
 * panel instead of dropping to a browser-chrome popup.
 */
export function ConfirmModal({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  destructive = false,
  busy = false,
  error,
  icon,
  hideCancel = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  busy?: boolean;
  error?: string;
  icon?: IconComponent;
  /** Single-button mode — use for informational/error dialogs. */
  hideCancel?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;

  const Icon = icon ?? AlertTriangle;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-[24px] w-full max-w-md shadow-2xl overflow-hidden">
        <div className="px-7 py-6">
          <div className="flex items-center gap-2 mb-4">
            <Icon className={`w-5 h-5 ${destructive ? "text-red-600" : "text-[#7004DC]"}`} />
            <h3 className="text-xl font-extrabold text-[#1A1C1C]">{title}</h3>
          </div>

          {message && <p className="text-sm text-[#7D7387] mb-4">{message}</p>}

          {error && <p className="text-xs font-semibold text-red-600 mb-4">{error}</p>}

          <div className="flex gap-3">
            {!hideCancel && (
              <button
                type="button"
                onClick={onCancel}
                disabled={busy}
                className="flex-1 h-11 rounded-xl border border-gray-200 text-[#4B4355] font-semibold text-sm hover:bg-gray-50 disabled:opacity-50 transition"
              >
                {cancelLabel}
              </button>
            )}
            <button
              type="button"
              onClick={onConfirm}
              disabled={busy}
              className={`flex-1 h-11 rounded-xl text-white font-bold text-sm transition flex items-center justify-center gap-2 ${
                destructive
                  ? "bg-red-600 hover:bg-red-700 disabled:bg-red-300"
                  : "bg-[#7004DC] hover:bg-[#5c03b7] disabled:bg-violet-200"
              }`}
            >
              {busy && <Loader2 className="w-4 h-4 animate-spin" />}
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
