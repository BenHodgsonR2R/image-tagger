---
"@bhodgson/image-tagger": minor
---

Each `tag()` result has a `record`: the questions asked and the raw answers, as plain JSON. Add the right answers under `expected` and score the tagger with `tagger.evaluate(records)`, which reports accuracy, coverage and a confusion table for single-value categories, and precision, recall and F1 for multi-value categories and flags. The tagger's thresholds apply to the saved answers, so you can compare thresholds without calling the model again.
