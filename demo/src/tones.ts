import { dataTone } from "@bhodgson/design-system";

export type CategoryTone = ReturnType<typeof dataTone>;

/** Each category's colour, from its place in the vocabulary. */
export function categoryTones(
  names: readonly string[],
): Record<string, CategoryTone> {
  return Object.fromEntries(
    names.map((name, index) => [name, dataTone(index)]),
  );
}

// Whole class names, so Tailwind finds them.
export const swatchClass: Record<CategoryTone, string> = {
  "data-1": "bg-data-1",
  "data-2": "bg-data-2",
  "data-3": "bg-data-3",
  "data-4": "bg-data-4",
  "data-5": "bg-data-5",
  "data-6": "bg-data-6",
};

export const faintBarClass: Record<CategoryTone, string> = {
  "data-1": "bg-data-1/35",
  "data-2": "bg-data-2/35",
  "data-3": "bg-data-3/35",
  "data-4": "bg-data-4/35",
  "data-5": "bg-data-5/35",
  "data-6": "bg-data-6/35",
};
