import Image from "next/image";
import { getItem, getCategories } from "@/lib/api";
import { CategoryStamp } from "@/components/CategoryStamp";
import { ItemDetailBody } from "@/components/ItemDetailBody";
import { notFound } from "next/navigation";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

export default async function ItemDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let item;
  try {
    item = await getItem(id);
  } catch {
    notFound();
  }

  const categories = await getCategories();

  return (
    <div className="max-w-2xl">
      <div className="relative bg-card border border-line rounded-sm overflow-hidden">
        <CategoryStamp name={item.category?.name ?? null} />

        {item.hasVideo ? (
          <video controls className="w-full aspect-video bg-black" poster={item.thumbnailUrl ?? undefined}>
            <source src={`${API_URL}/items/${item.id}/video`} type="video/mp4" />
            Your browser does not support video playback.
          </video>
        ) : item.thumbnailUrl ? (
          <div className="relative w-full aspect-video bg-line">
            <Image src={item.thumbnailUrl} alt="" fill className="object-cover" unoptimized />
          </div>
        ) : (
          <div className="w-full aspect-video bg-line flex items-center justify-center">
            <span className="font-mono text-xs text-muted">no thumbnail</span>
          </div>
        )}

        <ItemDetailBody item={item} categories={categories} />
      </div>
    </div>
  );
}
