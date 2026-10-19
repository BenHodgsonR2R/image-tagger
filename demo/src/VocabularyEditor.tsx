import { useState } from "preact/hooks";
import {
  Button,
  Field,
  Input,
  Message,
  Panel,
  Select,
  TextArea,
} from "@bhodgson/design-system";
import {
  type CategoryDraft,
  type CategoryType,
  fromVocabulary,
  newCategory,
  newValue,
  matchingStartingPoint,
  parseVocabulary,
  startingPoints,
  toTagName,
  toVocabulary,
  type ValueDraft,
} from "./vocabulary.ts";

type Props = {
  drafts: readonly CategoryDraft[];
  onChange: (drafts: CategoryDraft[]) => void;
  problems: readonly string[];
  todo: readonly string[];
};

export function VocabularyEditor({ drafts, onChange, problems, todo }: Props) {
  const [json, setJson] = useState<string>();
  const [jsonError, setJsonError] = useState<string>();
  const [copied, setCopied] = useState(false);

  // The URL already carries the tags, so sharing is copying it.
  const copyLink = async () => {
    await navigator.clipboard.writeText(location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const update = (id: number, change: Partial<CategoryDraft>) =>
    onChange(
      drafts.map((draft) =>
        draft.id === id ? { ...draft, ...change } : draft,
      ),
    );

  const applyJson = () => {
    const parsed = parseVocabulary(json ?? "");
    if (parsed.error !== undefined) {
      setJsonError(parsed.error);
      return;
    }
    onChange(fromVocabulary(parsed.vocabulary));
    setJson(undefined);
    setJsonError(undefined);
  };

  const startingPoint = matchingStartingPoint(drafts);

  const startFrom = (name: string, build: () => CategoryDraft[]) => {
    if (
      startingPoint === undefined &&
      !confirm(`Replace your tags with “${name}”? Your changes will be lost.`)
    ) {
      return;
    }
    onChange(build());
    setJson(undefined);
    setJsonError(undefined);
  };

  return (
    <Panel
      id="vocabulary-heading"
      title="1. Define your tags"
      actions={
        <>
          <Button variant="secondary" onClick={() => void copyLink()}>
            {copied ? "Link copied" : "Copy link to these tags"}
          </Button>
          <Button
            variant="secondary"
            onClick={() =>
              setJson(
                json === undefined
                  ? JSON.stringify(toVocabulary(drafts), null, 2)
                  : undefined,
              )
            }
          >
            {json === undefined ? "Edit as JSON" : "Back to the form"}
          </Button>
        </>
      }
    >
      <p class="mb-3 text-sm text-muted">
        The model can only answer with the tags you define here. It returns a
        probability for every value, and never invents a tag.
      </p>

      <div
        class="mb-3 flex flex-wrap items-center gap-2"
        role="group"
        aria-label="Start from"
      >
        <span class="text-sm text-muted">Start from:</span>
        {startingPoints.map(({ name, build }) => (
          <Button
            key={name}
            variant={startingPoint?.name === name ? "primary" : "secondary"}
            aria-pressed={startingPoint?.name === name}
            onClick={() => startFrom(name, build)}
          >
            {name}
          </Button>
        ))}
      </div>

      {json === undefined ? (
        <>
          {drafts.map((draft) => (
            <CategoryCard
              key={draft.id}
              draft={draft}
              onChange={(change) => update(draft.id, change)}
              onRemove={() =>
                onChange(drafts.filter(({ id }) => id !== draft.id))
              }
            />
          ))}
          <Button
            variant="secondary"
            class="w-full"
            onClick={() => onChange([...drafts, newCategory()])}
          >
            Add a category
          </Button>
        </>
      ) : (
        <div class="flex flex-col gap-2">
          <TextArea
            class="min-h-96 font-mono text-xs"
            aria-label="Vocabulary as JSON"
            spellcheck={false}
            value={json}
            onInput={(event) => setJson(event.currentTarget.value)}
          />
          {jsonError !== undefined && (
            <Message tone="error">{jsonError}</Message>
          )}
          <Button class="self-start" onClick={applyJson}>
            Apply JSON
          </Button>
        </div>
      )}

      {problems.length > 0 && (
        <Message tone="error" class="mt-3">
          {problems.map((problem) => (
            <p key={problem}>{problem}</p>
          ))}
        </Message>
      )}
      {todo.length > 0 && (
        <Message tone="notice" class="mt-3">
          <p>To finish your tags:</p>
          <ul class="list-disc pl-5">
            {todo.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </Message>
      )}
    </Panel>
  );
}

const typeLabels: Record<CategoryType, string> = {
  single: "One value",
  multi: "Any number of values",
  flag: "Yes or no",
};

function isCategoryType(value: string): value is CategoryType {
  return Object.hasOwn(typeLabels, value);
}

type CardProps = {
  draft: CategoryDraft;
  onChange: (change: Partial<CategoryDraft>) => void;
  onRemove: () => void;
};

function CategoryCard({ draft, onChange, onRemove }: CardProps) {
  const updateValue = (id: number, change: Partial<ValueDraft>) =>
    onChange({
      values: draft.values.map((value) =>
        value.id === id ? { ...value, ...change } : value,
      ),
    });

  const changeType = (type: CategoryType) =>
    onChange({
      type,
      threshold: type === "single" ? 0 : 0.5,
      values:
        type !== "flag" && draft.values.length === 0
          ? [newValue(), newValue()]
          : draft.values,
    });

  return (
    <fieldset class="mb-3 flex flex-col gap-2.5 rounded-xl border border-line p-3">
      <legend class="sr-only">{draft.name || "New category"}</legend>
      <div class="flex flex-wrap items-end gap-2">
        <Field label="Category" class="flex-1 basis-40">
          <Input
            class="font-mono"
            value={draft.name}
            placeholder="e.g. people"
            onInput={(event) =>
              onChange({ name: toTagName(event.currentTarget.value) })
            }
          />
        </Field>
        <Field label="Answer">
          <Select
            value={draft.type}
            onChange={(event) => {
              const type = event.currentTarget.value;
              if (isCategoryType(type)) {
                changeType(type);
              }
            }}
          >
            {Object.entries(typeLabels).map(([type, label]) => (
              <option key={type} value={type}>
                {label}
              </option>
            ))}
          </Select>
        </Field>
        <Button
          variant="icon"
          aria-label={`Remove ${draft.name || "this category"}`}
          onClick={onRemove}
        >
          ×
        </Button>
      </div>

      <Field label="Question">
        <Input
          value={draft.question}
          placeholder={
            draft.type === "flag"
              ? "Required, e.g. Was the photo taken at night?"
              : "Optional. Built from the category name when empty."
          }
          onInput={(event) => onChange({ question: event.currentTarget.value })}
        />
      </Field>

      {draft.type !== "flag" && (
        <div class="flex flex-col gap-1.5">
          <span class="text-xs font-semibold text-muted">Values</span>
          {draft.values.map((value) => (
            <div class="flex flex-wrap gap-2" key={value.id}>
              <Input
                class="w-36 font-mono"
                aria-label="Value"
                value={value.name}
                placeholder="value"
                onInput={(event) =>
                  updateValue(value.id, {
                    name: toTagName(event.currentTarget.value),
                  })
                }
              />
              <Input
                class="flex-1 basis-40"
                aria-label="Description"
                value={value.description}
                placeholder="Description (optional)"
                onInput={(event) =>
                  updateValue(value.id, {
                    description: event.currentTarget.value,
                  })
                }
              />
              <Button
                variant="icon"
                aria-label={`Remove ${value.name || "this value"}`}
                onClick={() =>
                  onChange({
                    values: draft.values.filter(({ id }) => id !== value.id),
                  })
                }
              >
                ×
              </Button>
            </div>
          ))}
          <Button
            variant="link"
            onClick={() => onChange({ values: [...draft.values, newValue()] })}
          >
            Add a value
          </Button>
        </div>
      )}

      <div class="flex flex-wrap items-end gap-3">
        <Field
          class="flex-1 basis-48"
          label={
            draft.type === "single"
              ? "Minimum confidence"
              : "Apply a tag at probability"
          }
        >
          <span class="flex h-control items-center gap-2">
            <input
              class="flex-1 accent-accent"
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={draft.threshold}
              onInput={(event) =>
                onChange({ threshold: Number(event.currentTarget.value) })
              }
            />
            <output class="text-sm text-ink tabular-nums">
              {draft.threshold.toFixed(2)}
            </output>
          </span>
        </Field>
        {draft.type !== "flag" && (
          <label class="flex h-control items-center gap-1.5 text-sm">
            <input
              class="accent-accent"
              type="checkbox"
              checked={draft.allowUnlisted}
              onChange={(event) =>
                onChange({ allowUnlisted: event.currentTarget.checked })
              }
            />
            Allow “none of these”
          </label>
        )}
      </div>
    </fieldset>
  );
}
