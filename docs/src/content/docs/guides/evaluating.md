---
title: Evaluating
description: Score the tagger against the answers you expect.
sidebar:
  order: 4
---

`record` is plain JSON with the questions asked and the raw answers. Save records, add the right answers under `expected`, and score the tagger against them. Its thresholds apply to the saved answers, so you can try others without calling the model again.

```ts
const record = {
  ...result.record,
  expected: { people: "crowd", setting: ["beach"], night: false },
};
const evaluation = tagger.evaluate([record]);

evaluation.categories.people; // { accuracy, coverage, confusion, ... }
```
