import { getIncompleteItems } from "@/lib/api";
import { EmptyState } from "@/components/EmptyState";
import { RetryButton } from "@/components/RetryButton";
import { DeleteButton } from "@/components/DeleteButton";

export default async function IncompletePage() {
  const items = await getIncompleteItems();

  return (
    <div>
      <h1 className="font-display font-bold text-2xl text-ink">Processing status</h1>
      <div className="mt-8">
        {items.length === 0 ? (
          <EmptyState heading="Everything is processed" />
        ) : (
          <ul className="space-y-3 max-w-2xl">
            {items.map((item) => (
              <li
                key={item.id}
                className="border border-line bg-card rounded-sm p-4 flex items-center justify-between gap-3"
              >
                <div>
                  <p className="font-mono text-xs text-muted">{item.type}</p>
                  <p className="font-body text-sm text-ink truncate max-w-md">{item.sourceUrl}</p>
                  <p
                    className={`font-mono text-[10px] uppercase mt-1 ${item.status === "FAILED" ? "text-rust" : "text-muted"}`}
                  >
                    {item.status}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {item.status === "FAILED" && <RetryButton itemId={item.id} />}
                  <DeleteButton itemId={item.id} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
