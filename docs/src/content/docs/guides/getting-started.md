---
title: Getting started
description: Install the image tagger and tag your first image.
sidebar:
  order: 1
---

`@bhodgson/image-tagger` tags images from a vocabulary you define. Each category becomes a typed question for a decision model, which returns a probability for every value you allow and nothing else: it can't invent a tag. Answers that name anything outside the vocabulary are rejected.

The default backend is [Amos 1 Large](https://huggingface.co/mukaddamzaid/amos-1-large), called through its hosted API, which needs no key. Try it in the [playground](../../playground/).

Runs in Node.js 22.12 or later, and in modern browsers.

```bash
pnpm add @bhodgson/image-tagger
```

```ts
import { readFile } from "node:fs/promises";
import { AmosBackend, Tagger } from "@bhodgson/image-tagger";

const tagger = new Tagger({
  backend: new AmosBackend(),
  vocabulary: {
    people: {
      type: "single",
      question: "How many people are in the photo?",
      values: { none: null, few: "One to five people.", crowd: "A crowd." },
    },
    setting: {
      type: "multi",
      values: { beach: null, mountains: null, city: null },
    },
    night: { type: "flag", question: "Was the photo taken at night?" },
  },
});

const result = await tagger.tag({
  id: "getxo-1",
  image: { data: await readFile("getxo.jpg"), mimeType: "image/jpeg" },
  context: "Lead photo for a travel guide to Getxo, Spain.",
});

result.labels; // ["people:few", "setting:beach", "setting:city"]
result.tags.people; // { type: "single", value: "few", confidence: 0.81, probabilities: { ... } }
```

Create one `Tagger` and reuse it. Failures throw a `TaggingError`; see [Errors](../errors/).
