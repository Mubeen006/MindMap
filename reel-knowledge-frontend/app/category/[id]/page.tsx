import Link from "next/link";
import { getCategories, getItems } from "@/lib/api";
import { ItemCard } from "@/components/ItemCard";
import { EmptyState } from "@/components/EmptyState";
import { notFound } from "next/navigation";

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const categories = await getCategories();

  let current = categories.find((c) => c.id === id) as
    | (typeof categories)[number]
    | { id: string; name: string; description: string | null; itemCount: number; children: never[] }
    | undefined;
  let parent: (typeof categories)[number] | null = null;

  if (!current) {
    for (const p of categories) {
      const child = p.children.find((c) => c.id === id);
      if (child) {
        current = { ...child, children: [] };
        parent = p;
        break;
      }
    }
  }

  if (!current) notFound();

  const categoryIds =
    !parent && current.children.length > 0
      ? [id, ...current.children.map((c) => c.id)]
      : [id];

  const itemLists = await Promise.all(categoryIds.map((cid) => getItems(cid)));
  const items = itemLists
    .flat()
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return (
    <div>
      {parent && (
        <Link href={`/category/${parent.id}`} className="font-mono text-xs text-muted hover:text-teal">
          ← {parent.name}
        </Link>
      )}
      <h1 className="font-display font-bold text-2xl text-ink mt-1">{current.name}</h1>
      <p className="font-mono text-xs text-muted mt-1">
        {current.itemCount} {current.itemCount === 1 ? "card" : "cards"}
      </p>

      {current.description && (
        <p className="font-body text-sm text-ink mt-4 max-w-2xl border-l-2 border-teal pl-4">
          {current.description}
        </p>
      )}

      {!parent && current.children.length > 0 && (
        <div className="flex gap-2 flex-wrap mt-4">
          {current.children.map((child) => (
            <Link
              key={child.id}
              href={`/category/${child.id}`}
              className="font-mono text-xs px-3 py-1.5 border border-line rounded-sm text-muted hover:border-teal"
            >
              {child.name} ({child.itemCount})
            </Link>
          ))}
        </div>
      )}

      <div className="mt-8">
        {items.length === 0 ? (
          <EmptyState heading="No cards in this category yet" />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {items.map((item) => (
              <ItemCard key={item.id} item={item} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
