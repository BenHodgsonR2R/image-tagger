# @bhodgson/image-tagger

## 0.2.0

### Minor Changes

- d5d3b91: Document every export, and describe the vocabulary with plain types: `SingleCategory`, `MultiCategory`, `FlagCategory` and `CategoryValues`, alongside `Category` and `Vocabulary`. `vocabularySchema` is now typed as a `z.ZodType` that accepts a `Vocabulary`, rather than its full Zod type. Export `TaggerLogger`.
- 5f6d028: Each `tag()` result has a `record`: the questions asked and the raw answers, as plain JSON. Add the right answers under `expected` and score the tagger with `tagger.evaluate(records)`, which reports accuracy, coverage and a confusion table for single-value categories, and precision, recall and F1 for multi-value categories and flags. The tagger's thresholds apply to the saved answers, so you can compare thresholds without calling the model again.

### Patch Changes

- 1d199ed: `AmosBackend` sends images as plain base64 instead of data URLs, which the hosted `amos-1-mini` rejected. A `backend-failure` message now includes the underlying error, such as the HTTP status and Amos's reason, instead of only "The backend request failed."
- 8810018: The package runs in browsers as well as Node.js. It no longer uses `Buffer` or `node:crypto`, and `AmosBackend` calls `fetch` in a way browsers accept: before this, every request from a browser failed with "Illegal invocation".

## 0.1.1

### Patch Changes

- 0874018: `AmosBackend` checks that every single- and multi-value category has 2 to 255 options, counting the none-of-these option that `allowUnlisted` adds, and throws `invalid-configuration` before sending. Amos rejects anything else, which surfaced as a vague `backend-failure`. A multi-value category with one value now fails clearly too; use a flag instead.
