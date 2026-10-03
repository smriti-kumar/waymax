import { requireDevice } from "@/server/auth/guards";
import { route } from "@/server/http/route";
import { faceGallery } from "@/server/services/faces";
import { mediaUrl } from "@/server/storage";
import type { GalleryResponse } from "@/lib/contracts/patient";

export const runtime = "nodejs";

export const GET = route({}, async ({ req }): Promise<GalleryResponse> => {
  const device = await requireDevice(req, ["patient_display", "webcam"]);
  const people = await faceGallery(device.patientId);
  return {
    model: people[0]?.model ?? "human-faceres",
    people: people.map((p) => ({
      personId: p.personId,
      name: p.name,
      relationship: p.relationship,
      photoUrl: mediaUrl(p.photoId),
      embeddings: p.embeddings,
    })),
  };
});
