"use client";

import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useRef, useState, useSyncExternalStore, useTransition, type ReactNode } from "react";
import { IconAlert, IconCheck, IconX } from "@/components/icons";
import { Button, cx, type ButtonVariant } from "@/components/ui";
import type { ActionResult } from "@/server/admin-action";

// ---------------------------------------------------------------------------------------------
// Toasts: every action reports back here, success or failure
// ---------------------------------------------------------------------------------------------

type Tone = "ok" | "error";
interface Toast {
  id: number;
  tone: Tone;
  text: string;
}
const ToastCtx = createContext<(tone: Tone, text: string) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const seq = useRef(0);
  const show = useCallback((tone: Tone, text: string) => {
    const id = ++seq.current;
    setToasts((t) => [...t.slice(-3), { id, tone, text }]);
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), tone === "error" ? 8000 : 3500);
  }, []);
  return (
    <ToastCtx.Provider value={show}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} role={t.tone === "error" ? "alert" : "status"} className={cx("pointer-events-auto flex max-w-md items-start gap-2.5 rounded-xl px-4 py-3 text-[14px] font-medium shadow-pop", t.tone === "error" ? "bg-danger text-white" : "bg-brand-deep text-white")}>
            {t.tone === "error" ? <IconAlert size={18} className="mt-0.5 shrink-0" /> : <IconCheck size={18} className="mt-0.5 shrink-0 text-accent" />}
            <span>{t.text}</span>
            <button type="button" className="-mr-1 ml-1 shrink-0 opacity-70 hover:opacity-100" aria-label="Dismiss" onClick={() => setToasts((x) => x.filter((y) => y.id !== t.id))}>
              <IconX size={16} />
            </button>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export const useToast = () => useContext(ToastCtx);

// ---------------------------------------------------------------------------------------------
// Running a server action from a button or form
// ---------------------------------------------------------------------------------------------

/** run(fn) calls a server action, shows its result as a toast, refreshes the page data on success, and reports pending. */
export function useRunner() {
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();
  const run = useCallback(
    <T,>(fn: () => Promise<ActionResult<T>>, after?: (data: T) => void) => {
      start(async () => {
        const r = await fn();
        if (r.ok) {
          if (r.message) toast("ok", r.message);
          after?.(r.data);
          router.refresh();
        } else {
          toast("error", r.message);
          router.refresh();
        }
      });
    },
    [router, toast],
  );
  return { run, pending };
}

export function ActionButton<T>({ label, action, variant = "secondary", size = "sm", confirm, className, disabled, after }: { label: ReactNode; action: () => Promise<ActionResult<T>>; variant?: ButtonVariant; size?: "sm" | "md" | "lg"; confirm?: string; className?: string; disabled?: boolean; after?: (data: T) => void }) {
  const { run, pending } = useRunner();
  return (
    <Button
      variant={variant}
      size={size}
      className={className}
      disabled={disabled || pending}
      onClick={() => {
        if (confirm && !window.confirm(confirm)) return;
        run(action, after);
      }}
    >
      {pending ? "Please wait…" : label}
    </Button>
  );
}

// ---------------------------------------------------------------------------------------------
// A dialog built on the native <dialog> element (focus trap and Escape come for free)
// ---------------------------------------------------------------------------------------------

export function Dialog({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      d.showModal();
      // Land on the first field, not the close button, so a rider can type straight away.
      d.querySelector<HTMLElement>("input:not([type=radio]):not([type=checkbox]), select, textarea")?.focus();
    }
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog ref={ref} onClose={onClose} onClick={(e) => e.target === ref.current && onClose()} className="m-auto w-[min(92vw,30rem)] rounded-2xl border border-line bg-surface p-0 text-ink shadow-pop backdrop:bg-black/50">
      <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
        <h2 className="text-[17px] font-extrabold">{title}</h2>
        <button type="button" onClick={onClose} aria-label="Close" className="rounded-md p-1 text-muted hover:bg-surface-2">
          <IconX size={18} />
        </button>
      </div>
      <div className="p-5">{open ? children : null}</div>
    </dialog>
  );
}

// ---------------------------------------------------------------------------------------------
// Live page: refresh server data on a timer while the tab is visible
// ---------------------------------------------------------------------------------------------

export function AutoRefresh({ seconds = 20 }: { seconds?: number }) {
  const router = useRouter();
  useEffect(() => {
    const t = window.setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, seconds * 1000);
    return () => window.clearInterval(t);
  }, [router, seconds]);
  return null;
}

// ---------------------------------------------------------------------------------------------
// A clock that ticks without making rendering impure
// ---------------------------------------------------------------------------------------------

function subscribeTick(cb: () => void) {
  const t = window.setInterval(cb, 15_000);
  return () => window.clearInterval(t);
}

/** Current time in ms, quantised to 15 s so the snapshot is stable between ticks. `serverNow` is used for the first paint. */
export function useNow(serverNow: number): number {
  return useSyncExternalStore(
    subscribeTick,
    () => Math.floor(Date.now() / 15_000) * 15_000,
    () => serverNow,
  );
}

/** "12 min left", "due now", "7 min late": counts against a promised time. */
export function Countdown({ at, serverNow, className }: { at: string; serverNow: number; className?: string }) {
  const now = useNow(serverNow);
  const mins = Math.round((new Date(at).getTime() - now) / 60_000);
  const late = mins < 0;
  const soon = !late && mins <= 10;
  const text = mins === 0 ? "due now" : late ? `${formatSpan(-mins)} late` : `${formatSpan(mins)} left`;
  return <span className={cx("whitespace-nowrap font-semibold tabular-nums", late ? "text-danger" : soon ? "text-accent-ink" : "text-muted", className)}>{text}</span>;
}

function formatSpan(mins: number): string {
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `${h} hr` : `${h} hr ${m} min`;
}
