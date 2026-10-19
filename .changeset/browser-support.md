---
"@bhodgson/image-tagger": patch
---

The package runs in browsers as well as Node.js. It no longer uses `Buffer` or `node:crypto`, and `AmosBackend` calls `fetch` in a way browsers accept: before this, every request from a browser failed with "Illegal invocation".
