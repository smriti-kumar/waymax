/** Bytes that pass the server's JPEG magic-byte sniff. */
export function fakeJpeg(size = 2048, seed = 1) {
  const b = Buffer.alloc(size, seed % 251);
  b[0] = 0xff;
  b[1] = 0xd8;
  b[2] = 0xff;
  b[3] = 0xe0;
  return b;
}

export function photoForm(bytes: Buffer, extra: Record<string, string> = {}) {
  const fd = new FormData();
  fd.append("file", new Blob([new Uint8Array(bytes)], { type: "image/jpeg" }), "photo.jpg");
  for (const [k, v] of Object.entries(extra)) fd.append(k, v);
  return fd;
}
