"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Category } from "@/lib/types";

export function CategoryStrip({ categories }: { categories: Category[] }) {
  const pathname = usePathname();
  const activeId = pathname?.startsWith("/category/") ? pathname.split("/")[2] : null;

  return (
    <div className="flex gap-2 overflow-x-auto no-scrollbar py-3 -mx-6 px-6">
      <Link
        href="/"
        className={`shrink-0 font-mono text-xs px-3 py-1.5 rounded-sm border transition-colors ${
          !activeId
            ? "bg-ink text-paper border-ink"
            : "border-line text-muted hover:border-teal"
        }`}
      >
        All
      </Link>
      {categories.map((cat) => (
        <Link
          key={cat.id}
          href={`/category/${cat.id}`}
          className={`shrink-0 font-mono text-xs px-3 py-1.5 rounded-sm border transition-colors whitespace-nowrap ${
            activeId === cat.id
              ? "bg-ink text-paper border-ink"
              : "border-line text-muted hover:border-teal"
          }`}
        >
          {cat.name} <span className="opacity-60">({cat.itemCount})</span>
        </Link>
      ))}
    </div>
  );
}
