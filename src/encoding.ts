// Chunked, because String.fromCharCode takes at most a few hundred thousand arguments.
const chunkBytes = 0x8000;

export function toBase64(data: Uint8Array): string {
  let binary = "";
  for (let start = 0; start < data.length; start += chunkBytes) {
    binary += String.fromCharCode(...data.subarray(start, start + chunkBytes));
  }
  return btoa(binary);
}

export async function sha256Hex(data: Uint8Array): Promise<string> {
  // Copied, because Web Crypto rejects views of a SharedArrayBuffer.
  const digest = await crypto.subtle.digest("SHA-256", new Uint8Array(data));
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

export function utf8Bytes(text: string): number {
  return new TextEncoder().encode(text).byteLength;
}
