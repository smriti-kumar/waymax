import { requireDevice } from "@/server/auth/guards";
import { route } from "@/server/http/route";
import { faceGallery } from "@/server/services/faces";
import { mediaUrl } from "@/server/storage";
import type { GalleryResponse } from "@/lib/contracts/patient";
import { getPatient } from "@/server/services/patients";
import { env } from "@/server/env";

export const runtime = "nodejs";

export const GET = route({}, async ({ req }): Promise<GalleryResponse> => {
  const device = await requireDevice(req, ["patient_display", "webcam"]);
  const [people, patient] = await Promise.all([faceGallery(device.patientId), getPatient(device.patientId)]);
  return {
    model: people[0]?.model ?? "human-faceres",
    threshold: patient.faceMatchThreshold ?? env().NEXT_PUBLIC_FACE_MATCH_THRESHOLD,
    people: people.map((p) => ({
      personId: p.personId,
      name: p.name,
      relationship: p.relationship,
      photoUrl: mediaUrl(p.photoId),
      embeddings: p.embeddings,
    })),
  };
});
