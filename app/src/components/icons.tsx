import type { SVGProps } from "react";

/** A small, consistent line-icon set (24px grid, 1.75 stroke). Decorative by default: pass `title` for meaning. */
type IconProps = Omit<SVGProps<SVGSVGElement>, "children"> & { size?: number; title?: string };

function Base({ size = 20, title, children, ...rest }: IconProps & { children: React.ReactNode }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" role={title ? "img" : undefined} aria-hidden={title ? undefined : true} aria-label={title} {...rest}>
      {children}
    </svg>
  );
}

export const IconPin = (p: IconProps) => (
  <Base {...p}>
    <path d="M12 21s-7-6.1-7-11.2A7 7 0 0 1 19 9.8C19 14.9 12 21 12 21Z" />
    <circle cx="12" cy="9.8" r="2.4" />
  </Base>
);
export const IconSearch = (p: IconProps) => (
  <Base {...p}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="m16 16 4.5 4.5" />
  </Base>
);
export const IconBag = (p: IconProps) => (
  <Base {...p}>
    <path d="M5.5 8.5h13l-1 10.6a1.5 1.5 0 0 1-1.5 1.4H8a1.5 1.5 0 0 1-1.5-1.4l-1-10.6Z" />
    <path d="M9 8.5V7a3 3 0 0 1 6 0v1.5" />
  </Base>
);
export const IconPlus = (p: IconProps) => (
  <Base {...p}>
    <path d="M12 5v14M5 12h14" />
  </Base>
);
export const IconMinus = (p: IconProps) => (
  <Base {...p}>
    <path d="M5 12h14" />
  </Base>
);
export const IconCheck = (p: IconProps) => (
  <Base {...p}>
    <path d="m5 12.5 4.5 4.5L19 7.5" />
  </Base>
);
export const IconX = (p: IconProps) => (
  <Base {...p}>
    <path d="m6 6 12 12M18 6 6 18" />
  </Base>
);
export const IconChevronDown = (p: IconProps) => (
  <Base {...p}>
    <path d="m6 9 6 6 6-6" />
  </Base>
);
export const IconChevronRight = (p: IconProps) => (
  <Base {...p}>
    <path d="m9 6 6 6-6 6" />
  </Base>
);
export const IconArrowRight = (p: IconProps) => (
  <Base {...p}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </Base>
);
export const IconBolt = (p: IconProps) => (
  <Base {...p}>
    <path d="M13 3 5.5 13.5H11L10 21l7.5-10.5H12L13 3Z" />
  </Base>
);
export const IconClock = (p: IconProps) => (
  <Base {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5V12l3 2" />
  </Base>
);
export const IconInfo = (p: IconProps) => (
  <Base {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 11v5M12 8h.01" />
  </Base>
);
export const IconAlert = (p: IconProps) => (
  <Base {...p}>
    <path d="M12 4 3 19.5h18L12 4Z" />
    <path d="M12 10v4.5M12 17h.01" />
  </Base>
);
export const IconPhone = (p: IconProps) => (
  <Base {...p}>
    <path d="M6.5 4h3l1.5 4-2 1.3a10 10 0 0 0 5.7 5.7L16 13l4 1.5v3a2 2 0 0 1-2 2A13.5 13.5 0 0 1 4.5 6a2 2 0 0 1 2-2Z" />
  </Base>
);
export const IconLock = (p: IconProps) => (
  <Base {...p}>
    <rect x="5" y="11" width="14" height="9" rx="2" />
    <path d="M8 11V8a4 4 0 0 1 8 0v3" />
  </Base>
);
export const IconLogout = (p: IconProps) => (
  <Base {...p}>
    <path d="M10 4H6.5A1.5 1.5 0 0 0 5 5.5v13A1.5 1.5 0 0 0 6.5 20H10M15 8l4 4-4 4M19 12H9.5" />
  </Base>
);
export const IconCrosshair = (p: IconProps) => (
  <Base {...p}>
    <circle cx="12" cy="12" r="6" />
    <path d="M12 3v3M12 18v3M3 12h3M18 12h3" />
  </Base>
);
export const IconReceipt = (p: IconProps) => (
  <Base {...p}>
    <path d="M6 3.5h12v17l-3-2-3 2-3-2-3 2v-17Z" />
    <path d="M9.5 8.5h5M9.5 12h5" />
  </Base>
);

export const IconScale = (p: IconProps) => (
  <Base {...p}>
    <path d="M12 4v16M7 20h10M5 7h14" />
    <path d="M5 7 2.5 13a3 3 0 0 0 5 0L5 7ZM19 7l-2.5 6a3 3 0 0 0 5 0L19 7Z" />
  </Base>
);
export const IconTag = (p: IconProps) => (
  <Base {...p}>
    <path d="M3.5 12.2V4.5a1 1 0 0 1 1-1h7.7a1 1 0 0 1 .7.3l7.3 7.3a1 1 0 0 1 0 1.4l-7.7 7.7a1 1 0 0 1-1.4 0l-7.3-7.3a1 1 0 0 1-.3-.7Z" />
    <circle cx="8.2" cy="8.2" r="1.4" />
  </Base>
);
export const IconRefund = (p: IconProps) => (
  <Base {...p}>
    <path d="M4 12a8 8 0 1 0 2.6-5.9M4 4v4.5h4.5" />
    <path d="M12 8.5v7M14.2 10.2c-.4-.8-1.2-1.2-2.2-1.2-1.3 0-2.2.7-2.2 1.6s.9 1.4 2.2 1.6c1.3.2 2.2.7 2.2 1.6s-.9 1.6-2.2 1.6c-1 0-1.9-.4-2.3-1.2" />
  </Base>
);
export const IconTruck = (p: IconProps) => (
  <Base {...p}>
    <path d="M3 6.5h11v9H3zM14 9.5h4l3 3v3h-7" />
    <circle cx="7.5" cy="17" r="1.8" />
    <circle cx="17" cy="17" r="1.8" />
  </Base>
);
export const IconLeaf = (p: IconProps) => (
  <Base {...p}>
    <path d="M5 19c0-8 5-13 14-14 0 9-5 14-14 14Z" />
    <path d="M5 19 13 11" />
  </Base>
);
export const IconWallet = (p: IconProps) => (
  <Base {...p}>
    <path d="M4 7.5A2.5 2.5 0 0 1 6.5 5H18v3M4 7.5V17a2 2 0 0 0 2 2h13a1 1 0 0 0 1-1V9a1 1 0 0 0-1-1H6.5A2.5 2.5 0 0 1 4 7.5Z" />
    <circle cx="16" cy="13.5" r="1.1" />
  </Base>
);
