"use client";

import { useEffect } from "react";
import { X } from "lucide-react";

/**
 * Centered dialog with a fixed header and a scrolling body.
 *
 * The panel is capped to the viewport height and scrolls internally rather than
 * letting the backdrop scroll. That matters: centring a flex child that is
 * taller than its scroll container pushes the overflow *above* the top edge,
 * where it can never be scrolled back into view — which silently clipped the
 * title and the close button. Capping the height keeps the header reachable at
 * any screen size.
 *
 * Closes on Escape, on a backdrop click, and via the corner button. The caller
 * unmounts this component when closing, so any form inside resets on reopen.
 */
export function Modal({
  title,
  description,
  onClose,
  children,
  wide,
}: {
  title: string;
  description?: React.ReactNode;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Freeze the page behind the dialog for as long as it is mounted.
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm sm:p-6"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className={`glass-card flex max-h-[calc(100vh-2rem)] w-full flex-col overflow-hidden bg-white/95 shadow-2xl dark:bg-slate-900/95 sm:max-h-[calc(100vh-3rem)] ${
          wide ? "max-w-2xl" : "max-w-lg"
        }`}
      >
        {/* Header — never scrolls away, so the close button is always reachable. */}
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-200/70 px-6 pb-5 pt-6 dark:border-slate-700/70">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold leading-tight text-slate-800 dark:text-slate-100">
              {title}
            </h2>
            {description && (
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{description}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            title="Close without saving"
            className="-mr-2 -mt-1 shrink-0 rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500/40 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body — the only part that scrolls. */}
        <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-6 pt-5">{children}</div>
      </div>
    </div>
  );
}
