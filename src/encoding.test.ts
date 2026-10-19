import { createHash, randomBytes } from "node:crypto";
import { describe, expect, test } from "vitest";

import { sha256Hex, toBase64, utf8Bytes } from "./encoding.ts";

const samples = {
  empty: new Uint8Array(),
  "every byte value": Uint8Array.from({ length: 256 }, (_, byte) => byte),
  "more than one chunk": new Uint8Array(randomBytes(100_003)),
};

describe("toBase64()", () => {
  test.each(Object.entries(samples))("matches Node for %s", (_label, data) => {
    expect(toBase64(data)).toBe(Buffer.from(data).toString("base64"));
  });
});

describe("sha256Hex()", () => {
  test.each(Object.entries(samples))(
    "matches Node for %s",
    async (_label, data) => {
      expect(await sha256Hex(data)).toBe(
        createHash("sha256").update(data).digest("hex"),
      );
    },
  );
});

describe("utf8Bytes()", () => {
  test("counts UTF-8 bytes, not characters", () => {
    expect(utf8Bytes("Café 🙂")).toBe(Buffer.byteLength("Café 🙂"));
  });
});
