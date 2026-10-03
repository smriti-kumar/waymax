import { describe, expect, it } from "vitest";
import { concatFloat32, downsample, encodeWav } from "@/client/audio/wav";

describe("encodeWav", () => {
  it("writes a correct 16 kHz mono PCM16 header", () => {
    const samples = new Float32Array(16000); // 1 s
    const buf = encodeWav(samples, 16000);
    const v = new DataView(buf);
    const str = (o: number, n: number) => String.fromCharCode(...new Uint8Array(buf, o, n));
    expect(buf.byteLength).toBe(44 + 32000);
    expect(str(0, 4)).toBe("RIFF");
    expect(v.getUint32(4, true)).toBe(36 + 32000);
    expect(str(8, 4)).toBe("WAVE");
    expect(str(12, 4)).toBe("fmt ");
    expect(v.getUint32(16, true)).toBe(16);
    expect(v.getUint16(20, true)).toBe(1); // PCM
    expect(v.getUint16(22, true)).toBe(1); // mono
    expect(v.getUint32(24, true)).toBe(16000);
    expect(v.getUint32(28, true)).toBe(32000);
    expect(v.getUint16(32, true)).toBe(2);
    expect(v.getUint16(34, true)).toBe(16);
    expect(str(36, 4)).toBe("data");
    expect(v.getUint32(40, true)).toBe(32000);
  });

  it("clamps and scales samples to int16", () => {
    const v = new DataView(encodeWav(new Float32Array([1, -1, 0, 2, -2]), 16000));
    expect([0, 1, 2, 3, 4].map((i) => v.getInt16(44 + i * 2, true))).toEqual([32767, -32768, 0, 32767, -32768]);
  });

  it("45 s chunks stay well under the 4 MB upload limit", () => {
    expect(encodeWav(new Float32Array(45 * 16000)).byteLength).toBe(44 + 45 * 32000); // ≈1.44 MB
  });
});

describe("downsample", () => {
  it("produces floor(n · to / from) samples", () => {
    expect(downsample(new Float32Array(48000), 48000).length).toBe(16000);
    expect(downsample(new Float32Array(44100), 44100).length).toBe(16000);
    expect(downsample(new Float32Array(1000), 44100).length).toBe(362);
    expect(downsample(new Float32Array(160), 16000).length).toBe(160);
  });

  it("averages neighbouring samples", () => {
    const out = downsample(new Float32Array([0, 0.3, 0.6, 1, 1, 1]), 48000, 16000);
    expect(Array.from(out).map((x) => +x.toFixed(2))).toEqual([0.3, 1]);
  });

  it("concatenates blocks", () => {
    expect(Array.from(concatFloat32([new Float32Array([1, 2]), new Float32Array([3])]))).toEqual([1, 2, 3]);
  });
});
