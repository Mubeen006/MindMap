import { getItems, getUnlinkedItems } from "@/lib/api";
import { EmptyState } from "@/components/EmptyState";
import { UnlinkedList } from "@/components/UnlinkedList";

export default async function UnlinkedPage() {
  const [unlinked, allItems] = await Promise.all([getUnlinkedItems(), getItems()]);
  const reels = allItems.filter((i) => i.type === "REEL");

  return (
    <div>
      <h1 className="font-display font-bold text-2xl text-ink">Needs linking</h1>
      <p className="font-body text-sm text-muted mt-1 max-w-xl">
        Pick the reel each resource link belongs to.
      </p>

      <div className="mt-8">
        {unlinked.length === 0 ? (
          <EmptyState heading="Nothing waiting to be linked" />
        ) : (
          <UnlinkedList items={unlinked} reels={reels} />
        )}
      </div>
    </div>
  );
}
