"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { useI18n } from "@/i18n/client";

/**
 * Accessible modal built on <dialog>: focus trapping, Esc to close and the
 * backdrop come from the browser.
 */
export default function Modal({
  open,
  onClose,
  title,
  children,
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  size?: "md" | "lg";
}) {
  const { t } = useI18n();
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      aria-labelledby="modal-title"
      className={`m-auto w-[calc(100%-2rem)] ${size === "lg" ? "max-w-3xl" : "max-w-lg"} border-line bg-background text-foreground shadow-modal rounded-xl border p-0`}
    >
      {open && (
        <div className="max-h-[85vh] overflow-y-auto p-5 sm:p-6">
          <div className="mb-4 flex items-start justify-between gap-4">
            <h2 id="modal-title" className="text-h3">
              {title}
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="text-muted hover:bg-surface-muted hover:text-foreground -m-1 rounded-md p-1"
              aria-label={t.common.close}
            >
              <svg
                viewBox="0 0 20 20"
                className="size-5"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
              >
                <path d="M5 5l10 10M15 5L5 15" strokeLinecap="round" />
              </svg>
            </button>
          </div>
          {children}
        </div>
      )}
    </dialog>
  );
}
