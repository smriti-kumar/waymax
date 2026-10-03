import { encodeWav } from "@/client/audio/wav";

/** A real WAV body of `seconds` of silence at 16 kHz. */
export const wavOf = (seconds: number) => Buffer.from(encodeWav(new Float32Array(Math.round(seconds * 16000))));
