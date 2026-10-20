---
title: Vocabulary
description: Define the categories and values the tagger can choose from.
sidebar:
  order: 2
---

The vocabulary maps category names to categories. Category and value names use lower-case letters, digits and single hyphens, so a label such as `time-of-day:golden-hour` is never ambiguous. Each value maps to a description that tells the model what it means, or `null` when the name says enough.

| `type`   | Answers                                     | Options                                                                                   |
| -------- | ------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `single` | Exactly one value, such as `people:crowd`.  | `values` (at least two), `question`, `minConfidence` (default `0`), `allowUnlisted`.      |
| `multi`  | Any number of values.                       | `values`, `question`, `threshold` (default `0.5`) applied to each value, `allowUnlisted`. |
| `flag`   | Yes or no. Labelled with the category name. | `question` (required), `threshold` (default `0.5`).                                       |

`question` defaults to one built from the category name. Write your own when the name alone is ambiguous.

**`allowUnlisted`** is off by default, so the model must choose from your values. Turn it on to also offer "none of these fits" (`single`) or "something not listed" (`multi`). The tag then reports `unlisted`, the probability that a value is missing. A `single` category whose likeliest answer is unlisted gets no value. Amos can't name the missing value; use this to find images where the vocabulary falls short.
