---
title: Backends
description: Configure Amos, or plug in another model.
sidebar:
  order: 5
---

`AmosBackend` options:

| Option            | Description                                                                                                  |
| ----------------- | ------------------------------------------------------------------------------------------------------------ |
| `baseUrl`         | Default `https://api.amos.scira.ai`. Point it at your own `amos.serve` to self-host.                         |
| `model`           | Default `amos-1-large`. Always sent: the hosted API otherwise answers with `amos-1-mini`.                    |
| `retry`           | Retries rate limits, server errors, timeouts and network failures, up to 4 attempts. `false` turns them off. |
| `timeout`         | Milliseconds to wait for each request. Default 60 seconds. `false` waits indefinitely.                       |
| `maxRequestBytes` | Default 4,000,000. The hosted API drops larger requests, so they're refused before sending.                  |
| `userAgent`       | Sent as the User-Agent header.                                                                               |

For tests, or another model, pass any object with `decide({ context, image, questions })` that returns `{ answers }`. See `TaggingBackend` for the shapes.
