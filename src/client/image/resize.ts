// Browser-only image helpers: resize uploads to ≤300 KB JPEG and crop face snapshots.

export const MAX_UPLOAD_BYTES = 300_000;

function canvasToBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("encode failed"))), "image/jpeg", quality),
  );
}

export async function loadBitmap(file: Blob): Promise<ImageBitmap> {
  return createImageBitmap(file, { imageOrientation: "from-image" });
}

/** Longest side ≤ maxSide, JPEG, stepping quality/size down until ≤ maxBytes. */
export async function resizeToJpeg(
  source: Blob | ImageBitmap | HTMLCanvasElement,
  { maxSide = 1024, maxBytes = MAX_UPLOAD_BYTES } = {},
): Promise<{ blob: Blob; width: number; height: number; canvas: HTMLCanvasElement }> {
  const bmp = source instanceof Blob ? await loadBitmap(source) : source;
  let scale = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement("canvas");
  for (let attempt = 0; attempt < 6; attempt++) {
    canvas.width = Math.max(1, Math.round(bmp.width * scale));
    canvas.height = Math.max(1, Math.round(bmp.height * scale));
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    for (const q of [0.86, 0.76, 0.66, 0.56]) {
      const blob = await canvasToBlob(canvas, q);
      if (blob.size <= maxBytes) return { blob, width: canvas.width, height: canvas.height, canvas };
    }
    scale *= 0.8;
  }
  const blob = await canvasToBlob(canvas, 0.5);
  return { blob, width: canvas.width, height: canvas.height, canvas };
}

export type Box = { x: number; y: number; width: number; height: number };

/** Crops `box` (plus padding) out of a video/canvas/image into a JPEG data blob. */
export async function cropToJpeg(
  source: CanvasImageSource & { width?: number; height?: number; videoWidth?: number; videoHeight?: number },
  box: Box,
  { pad = 0.35, maxSide = 400, maxBytes = MAX_UPLOAD_BYTES } = {},
): Promise<Blob> {
  const sw = (source.videoWidth || source.width || 0) as number;
  const sh = (source.videoHeight || source.height || 0) as number;
  const px = box.width * pad;
  const py = box.height * pad;
  const x = Math.max(0, box.x - px);
  const y = Math.max(0, box.y - py);
  const w = Math.min(sw - x, box.width + 2 * px);
  const h = Math.min(sh - y, box.height + 2 * py);
  const c = document.createElement("canvas");
  const s = Math.min(1, maxSide / Math.max(w, h));
  c.width = Math.max(1, Math.round(w * s));
  c.height = Math.max(1, Math.round(h * s));
  c.getContext("2d")!.drawImage(source, x, y, w, h, 0, 0, c.width, c.height);
  return (await resizeToJpeg(c, { maxSide, maxBytes })).blob;
}

export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(",")[1] ?? "");
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}
