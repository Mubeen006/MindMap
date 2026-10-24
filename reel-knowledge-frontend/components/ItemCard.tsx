import Link from "next/link";
import Image from "next/image";
import { ItemSummary } from "@/lib/types";
import { CategoryStamp } from "./CategoryStamp";
import { formatSavedDate } from "@/lib/format";

export function ItemCard({ item }: { item: ItemSummary }) {
  const isPending = item.status === "PENDING" || item.status === "PROCESSING";
  const isFailed = item.status === "FAILED";
  const categoryLabel = item.category
    ? item.category.parent
      ? `${item.category.parent.name} › ${item.category.name}`
      : item.category.name
    : null;

  return (
    <Link
      href={`/item/${item.id}`}
      className="group relative block bg-card border border-line rounded-sm
                 shadow-[2px_2px_0_var(--line)]
                 hover:shadow-[3px_3px_0_var(--teal)] hover:-translate-y-0.5
                 transition-all duration-150 overflow-hidden"
    >
      <CategoryStamp name={item.category?.name ?? null} />

      {item.thumbnailUrl ? (
        <div className="relative w-full aspect-video bg-line">
          <Image src={item.thumbnailUrl} alt="" fill className="object-cover" unoptimized />
        </div>
      ) : (
        <div className="w-full aspect-video bg-line flex items-center justify-center">
          <span className="font-mono text-xs text-muted">no thumbnail</span>
        </div>
      )}

      <div className="p-4">
        <div className="flex items-center gap-2">
          {isPending && <span className="font-mono text-[10px] uppercase text-muted">processing…</span>}
          {isFailed && <span className="font-mono text-[10px] uppercase text-rust">failed</span>}
          <span className="font-mono text-[10px] text-muted ml-auto">{formatSavedDate(item.createdAt)}</span>
        </div>

        <h3 className="font-display font-bold text-base leading-snug text-ink mt-1">
          {item.title ?? "Untitled"}
        </h3>

        {item.problemSolved && (
          <p className="font-body text-sm text-teal mt-1 leading-snug">{item.problemSolved}</p>
        )}

        {item.keyPoints.length > 0 && (
          <ul className="mt-2 space-y-1">
            {item.keyPoints.slice(0, 3).map((point, i) => (
              <li key={i} className="font-body text-sm text-muted leading-snug">
                • {point}
              </li>
            ))}
          </ul>
        )}

        {item.toolsMentioned.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {item.toolsMentioned.map((tool) => (
              <span key={tool} className="font-mono text-[10px] px-1.5 py-0.5 bg-teal text-card rounded-sm">
                {tool}
              </span>
            ))}
          </div>
        )}

        <div className="mt-2 flex items-center gap-2">
          {item.setupStepsCount > 0 && (
            <span className="font-mono text-[10px] text-rust">
              {item.setupStepsCount} setup steps →
            </span>
          )}
          {categoryLabel && (
            <span className="font-mono text-[10px] text-muted ml-auto">{categoryLabel}</span>
          )}
        </div>

        {item.tags.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {item.tags.map((tag) => (
              <span key={tag.id} className="font-mono text-[10px] px-1.5 py-0.5 border border-line text-muted rounded-sm">
                {tag.name}
              </span>
            ))}
          </div>
        )}
      </div>
    </Link>
  );
}
