---
title: Errors
description: What each error code means.
sidebar:
  order: 6
---

`TaggingError` has a `code`, and `details` with the request `id` and `model`.

| `code`                  | Meaning                                                                                                     |
| ----------------------- | ----------------------------------------------------------------------------------------------------------- |
| `invalid-configuration` | Invalid vocabulary, backend options or `categories`.                                                        |
| `invalid-image`         | Unsupported image type, or an empty image. Nothing is sent.                                                 |
| `request-too-large`     | The request is over `maxRequestBytes`. Send a smaller image.                                                |
| `backend-failure`       | The request failed after retries. The original error is `error.cause`.                                      |
| `invalid-response`      | The answers don't match the questions, such as a value outside the vocabulary. `details.issues` lists them. |

Pass `debug: true` to `Tagger` to log each request and response.
