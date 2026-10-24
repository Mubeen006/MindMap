export function CategoryStamp({ name }: { name: string | null }) {
  if (!name) return null;

  return (
    <div
      className="absolute top-3 right-3 rotate-[-4deg] border border-teal bg-card px-2 py-1 pointer-events-none"
      aria-hidden="false"
    >
      <span className="font-mono text-[10px] uppercase tracking-wider text-teal">
        {name}
      </span>
    </div>
  );
}
