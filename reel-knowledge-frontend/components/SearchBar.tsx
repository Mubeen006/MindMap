"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";

export function SearchBar({ compact = false }: { compact?: boolean }) {
  const searchParams = useSearchParams();
  const urlQuery = searchParams.get("q") ?? "";
  const [query, setQuery] = useState(urlQuery);
  const router = useRouter();

  useEffect(() => {
    setQuery(urlQuery);
  }, [urlQuery]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    router.push(`/search?q=${encodeURIComponent(query.trim())}`);
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={compact ? "Search…" : "Describe the problem you're trying to solve…"}
        className={`flex-1 bg-card border border-line rounded-sm font-body text-ink placeholder:text-muted
                    focus-visible:outline-none focus-visible:border-teal
                    ${compact ? "px-3 py-1.5 text-sm" : "px-4 py-2.5 text-sm"}`}
      />
      <button
        type="submit"
        className={`flex items-center gap-2 bg-ink text-paper rounded-sm
                    font-mono text-xs uppercase tracking-wide hover:bg-teal transition-colors
                    ${compact ? "px-3 py-1.5" : "px-4 py-2.5"}`}
      >
        <Search size={14} />
        {!compact && "Search"}
      </button>
    </form>
  );
}
