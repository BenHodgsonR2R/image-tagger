---
"@bhodgson/image-tagger": minor
---

Document every export, and describe the vocabulary with plain types: `SingleCategory`, `MultiCategory`, `FlagCategory` and `CategoryValues`, alongside `Category` and `Vocabulary`. `vocabularySchema` is now typed as a `z.ZodType` that accepts a `Vocabulary`, rather than its full Zod type. Export `TaggerLogger`.
