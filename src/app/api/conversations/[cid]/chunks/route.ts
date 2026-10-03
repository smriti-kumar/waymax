import { chunkQuery } from "@/lib/contracts/conversations";
import { requireDevice } from "@/server/auth/guards";
import { badRequest, notFound, tooLarge } from "@/server/http/errors";
import { route } from "@/server/http/route";
import { addChunk, getConversation, MAX_CHUNK_BYTES } from "@/server/services/conversations";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Raw `audio/wav` body (16 kHz mono, ~45 s). Transcribed, then the audio is dropped. */
export const POST = route({ query: chunkQuery }, async ({ req, params, query }) => {
  const device = await requireDevice(req, ["patient_display"]);
  const convo = await getConversation(params.cid);
  if (convo.patientId !== device.patientId) throw notFound("Conversation not found");
  if (Number(req.headers.get("content-length") ?? 0) > MAX_CHUNK_BYTES) throw tooLarge("Audio chunks must be under 4 MB");
  const wav = Buffer.from(await req.arrayBuffer());
  if (wav.length > MAX_CHUNK_BYTES) throw tooLarge("Audio chunks must be under 4 MB");
  if (wav.length < 44 || wav.subarray(0, 4).toString("ascii") !== "RIFF" || wav.subarray(8, 12).toString("ascii") !== "WAVE") {
    throw badRequest("Send a WAV file");
  }
  return addChunk(convo, query.seq, wav);
});
