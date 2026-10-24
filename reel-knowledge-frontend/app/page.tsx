import Link from "next/link";
import { getItems, getUnlinkedItems } from "@/lib/api";
import { ItemCard } from "@/components/ItemCard";
import { EmptyState } from "@/components/EmptyState";
import { IncompleteBanner } from "@/components/IncompleteBanner";

export default async function DashboardPage() {
  const [recentItems, unlinked] = await Promise.all([getItems(), getUnlinkedItems()]);

  return (
    <div className="space-y-8">
      {unlinked.length > 0 && (
        <Link
          href="/unlinked"
          className="block border border-rust bg-card rounded-sm px-4 py-3
                     font-mono text-xs text-rust hover:bg-rust hover:text-card transition-colors"
        >
          {unlinked.length} resource{unlinked.length === 1 ? "" : "s"} waiting to be linked →
        </Link>
      )}

      <IncompleteBanner />

      <section>
        <h1 className="font-display font-bold text-2xl text-ink mb-4">Recently saved</h1>
        {recentItems.length === 0 ? (
          <EmptyState heading="Nothing saved yet" body="Share a reel to your Telegram bot to get started." />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {recentItems.map((item) => (
              <ItemCard key={item.id} item={item} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
