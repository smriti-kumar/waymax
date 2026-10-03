// Where announcements go. Today: the screen and the laptop speaker. Later: an
// earpiece (shorter, quieter phrase via setSinkId), a smart speaker, an LED sign.
import { speak } from "@/client/speech/speak";

export type Announcement = { personId: string | null; displayText: string; sayText: string };

export interface AnnouncementSink {
  announce(a: Announcement): Promise<void>;
}

/** Shows the announcement on the patient screen (the PersonCard listens to this). */
export class ScreenSink implements AnnouncementSink {
  constructor(private show: (a: Announcement) => void) {}
  async announce(a: Announcement) {
    this.show(a);
  }
}

/** Speaks through the shared queue (ElevenLabs → browser voice). */
export class SpeakerSink implements AnnouncementSink {
  async announce(a: Announcement) {
    await speak(a.sayText);
  }
}

export async function announceAll(sinks: AnnouncementSink[], a: Announcement) {
  await Promise.all(sinks.map((s) => s.announce(a)));
}
