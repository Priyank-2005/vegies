"use client";

import { useRouter } from "next/navigation";
import { Select } from "@/components/ui";

/** Sort dropdown that reloads the shop page with the chosen order (keeps the search and category). */
export function SortSelect({ value, options, params }: { value: string; options: Array<[string, string]>; params: Record<string, string | undefined> }) {
  const router = useRouter();
  return (
    <div className="flex items-center gap-2">
      <label htmlFor="sort" className="text-sm text-muted">
        Sort by
      </label>
      <Select
        id="sort"
        className="!min-h-9 !w-auto py-0 text-sm"
        value={value}
        onChange={(e) => {
          const p = new URLSearchParams();
          for (const [k, v] of Object.entries({ ...params, sort: e.target.value === "popular" ? undefined : e.target.value })) if (v) p.set(k, v);
          router.push(p.size ? `/shop?${p}` : "/shop");
        }}
      >
        {options.map(([k, label]) => (
          <option key={k} value={k}>
            {label}
          </option>
        ))}
      </Select>
    </div>
  );
}
