---
"@bhodgson/image-tagger": patch
---

`AmosBackend` checks that every single- and multi-value category has 2 to 255 options, counting the none-of-these option that `allowUnlisted` adds, and throws `invalid-configuration` before sending. Amos rejects anything else, which surfaced as a vague `backend-failure`. A multi-value category with one value now fails clearly too; use a flag instead.
