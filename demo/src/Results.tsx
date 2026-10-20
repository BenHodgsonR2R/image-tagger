import type { Tag, TaggingResult } from "@bhodgson/image-tagger";
import { Badge, Button } from "@bhodgson/design-system";
import { type CategoryTone, faintBarClass, swatchClass } from "./tones.ts";

export type ImageItem = {
  id: number;
  name: string;
  previewUrl: string;
  data: Uint8Array;
  status: "ready" | "tagging" | "done" | "failed";
  result?: TaggingResult;
  error?: string;
  seconds?: number;
};

type Props = {
  image: ImageItem;
  thresholds: Readonly<Record<string, number>>;
  tones: Readonly<Record<string, CategoryTone>>;
  onRemove: () => void;
};

export function ImageResult({ image, thresholds, tones, onRemove }: Props) {
  return (
    <article class="grid gap-3 border-t border-line pt-3 sm:grid-cols-[7.5rem_minmax(0,1fr)]">
      <div class="relative">
        <img
          class="h-44 w-full rounded-md object-cover sm:h-24 sm:w-30"
          src={image.previewUrl}
          alt={image.name}
        />
        <Button
          variant="icon"
          size="sm"
          class="absolute top-1 right-1 bg-surface"
          aria-label={`Remove ${image.name}`}
          onClick={onRemove}
        >
          ×
        </Button>
      </div>
      <div class="min-w-0">
        <p class="truncate font-semibold" title={image.name}>
          {image.name}
        </p>
        <Status image={image} />
        {image.result !== undefined && (
          <>
            <ul class="my-1.5 flex flex-wrap gap-1.5" aria-label="Tags applied">
              {image.result.labels.length === 0 ? (
                <li class="text-sm text-muted">No tags applied</li>
              ) : (
                image.result.labels.map((label) => (
                  <li key={label}>
                    <Badge tone={tones[label.split(":")[0] ?? ""] ?? "neutral"}>
                      {label}
                    </Badge>
                  </li>
                ))
              )}
            </ul>
            <details>
              <summary class="cursor-pointer text-sm font-semibold text-link">
                Probabilities
              </summary>
              {Object.entries(image.result.tags).map(([name, tag]) => (
                <TagBars
                  key={name}
                  name={name}
                  tag={tag}
                  tone={tones[name] ?? "data-1"}
                  threshold={thresholds[name] ?? 0.5}
                />
              ))}
            </details>
          </>
        )}
      </div>
    </article>
  );
}

function Status({ image }: { image: ImageItem }) {
  switch (image.status) {
    case "ready":
      return <p class="text-sm text-muted">Ready to tag</p>;
    case "tagging":
      return <p class="text-sm text-muted">Tagging…</p>;
    case "failed":
      return <p class="text-sm text-danger">{image.error}</p>;
    default:
      return (
        <p class="text-sm text-muted">
          {image.result?.modelVersion} · {image.seconds?.toFixed(1)} s
        </p>
      );
  }
}

function TagBars({
  name,
  tag,
  tone,
  threshold,
}: {
  name: string;
  tag: Tag;
  tone: CategoryTone;
  threshold: number;
}) {
  return (
    <div class="mt-3">
      <h3 class="mb-1 flex items-center gap-1.5 font-mono text-sm font-semibold">
        <span
          aria-hidden="true"
          class={`size-2.5 rounded-sm ${swatchClass[tone]}`}
        />
        {name}
      </h3>
      {barRows(tag).map(({ label, probability, applied }) => (
        <div
          key={label}
          class={`grid grid-cols-[minmax(4.5rem,7.5rem)_minmax(0,1fr)_2.25rem] items-center gap-2 font-mono text-xs ${applied ? "font-semibold text-ink" : "text-muted"}`}
        >
          <span class="truncate">{label}</span>
          <span
            class="relative h-2 rounded bg-canvas"
            role="meter"
            aria-label={label}
            aria-valuemin={0}
            aria-valuemax={1}
            aria-valuenow={probability}
          >
            <span
              class={`absolute inset-y-0 left-0 rounded ${applied ? swatchClass[tone] : faintBarClass[tone]}`}
              style={{ width: `${probability * 100}%` }}
            />
            {threshold > 0 && (
              <span
                class="absolute -inset-y-1 w-0.5 bg-ink/50"
                style={{ left: `${threshold * 100}%` }}
                title={`Threshold ${threshold.toFixed(2)}`}
              />
            )}
          </span>
          <span class="text-right tabular-nums">{probability.toFixed(2)}</span>
        </div>
      ))}
    </div>
  );
}

type BarRow = { label: string; probability: number; applied: boolean };

function barRows(tag: Tag): BarRow[] {
  if (tag.type === "flag") {
    return [{ label: "yes", probability: tag.probability, applied: tag.value }];
  }

  const applied = (value: string) =>
    tag.type === "single" ? tag.value === value : tag.values.includes(value);
  const rows = Object.entries(tag.probabilities)
    .map(([value, probability]) => ({
      label: value,
      probability,
      applied: applied(value),
    }))
    .toSorted((a, b) => b.probability - a.probability);

  return tag.unlisted === undefined
    ? rows
    : [
        ...rows,
        {
          label: tag.type === "single" ? "none of these" : "something else",
          probability: tag.unlisted,
          applied: false,
        },
      ];
}
