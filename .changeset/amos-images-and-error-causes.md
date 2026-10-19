---
"@bhodgson/image-tagger": patch
---

`AmosBackend` sends images as plain base64 instead of data URLs, which the hosted `amos-1-mini` rejected. A `backend-failure` message now includes the underlying error, such as the HTTP status and Amos's reason, instead of only "The backend request failed."
