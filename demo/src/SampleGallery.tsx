import { useEffect, useState } from "preact/hooks";
import { loadSample, samples, sampleThemes } from "./samples.ts";
import { Button } from "@bhodgson/design-system";

type Props = {
  /** The theme to show first, usually the preset the tags started from. */
  suggestedTheme?: string;
  added: ReadonlySet<string>;
  onAdd: (files: File[]) => Promise<void>;
  onError: (message: string) => void;
};

export function SampleGallery({
  suggestedTheme,
  added,
  onAdd,
  onError,
}: Props) {
  const [theme, setTheme] = useState(suggestedTheme ?? sampleThemes[0]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (suggestedTheme !== undefined && sampleThemes.includes(suggestedTheme)) {
      setTheme(suggestedTheme);
    }
  }, [suggestedTheme]);

  const shown = samples.filter((sample) => sample.theme === theme);
  const notAdded = shown.filter(({ file }) => !added.has(file));

  const add = async (files: readonly string[]) => {
    setLoading(true);
    try {
      await onAdd(await Promise.all(files.map(loadSample)));
    } catch (error) {
      onError(error instanceof Error ? error.message : String(error));
    } finally {
      setLoading(false);
    }
  };

  return (
    <section class="mb-3" aria-labelledby="samples-heading">
      <div class="mb-2 flex flex-wrap items-center gap-2">
        <h3 id="samples-heading" class="text-sm font-semibold text-muted">
          Or try a sample:
        </h3>
        {sampleThemes.map((name) => (
          <Button
            key={name}
            variant={name === theme ? "primary" : "secondary"}
            aria-pressed={name === theme}
            onClick={() => setTheme(name)}
          >
            {name}
          </Button>
        ))}
        <Button
          variant="link"
          class="ml-auto"
          disabled={loading || notAdded.length === 0}
          onClick={() => void add(notAdded.map(({ file }) => file))}
        >
          Add all
        </Button>
      </div>
      <ul class="grid grid-cols-3 gap-2 sm:grid-cols-5">
        {shown.map((sample) => {
          const isAdded = added.has(sample.file);
          const credit = `“${sample.title}” by ${sample.author}, ${sample.license}`;
          return (
            <li key={sample.file}>
              <button
                type="button"
                class="group relative block w-full overflow-hidden rounded-md focus-visible:outline-2 focus-visible:outline-link disabled:cursor-default"
                title={isAdded ? `Added. ${credit}` : `Add. ${credit}`}
                aria-label={`${isAdded ? "Added" : "Add"} ${sample.title}`}
                aria-pressed={isAdded}
                disabled={loading || isAdded}
                onClick={() => void add([sample.file])}
              >
                <img
                  class={`aspect-square w-full object-cover transition group-enabled:group-hover:opacity-80 ${isAdded ? "opacity-40" : ""}`}
                  src={`samples/${sample.file}`}
                  alt=""
                  loading="lazy"
                />
                {isAdded && (
                  <span class="absolute inset-0 grid place-items-center text-2xl font-bold text-ink">
                    ✓
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
