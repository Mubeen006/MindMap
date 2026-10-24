import { Suspense } from "react";
import Link from "next/link";
import { getCategories } from "@/lib/api";
import { SearchBar } from "./SearchBar";
import { CategoryStrip } from "./CategoryStrip";
import { APP_NAME } from "@/lib/config";

export async function Header() {
  const categories = await getCategories();

  return (
    <header className="border-b border-line bg-paper sticky top-0 z-10">
      <div className="max-w-6xl mx-auto px-6 py-4">
        <div className="flex items-center gap-4">
          <Link href="/" className="font-mono text-sm font-bold tracking-tight text-ink shrink-0">
            {APP_NAME}
          </Link>
          <div className="flex-1 max-w-md">
            <Suspense fallback={<div className="h-9" />}>
              <SearchBar compact />
            </Suspense>
          </div>
        </div>
        <CategoryStrip categories={categories} />
      </div>
    </header>
  );
}
