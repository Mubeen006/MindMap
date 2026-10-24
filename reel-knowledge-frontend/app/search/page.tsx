import { Suspense } from "react";
import { getItem, searchItems } from "@/lib/api";
import { SearchBar } from "@/components/SearchBar";
import { ItemCard } from "@/components/ItemCard";
import { EmptyState } from "@/components/EmptyState";

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const query = q ?? "";

  const results = query ? await searchItems(query) : [];
  const fullItems = query ? await Promise.all(results.map((r) => getItem(r.id))) : [];

  return (
    <div>
      <h1 className="font-display font-bold text-2xl text-ink mb-4">Search</h1>
      <Suspense fallback={<div className="h-11" />}>
        <SearchBar />
      </Suspense>

      <div className="mt-8">
        {!query && (
          <EmptyState
            heading="Describe a problem"
            body='Try something like "how do I set up Claude for free" instead of exact keywords.'
          />
        )}
        {query && fullItems.length === 0 && (
          <EmptyState heading="No matches found" body={`Nothing relevant to "${query}" yet.`} />
        )}
        {fullItems.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {fullItems.map((item) => (
              <ItemCard
                key={item.id}
                item={{ ...item, setupStepsCount: item.setupSteps.length }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
