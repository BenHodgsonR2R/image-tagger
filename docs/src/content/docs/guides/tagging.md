---
title: Tagging images
description: Requests, results and options.
sidebar:
  order: 3
---

`tagger.tag(request)` tags one image and returns `{ id, tags, labels, modelVersion, record }`.

| Field        | Description                                                                    |
| ------------ | ------------------------------------------------------------------------------ |
| `image`      | Required. `{ data, mimeType }` with `image/jpeg`, `image/png` or `image/webp`. |
| `context`    | What the image is and what it's for. Helps with ambiguous values.              |
| `categories` | Tag only these categories. Defaults to all of them.                            |
| `id`         | Your identifier for the image. Returned on the result and in error details.    |
