import {
  AmosBackend,
  defaultAmosModel,
  Tagger,
  TaggingError,
} from "@bhodgson/image-tagger";
import {
  Button,
  Field,
  Input,
  Link,
  Message,
  Page,
  Panel,
  Select,
} from "@bhodgson/design-system";
import { useEffect, useMemo, useState } from "preact/hooks";
import { maxImages, prepareImage } from "./images.ts";
import { type ImageItem, ImageResult } from "./Results.tsx";
import { categoryTones } from "./tones.ts";
import { SampleGallery } from "./SampleGallery.tsx";
import { samples } from "./samples.ts";
import { VocabularyEditor } from "./VocabularyEditor.tsx";
import {
  type CategoryDraft,
  defaultPreset,
  draftProblems,
  fromFragment,
  fromVocabulary,
  matchingStartingPoint,
  nextId,
  presets,
  toFragment,
  toVocabulary,
  unfinishedFields,
} from "./vocabulary.ts";

const models = ["amos-1-large", "amos-1-medium", "amos-1-small", "amos-1-mini"];
const fragmentPrefix = "#v=";

function initialDrafts(): CategoryDraft[] {
  const shared = location.hash.startsWith(fragmentPrefix)
    ? fromFragment(location.hash.slice(fragmentPrefix.length))
    : undefined;
  return fromVocabulary(shared ?? presets[defaultPreset] ?? {});
}

export function App() {
  const [drafts, setDrafts] = useState(initialDrafts);
  const [model, setModel] = useState(defaultAmosModel);
  const [context, setContext] = useState("");
  const [images, setImages] = useState<ImageItem[]>([]);
  const [running, setRunning] = useState(false);
  const [notice, setNotice] = useState<string>();
  const [lastRun, setLastRun] = useState<string>();

  const fragment = useMemo(() => toFragment(toVocabulary(drafts)), [drafts]);
  const runKey = `${model}|${context}|${fragment}`;

  useEffect(() => {
    history.replaceState(null, "", fragmentPrefix + fragment);
  }, [fragment]);

  const setup = useMemo(() => {
    const problems = draftProblems(drafts);
    const todo = unfinishedFields(drafts);
    if (problems.length > 0 || todo.length > 0) {
      return { problems, todo };
    }
    try {
      const tagger = new Tagger({
        backend: new AmosBackend({ model }),
        vocabulary: toVocabulary(drafts),
      });
      return { tagger, problems, todo };
    } catch (error) {
      if (error instanceof TaggingError) {
        return { problems: [error.message], todo };
      }
      throw error;
    }
  }, [drafts, model]);

  const thresholds = Object.fromEntries(
    drafts.map((draft) => [draft.name, draft.threshold]),
  );
  const tones = categoryTones(drafts.map((draft) => draft.name));

  const addFiles = async (files: readonly File[]) => {
    const room = maxImages - images.length;
    const chosen = files.filter((file) => file.type.startsWith("image/"));
    setNotice(
      chosen.length > room
        ? `The playground tags up to ${maxImages} images at a time.`
        : undefined,
    );

    for (const file of chosen.slice(0, room)) {
      try {
        const { data, previewUrl } = await prepareImage(file);
        setImages((current) => [
          ...current,
          { id: nextId(), name: file.name, data, previewUrl, status: "ready" },
        ]);
      } catch {
        setNotice(`Couldn't read ${file.name}. Try a JPEG, PNG or WebP image.`);
      }
    }
  };

  const updateImage = (id: number, change: Partial<ImageItem>) =>
    setImages((current) =>
      current.map((image) =>
        image.id === id ? { ...image, ...change } : image,
      ),
    );

  const removeImage = (image: ImageItem) => {
    URL.revokeObjectURL(image.previewUrl);
    setImages((current) => current.filter(({ id }) => id !== image.id));
  };

  const tagAll = async () => {
    const { tagger } = setup;
    if (tagger === undefined) {
      return;
    }
    setRunning(true);
    setLastRun(runKey);
    // One at a time, to go easy on a free, shared API.
    for (const image of images) {
      updateImage(image.id, { status: "tagging", error: undefined });
      const started = performance.now();
      try {
        const result = await tagger.tag({
          id: image.name,
          image: { data: image.data, mimeType: "image/jpeg" },
          context: context || undefined,
        });
        updateImage(image.id, {
          status: "done",
          result,
          seconds: (performance.now() - started) / 1000,
        });
      } catch (error) {
        updateImage(image.id, {
          status: "failed",
          result: undefined,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
    setRunning(false);
  };

  const downloadRecords = () => {
    const lines = images.flatMap(({ result }) =>
      result === undefined ? [] : [JSON.stringify(result.record)],
    );
    const url = URL.createObjectURL(
      new Blob([lines.join("\n") + "\n"], { type: "application/x-ndjson" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "records.jsonl";
    link.click();
    URL.revokeObjectURL(url);
  };

  const tagged = images.some(({ status }) => status === "done");
  const stale = tagged && !running && lastRun !== runKey;
  const tagHint = whyNotReady(setup.tagger !== undefined, images.length);

  return (
    <Page
      eyebrow="playground"
      project="image-tagger"
      title="@bhodgson/image-tagger"
      description={
        <>
          Define your own tags, add some images, and see how the{" "}
          <Link href="https://huggingface.co/mukaddamzaid/amos-1-large">
            Amos
          </Link>{" "}
          decision model tags them. Built with{" "}
          <Link href="https://benhodgsonr2r.github.io/image-tagger/">
            @bhodgson/image-tagger
          </Link>
          .
        </>
      }
      footer={<SampleCredits />}
    >
      <div class="grid grid-cols-1 items-start gap-4 md:grid-cols-5">
        <div class="md:col-span-2">
          <VocabularyEditor
            drafts={drafts}
            onChange={setDrafts}
            problems={setup.problems}
            todo={setup.todo}
          />
        </div>

        <div class="md:col-span-3">
          <Panel id="images-heading" title="2. Add images">
            <p class="mb-2 text-sm text-muted">
              Images you add are resized in your browser, then sent straight to
              Amos's hosted API, a third-party service with its own{" "}
              <Link href="https://amos.scira.ai/privacy/">privacy policy</Link>.
              This site has no server and stores nothing. Don't add private
              photos.
            </p>
            <label
              class="mb-3 block cursor-pointer rounded-xl border-2 border-dashed border-line p-5 text-center text-sm font-medium text-muted hover:border-accent"
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                void addFiles(Array.from(event.dataTransfer?.files ?? []));
              }}
            >
              <input
                class="sr-only"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                onChange={(event) => {
                  void addFiles(Array.from(event.currentTarget.files ?? []));
                  event.currentTarget.value = "";
                }}
              />
              Drop images here or <u>choose files</u>. Up to {maxImages}.
            </label>
            <SampleGallery
              suggestedTheme={matchingStartingPoint(drafts)?.name}
              added={new Set(images.map(({ name }) => name))}
              onAdd={addFiles}
              onError={setNotice}
            />

            <h3 class="mt-4 mb-2 font-semibold">3. Tag your images</h3>
            <div class="flex flex-wrap items-end gap-2">
              <Field label="Model">
                <Select
                  value={model}
                  onChange={(event) => setModel(event.currentTarget.value)}
                >
                  {models.map((name) => (
                    <option key={name}>{name}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Context (optional)" class="flex-1 basis-48">
                <Input
                  value={context}
                  placeholder="e.g. Lead photo for a travel guide to Lisbon"
                  onInput={(event) => setContext(event.currentTarget.value)}
                />
              </Field>
            </div>

            <div class="mt-3 flex flex-wrap items-center gap-2">
              <Button
                disabled={running || tagHint !== undefined}
                onClick={() => void tagAll()}
              >
                {running ? "Tagging…" : tagButtonLabel(images.length)}
              </Button>
              {tagged && (
                <Button variant="secondary" onClick={downloadRecords}>
                  Download records
                </Button>
              )}
            </div>
            {tagHint !== undefined && (
              <p class="mt-1 text-sm text-muted">{tagHint}</p>
            )}

            {notice !== undefined && (
              <Message tone="notice" class="mt-3">
                {notice}
              </Message>
            )}
            {stale && (
              <Message tone="notice" class="mt-3">
                Your tags, model or context changed since the last run. Tag the
                images again to update the results.
              </Message>
            )}

            <div class="mt-3 flex flex-col gap-3">
              {images.length === 0 && (
                <p class="rounded-md border border-dashed border-line p-4 text-center text-sm text-muted">
                  No images yet. Drop your own above or click a sample, then tag
                  them.
                </p>
              )}
              {images.map((image) => (
                <ImageResult
                  key={image.id}
                  image={image}
                  thresholds={thresholds}
                  tones={tones}
                  onRemove={() => removeImage(image)}
                />
              ))}
            </div>
          </Panel>
        </div>
      </div>
    </Page>
  );
}

function SampleCredits() {
  return (
    <details>
      <summary class="cursor-pointer">Sample image credits</summary>
      <p class="my-2">
        Resized from the originals. The CC BY photos are from the{" "}
        <Link href="https://cocodataset.org">COCO dataset</Link>.
      </p>
      <ul class="list-disc space-y-1 pl-5">
        {samples.map((sample) => (
          <li key={sample.file}>
            <Link href={sample.source}>“{sample.title}”</Link> by{" "}
            {sample.author},{" "}
            <Link href={sample.licenseUrl}>{sample.license}</Link>
          </li>
        ))}
      </ul>
    </details>
  );
}

function tagButtonLabel(count: number): string {
  if (count === 0) {
    return "Tag images";
  }
  return count === 1 ? "Tag 1 image" : `Tag ${count} images`;
}

function whyNotReady(tagsReady: boolean, imageCount: number) {
  if (!tagsReady) {
    return "Finish your tags in step 1 first.";
  }
  if (imageCount === 0) {
    return "Add at least one image in step 2, then tag.";
  }
  return undefined;
}
