import { Category } from "./types";

export interface FlatCategoryOption {
  id: string;
  label: string;
}

export function flattenCategories(categories: Category[]): FlatCategoryOption[] {
  const out: FlatCategoryOption[] = [];
  for (const parent of categories) {
    out.push({ id: parent.id, label: parent.name });
    for (const child of parent.children) {
      out.push({ id: child.id, label: `${parent.name} › ${child.name}` });
    }
  }
  return out;
}
