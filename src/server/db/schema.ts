// Drizzle schema — mirrors PLAN §4 DDL exactly. The Timescale parts live in
// drizzle/0001_timescale.sql (custom migration).
import { sql } from "drizzle-orm";
import {
  boolean,
  char,
  check,
  customType,
  date,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  real,
  smallint,
  text,
  time,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType() {
    return "bytea";
  },
});

const ts = (name: string) => timestamp(name, { withTimezone: true });

// ---------- enums ----------
export const caregiverRole = pgEnum("caregiver_role", ["owner", "member"]);
export const deviceKind = pgEnum("device_kind", [
  "patient_display",
  "patient_phone",
  "webcam",
  "earpiece",
  "smart_speaker",
  "led_display",
  "other",
]);
export const geofenceKind = pgEnum("geofence_kind", ["home", "temporary"]);
export const geofenceState = pgEnum("geofence_state", ["unknown", "inside", "outside"]);
export const personStatus = pgEnum("person_status", ["pending", "approved", "rejected"]);
export const createdVia = pgEnum("created_via", ["caregiver", "patient_device", "seed"]);
export const embeddingSource = pgEnum("embedding_source", ["upload", "webcam_capture"]);
export const memoryKind = pgEnum("memory_kind", ["note", "photo", "story"]);
export const recogSource = pgEnum("recog_source", ["face", "voice", "manual"]);
export const convoStatus = pgEnum("convo_status", ["recording", "processing", "done", "failed"]);
export const scheduleKind = pgEnum("schedule_kind", ["visit", "activity", "therapy", "meal", "other"]);
export const eventKind = pgEnum("event_kind", [
  "confused_pressed",
  "calming_music",
  "calming_memories",
  "question_asked",
  "who_is_this",
  "memories_opened",
  "listen_started",
]);
export const locationSource = pgEnum("location_source", ["browser", "shortcut", "simulated", "device"]);
export const notifKind = pgEnum("notif_kind", ["geofence_exit", "geofence_return", "person_pending", "test"]);
export const deliveryStatus = pgEnum("delivery_status", ["skipped", "pending", "sent", "failed"]);

// ---------- tables ----------
export const caregivers = pgTable("caregivers", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: text("name").notNull(),
  phoneE164: text("phone_e164"),
  createdAt: ts("created_at").notNull().defaultNow(),
});

export const sessions = pgTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    caregiverId: uuid("caregiver_id")
      .notNull()
      .references(() => caregivers.id, { onDelete: "cascade" }),
    expiresAt: ts("expires_at").notNull(),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [index().on(t.caregiverId)],
);

export const patients = pgTable("patients", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  preferredName: text("preferred_name").notNull(),
  timezone: text("timezone").notNull().default("America/New_York"),
  homeLabel: text("home_label").notNull().default("Home"),
  homeLat: doublePrecision("home_lat"),
  homeLng: doublePrecision("home_lng"),
  geofenceState: geofenceState("geofence_state").notNull().default("unknown"),
  geofenceStateChangedAt: ts("geofence_state_changed_at"),
  outsideStreak: integer("outside_streak").notNull().default(0),
  lastLocationAt: ts("last_location_at"),
  /** Face match strictness for this patient's display (null = app default). */
  faceMatchThreshold: real("face_match_threshold"),
  createdAt: ts("created_at").notNull().defaultNow(),
});

export const patientCaregivers = pgTable(
  "patient_caregivers",
  {
    patientId: uuid("patient_id")
      .notNull()
      .references(() => patients.id, { onDelete: "cascade" }),
    caregiverId: uuid("caregiver_id")
      .notNull()
      .references(() => caregivers.id, { onDelete: "cascade" }),
    role: caregiverRole("role").notNull().default("owner"),
  },
  (t) => [primaryKey({ columns: [t.patientId, t.caregiverId] }), index().on(t.caregiverId)],
);

export const devices = pgTable(
  "devices",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    patientId: uuid("patient_id")
      .notNull()
      .references(() => patients.id, { onDelete: "cascade" }),
    kind: deviceKind("kind").notNull(),
    label: text("label").notNull(),
    tokenHash: text("token_hash").notNull().unique(),
    capabilities: jsonb("capabilities").$type<Record<string, unknown>>().notNull().default({}),
    lastSeenAt: ts("last_seen_at"),
    revokedAt: ts("revoked_at"),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [index().on(t.patientId)],
);

export const pairingCodes = pgTable("pairing_codes", {
  code: char("code", { length: 6 }).primaryKey(),
  patientId: uuid("patient_id")
    .notNull()
    .references(() => patients.id, { onDelete: "cascade" }),
  deviceKind: deviceKind("device_kind").notNull(),
  createdBy: uuid("created_by")
    .notNull()
    .references(() => caregivers.id),
  expiresAt: ts("expires_at").notNull(),
  usedAt: ts("used_at"),
});

export const geofences = pgTable(
  "geofences",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    patientId: uuid("patient_id")
      .notNull()
      .references(() => patients.id, { onDelete: "cascade" }),
    kind: geofenceKind("kind").notNull(),
    label: text("label").notNull(),
    centerLat: doublePrecision("center_lat").notNull(),
    centerLng: doublePrecision("center_lng").notNull(),
    radiusM: integer("radius_m").notNull(),
    activeFrom: ts("active_from"),
    activeUntil: ts("active_until"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [
    check("geofences_radius_m_check", sql`${t.radiusM} between 50 and 20000`),
    check(
      "geofences_window_check",
      sql`${t.kind} = 'home' or (${t.activeFrom} is not null and ${t.activeUntil} is not null and ${t.activeUntil} > ${t.activeFrom})`,
    ),
    uniqueIndex("one_home_fence").on(t.patientId).where(sql`${t.kind} = 'home'`),
    index().on(t.patientId, t.isActive),
  ],
);

export const alertContacts = pgTable(
  "alert_contacts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    patientId: uuid("patient_id")
      .notNull()
      .references(() => patients.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    phoneE164: text("phone_e164").notNull(),
    notifyGeofence: boolean("notify_geofence").notNull().default(true),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [
    check("alert_contacts_phone_check", sql`${t.phoneE164} ~ '^\\+[1-9][0-9]{7,14}$'`),
    unique().on(t.patientId, t.phoneE164),
  ],
);

export const mediaBlobs = pgTable(
  "media_blobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    patientId: uuid("patient_id")
      .notNull()
      .references(() => patients.id, { onDelete: "cascade" }),
    mime: text("mime").notNull(),
    bytes: bytea("bytes").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    sha256: text("sha256").notNull(),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [check("media_blobs_size_check", sql`${t.sizeBytes} <= 2000000`), unique().on(t.patientId, t.sha256)],
);

export type NarrationScript = {
  intro: string;
  slides: { memoryId: string; caption: string }[];
  outro: string;
};

export const people = pgTable(
  "people",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    patientId: uuid("patient_id")
      .notNull()
      .references(() => patients.id, { onDelete: "cascade" }),
    status: personStatus("status").notNull().default("pending"),
    name: text("name"),
    relationship: text("relationship"),
    spokenName: text("spoken_name"),
    description: text("description"),
    visitRoutine: text("visit_routine"),
    narration: jsonb("narration").$type<NarrationScript>(),
    narrationHash: text("narration_hash"),
    primaryPhotoId: uuid("primary_photo_id").references(() => mediaBlobs.id, { onDelete: "set null" }),
    createdVia: createdVia("created_via").notNull(),
    approvedBy: uuid("approved_by").references(() => caregivers.id),
    approvedAt: ts("approved_at"),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [
    check(
      "people_approved_fields_check",
      sql`${t.status} <> 'approved' or (${t.name} is not null and ${t.relationship} is not null)`,
    ),
    index().on(t.patientId, t.status),
  ],
);

export const faceEmbeddings = pgTable(
  "face_embeddings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    personId: uuid("person_id")
      .notNull()
      .references(() => people.id, { onDelete: "cascade" }),
    model: text("model").notNull(),
    dim: integer("dim").notNull(),
    embedding: real("embedding").array().notNull(),
    source: embeddingSource("source").notNull(),
    mediaId: uuid("media_id").references(() => mediaBlobs.id, { onDelete: "set null" }),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [
    check("face_embeddings_dim_check", sql`array_length(${t.embedding}, 1) = ${t.dim}`),
    index().on(t.personId),
  ],
);

export const personMemories = pgTable(
  "person_memories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    personId: uuid("person_id")
      .notNull()
      .references(() => people.id, { onDelete: "cascade" }),
    kind: memoryKind("kind").notNull(),
    title: text("title").notNull(),
    body: text("body"),
    mediaId: uuid("media_id").references(() => mediaBlobs.id, { onDelete: "set null" }),
    occurredOn: date("occurred_on"),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [index().on(t.personId)],
);

export const visits = pgTable(
  "visits",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    patientId: uuid("patient_id")
      .notNull()
      .references(() => patients.id, { onDelete: "cascade" }),
    personId: uuid("person_id")
      .notNull()
      .references(() => people.id, { onDelete: "cascade" }),
    startedAt: ts("started_at").notNull().defaultNow(),
    lastSeenAt: ts("last_seen_at").notNull().defaultNow(),
    endedAt: ts("ended_at"),
  },
  (t) => [index().on(t.patientId, t.startedAt.desc()), index().on(t.personId, t.startedAt.desc())],
);

/**
 * Voice cross-check result. `matchesFace` is null when no face was recognized to
 * compare against; `matchedPersonId` is the approved person the claimed name matched.
 */
export type SpeakerClaim = { claimedName: string; matchesFace: boolean | null; matchedPersonId?: string | null; faceName?: string | null };

export const conversations = pgTable(
  "conversations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    patientId: uuid("patient_id")
      .notNull()
      .references(() => patients.id, { onDelete: "cascade" }),
    visitId: uuid("visit_id").references(() => visits.id, { onDelete: "set null" }),
    personId: uuid("person_id").references(() => people.id, { onDelete: "set null" }),
    status: convoStatus("status").notNull().default("recording"),
    transcript: text("transcript").notNull().default(""),
    summary: text("summary"),
    keyFacts: jsonb("key_facts").$type<string[]>().notNull().default([]),
    speakerClaim: jsonb("speaker_claim").$type<SpeakerClaim>(),
    startedAt: ts("started_at").notNull().defaultNow(),
    endedAt: ts("ended_at"),
  },
  (t) => [index().on(t.personId, t.startedAt.desc())],
);

export const conversationChunks = pgTable(
  "conversation_chunks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    seq: integer("seq").notNull(),
    transcript: text("transcript"),
    status: convoStatus("status").notNull().default("processing"),
    error: text("error"),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [unique().on(t.conversationId, t.seq)],
);

export const scheduleItems = pgTable(
  "schedule_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    patientId: uuid("patient_id")
      .notNull()
      .references(() => patients.id, { onDelete: "cascade" }),
    kind: scheduleKind("kind").notNull(),
    title: text("title").notNull(),
    personId: uuid("person_id").references(() => people.id, { onDelete: "set null" }),
    startsAt: ts("starts_at"),
    daysOfWeek: smallint("days_of_week").array(),
    startTime: time("start_time"),
    durationMin: integer("duration_min").notNull().default(60),
    notes: text("notes"),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [
    check("schedule_items_duration_check", sql`${t.durationMin} between 5 and 720`),
    check(
      "schedule_items_style_check",
      sql`(${t.startsAt} is not null) <> (${t.daysOfWeek} is not null and ${t.startTime} is not null)`,
    ),
    index().on(t.patientId),
  ],
);

export const questions = pgTable(
  "questions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    patientId: uuid("patient_id")
      .notNull()
      .references(() => patients.id, { onDelete: "cascade" }),
    question: text("question").notNull(),
    answer: text("answer").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [index().on(t.patientId, t.sortOrder)],
);

export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    patientId: uuid("patient_id")
      .notNull()
      .references(() => patients.id, { onDelete: "cascade" }),
    kind: notifKind("kind").notNull(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    dedupeKey: text("dedupe_key").notNull().unique(),
    photonStatus: deliveryStatus("photon_status").notNull().default("pending"),
    photonAttempts: integer("photon_attempts").notNull().default(0),
    photonLastError: text("photon_last_error"),
    readAt: ts("read_at"),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [
    index().on(t.patientId, t.createdAt.desc()),
    index("notifications_pending_idx").on(t.photonStatus).where(sql`${t.photonStatus} = 'pending'`),
  ],
);

export const ttsCache = pgTable("tts_cache", {
  key: text("key").primaryKey(),
  text: text("text").notNull(),
  provider: text("provider").notNull(),
  mediaId: uuid("media_id")
    .notNull()
    .references(() => mediaBlobs.id, { onDelete: "cascade" }),
  createdAt: ts("created_at").notNull().defaultNow(),
});

// ---------- hypertables (see 0001_timescale.sql) ----------
export const locationPings = pgTable(
  "location_pings",
  {
    patientId: uuid("patient_id")
      .notNull()
      .references(() => patients.id, { onDelete: "cascade" }),
    deviceId: uuid("device_id").references(() => devices.id, { onDelete: "set null" }),
    lat: doublePrecision("lat").notNull(),
    lng: doublePrecision("lng").notNull(),
    accuracyM: real("accuracy_m"),
    source: locationSource("source").notNull(),
    recordedAt: ts("recorded_at").notNull(),
    receivedAt: ts("received_at").notNull().defaultNow(),
  },
  (t) => [
    check("location_pings_lat_check", sql`${t.lat} between -90 and 90`),
    check("location_pings_lng_check", sql`${t.lng} between -180 and 180`),
  ],
);

export const patientEvents = pgTable("patient_events", {
  patientId: uuid("patient_id")
    .notNull()
    .references(() => patients.id, { onDelete: "cascade" }),
  deviceId: uuid("device_id").references(() => devices.id, { onDelete: "set null" }),
  kind: eventKind("kind").notNull(),
  payload: jsonb("payload").$type<Record<string, unknown>>().notNull().default({}),
  occurredAt: ts("occurred_at").notNull().defaultNow(),
});

export const recognitionEvents = pgTable(
  "recognition_events",
  {
    patientId: uuid("patient_id")
      .notNull()
      .references(() => patients.id, { onDelete: "cascade" }),
    deviceId: uuid("device_id").references(() => devices.id, { onDelete: "set null" }),
    personId: uuid("person_id").references(() => people.id, { onDelete: "set null" }),
    source: recogSource("source").notNull(),
    confidence: real("confidence").notNull(),
    detectedAt: ts("detected_at").notNull().defaultNow(),
  },
  (t) => [check("recognition_events_confidence_check", sql`${t.confidence} between 0 and 1`)],
);
