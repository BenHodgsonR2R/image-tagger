// Small enough for the API's request limit, and the visitor sends less of their photo.
const maxEdge = 1024;
const jpegQuality = 0.85;

export const maxImages = 10;

export type PreparedImage = { data: Uint8Array; previewUrl: string };

export async function prepareImage(file: File): Promise<PreparedImage> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const canvas = new OffscreenCanvas(
    Math.round(bitmap.width * scale),
    Math.round(bitmap.height * scale),
  );
  const context = canvas.getContext("2d");
  if (context === null) {
    throw new Error("This browser can't resize images.");
  }
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  const blob = await canvas.convertToBlob({
    type: "image/jpeg",
    quality: jpegQuality,
  });
  return {
    data: new Uint8Array(await blob.arrayBuffer()),
    previewUrl: URL.createObjectURL(blob),
  };
}
