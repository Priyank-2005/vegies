"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cx } from "@/components/ui";

export interface NavItem {
  href: string;
  label: string;
}

/** Sidebar on large screens, a scrolling tab strip on small ones. Active item follows the URL. */
export function AdminNav({ items }: { items: NavItem[] }) {
  const path = usePathname();
  return (
    <nav aria-label="Main" className="scrollbar-none -mx-4 flex gap-1 overflow-x-auto px-4 lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0">
      {items.map((i) => {
        const active = i.href === "/admin" ? path === "/admin" : path.startsWith(i.href);
        return (
          <Link
            key={i.href}
            href={i.href}
            aria-current={active ? "page" : undefined}
            className={cx("shrink-0 whitespace-nowrap rounded-md px-3 py-2 text-[14px] font-medium", active ? "bg-brand-soft text-brand" : "text-muted hover:bg-surface-2 hover:text-ink")}
          >
            {i.label}
          </Link>
        );
      })}
    </nav>
  );
}
