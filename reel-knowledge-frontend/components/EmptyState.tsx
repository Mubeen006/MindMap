export function EmptyState({
  heading,
  body,
}: {
  heading: string;
  body?: string;
}) {
  return (
    <div className="border border-dashed border-line rounded-sm py-16 px-6 text-center">
      <p className="font-display font-bold text-ink">{heading}</p>
      {body && <p className="font-body text-sm text-muted mt-2">{body}</p>}
    </div>
  );
}
