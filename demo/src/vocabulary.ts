import {
  type Category,
  type Vocabulary,
  vocabularySchema,
} from "@bhodgson/image-tagger";

export type CategoryType = "single" | "multi" | "flag";

export type ValueDraft = { id: number; name: string; description: string };

export type CategoryDraft = {
  id: number;
  name: string;
  type: CategoryType;
  question: string;
  values: ValueDraft[];
  /** `minConfidence` for a single-value category, otherwise `threshold`. */
  threshold: number;
  allowUnlisted: boolean;
};

let lastId = 0;
export const nextId = () => ++lastId;

/** Lower-case letters, digits and single hyphens, as the vocabulary requires. */
export function toTagName(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+/, "");
}

export function newValue(name = ""): ValueDraft {
  return { id: nextId(), name, description: "" };
}

export function newCategory(): CategoryDraft {
  return {
    id: nextId(),
    name: "",
    type: "single",
    question: "",
    values: [newValue(), newValue()],
    threshold: 0,
    allowUnlisted: false,
  };
}

export function toVocabulary(drafts: readonly CategoryDraft[]): Vocabulary {
  return Object.fromEntries(
    drafts.map((draft) => [draft.name, toCategory(draft)]),
  );
}

function toCategory(draft: CategoryDraft): Category {
  const question = draft.question.trim() || undefined;

  if (draft.type === "flag") {
    return {
      type: "flag",
      question: question ?? "",
      threshold: draft.threshold,
    };
  }

  const values = Object.fromEntries(
    draft.values.map((value) => [value.name, value.description.trim() || null]),
  );
  if (draft.type === "multi") {
    return {
      type: "multi",
      question,
      values,
      threshold: draft.threshold,
      allowUnlisted: draft.allowUnlisted,
    };
  }
  return {
    type: "single",
    question,
    values,
    minConfidence: draft.threshold,
    allowUnlisted: draft.allowUnlisted,
  };
}

export function fromVocabulary(vocabulary: Vocabulary): CategoryDraft[] {
  return Object.entries(vocabulary).map(([name, category]) => {
    const base = {
      id: nextId(),
      name,
      type: category.type,
      question: category.question ?? "",
    };

    if (category.type === "flag") {
      return {
        ...base,
        values: [],
        threshold: category.threshold ?? 0.5,
        allowUnlisted: false,
      };
    }

    return {
      ...base,
      values: Object.entries(category.values).map(([value, description]) => ({
        ...newValue(value),
        description: description ?? "",
      })),
      threshold:
        category.type === "single"
          ? (category.minConfidence ?? 0)
          : (category.threshold ?? 0.5),
      allowUnlisted: category.allowUnlisted ?? false,
    };
  });
}

/** Whether a category still has a field to fill in. */
export function isUnfinished(draft: CategoryDraft): boolean {
  if (draft.name === "") {
    return true;
  }
  if (draft.type === "flag") {
    return draft.question.trim() === "";
  }
  return draft.values.some(({ name }) => name === "");
}

/** Fields still to fill in. Not mistakes, so they're shown as a to-do, not an error. */
export function unfinishedFields(drafts: readonly CategoryDraft[]): string[] {
  if (drafts.length === 0) {
    return ["Add a category."];
  }

  const todo: string[] = [];
  for (const [index, draft] of drafts.entries()) {
    const label = draft.name || `Category ${index + 1}`;
    if (draft.name === "") {
      todo.push(`Name category ${index + 1}.`);
    }
    if (draft.type === "flag" && draft.question.trim() === "") {
      todo.push(`Write the yes/no question for ${label}.`);
    }
    if (draft.type !== "flag" && draft.values.some(({ name }) => name === "")) {
      todo.push(`Name every value in ${label}.`);
    }
  }
  return todo;
}

/** Mistakes the library can't report, because they're lost when drafts become an object. */
export function draftProblems(drafts: readonly CategoryDraft[]): string[] {
  const problems = duplicates(drafts.map(({ name }) => name)).map(
    (name) => `Two categories are called "${name}".`,
  );
  for (const draft of drafts) {
    if (draft.type === "flag") {
      continue;
    }
    for (const value of duplicates(draft.values.map(({ name }) => name))) {
      problems.push(`"${draft.name}" has two values called "${value}".`);
    }
  }
  return problems;
}

// Empty names are unfinished, not duplicates.
function duplicates(names: readonly string[]): string[] {
  const seen = new Set<string>();
  const repeated = new Set<string>();
  for (const name of names.filter(Boolean)) {
    if (seen.has(name)) {
      repeated.add(name);
    }
    seen.add(name);
  }
  return [...repeated];
}

export const presets: Readonly<Record<string, Vocabulary>> = {
  "Travel photo": {
    people: {
      type: "single",
      question: "How many people are in the photo?",
      values: {
        none: "No people.",
        few: "One to five people.",
        crowd: "Six or more people, or a crowd.",
      },
    },
    setting: {
      type: "multi",
      question: "Which of these settings does the photo show?",
      values: {
        beach: null,
        mountains: null,
        city: null,
        countryside: null,
        lake: null,
      },
      allowUnlisted: true,
    },
    "time-of-day": {
      type: "single",
      question: "When was the photo taken?",
      values: {
        day: null,
        "golden-hour": "Sunrise or sunset light.",
        night: null,
      },
      minConfidence: 0.5,
    },
    "text-overlay": {
      type: "flag",
      question: "Does the photo have a watermark, caption or other added text?",
    },
  },
  "Property listing": {
    room: {
      type: "single",
      question: "Which room or space does the photo show?",
      values: {
        kitchen: null,
        bedroom: null,
        bathroom: null,
        "living-room": null,
        exterior: "The outside of the building.",
      },
      allowUnlisted: true,
    },
    features: {
      type: "multi",
      question: "Which of these features are visible?",
      values: {
        pool: null,
        garden: null,
        view: "A scenic view from a window or balcony.",
        fireplace: null,
      },
    },
    tidy: { type: "flag", question: "Is the space tidy and uncluttered?" },
  },
};

export const defaultPreset = "Travel photo";

// The vocabulary rides in the URL fragment as base64url JSON, so a link shares a setup.
export function toFragment(vocabulary: Vocabulary): string {
  const bytes = new TextEncoder().encode(JSON.stringify(vocabulary));
  const binary = Array.from(bytes, (byte) => String.fromCharCode(byte)).join(
    "",
  );
  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");
}

export function fromFragment(fragment: string): Vocabulary | undefined {
  try {
    const binary = atob(fragment.replaceAll("-", "+").replaceAll("_", "/"));
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    return parseVocabulary(new TextDecoder().decode(bytes)).vocabulary;
  } catch {
    return undefined;
  }
}

export type ParsedVocabulary =
  | { vocabulary: Vocabulary; error?: undefined }
  | { vocabulary?: undefined; error: string };

export function parseVocabulary(json: string): ParsedVocabulary {
  let value: unknown;
  try {
    value = JSON.parse(json);
  } catch (error) {
    return {
      error: `Not valid JSON: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
  const result = vocabularySchema.safeParse(value);
  return result.success
    ? { vocabulary: result.data }
    : {
        error:
          "That isn't a valid vocabulary. Check the category types and values.",
      };
}

function vocabularyKey(drafts: readonly CategoryDraft[]): string {
  return JSON.stringify(toVocabulary(drafts));
}

export const startingPoints = [
  ...Object.entries(presets).map(([name, vocabulary]) => ({
    name,
    build: () => fromVocabulary(vocabulary),
  })),
  { name: "Blank", build: () => [newCategory()] },
].map((point) => ({ ...point, key: vocabularyKey(point.build()) }));

/** The starting point these drafts still match exactly, if any. */
export function matchingStartingPoint(drafts: readonly CategoryDraft[]) {
  const key = vocabularyKey(drafts);
  return startingPoints.find((point) => point.key === key);
}
