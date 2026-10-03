import { beforeEach, expect, it } from "vitest";
import { describeDb, truncateAll } from "../support/db";
import { sqlClient } from "@/server/db/client";

async function makePatient() {
  const [p] = await sqlClient()`insert into patients (name, preferred_name) values ('Margaret', 'Maggie') returning id`;
  return p.id as string;
}

describeDb("database schema", () => {
  beforeEach(truncateAll);

  it("creates all 22 tables", async () => {
    const rows = await sqlClient()`
      select count(*)::int as n from information_schema.tables
      where table_schema = 'public' and table_type = 'BASE TABLE'`;
    expect(rows[0].n).toBe(22);
  });

  it("makes the three time-series tables hypertables", async () => {
    const rows = await sqlClient()`select hypertable_name from timescaledb_information.hypertables order by 1`;
    expect(rows.map((r) => r.hypertable_name)).toEqual(["location_pings", "patient_events", "recognition_events"]);
  });

  it("creates the daily continuous aggregate", async () => {
    const rows = await sqlClient()`select view_name from timescaledb_information.continuous_aggregates`;
    expect(rows.map((r) => r.view_name)).toContain("patient_events_daily");
  });

  it("rejects a geofence radius outside 50–20000 m", async () => {
    const pid = await makePatient();
    await expect(
      sqlClient()`insert into geofences (patient_id, kind, label, center_lat, center_lng, radius_m)
                  values (${pid}, 'home', 'Home', 42.44, -76.5, 10)`,
    ).rejects.toThrow(/geofences_radius_m_check/);
    await sqlClient()`insert into geofences (patient_id, kind, label, center_lat, center_lng, radius_m)
                      values (${pid}, 'home', 'Home', 42.44, -76.5, 150)`;
  });

  it("allows only one home fence per patient", async () => {
    const pid = await makePatient();
    const ins = () => sqlClient()`insert into geofences (patient_id, kind, label, center_lat, center_lng, radius_m)
                                  values (${pid}, 'home', 'Home', 42.44, -76.5, 150)`;
    await ins();
    await expect(ins()).rejects.toThrow(/one_home_fence/);
  });

  it("requires a valid window on temporary fences", async () => {
    const pid = await makePatient();
    await expect(
      sqlClient()`insert into geofences (patient_id, kind, label, center_lat, center_lng, radius_m)
                  values (${pid}, 'temporary', 'Party', 42.44, -76.5, 150)`,
    ).rejects.toThrow(/geofences_window_check/);
  });

  it("rejects malformed alert phone numbers", async () => {
    const pid = await makePatient();
    await expect(
      sqlClient()`insert into alert_contacts (patient_id, name, phone_e164) values (${pid}, 'Raj', '555-1234')`,
    ).rejects.toThrow(/alert_contacts_phone_check/);
    await sqlClient()`insert into alert_contacts (patient_id, name, phone_e164) values (${pid}, 'Raj', '+16075551234')`;
  });

  it("requires exactly one schedule style (one-off xor weekly)", async () => {
    const pid = await makePatient();
    await expect(
      sqlClient()`insert into schedule_items (patient_id, kind, title) values (${pid}, 'meal', 'Lunch')`,
    ).rejects.toThrow(/schedule_items_style_check/);
    await expect(
      sqlClient()`insert into schedule_items (patient_id, kind, title, starts_at, days_of_week, start_time)
                  values (${pid}, 'meal', 'Lunch', now(), '{1,2}', '12:30')`,
    ).rejects.toThrow(/schedule_items_style_check/);
    await sqlClient()`insert into schedule_items (patient_id, kind, title, days_of_week, start_time)
                      values (${pid}, 'meal', 'Lunch', '{1,2}', '12:30')`;
  });

  it("requires name and relationship for approved people", async () => {
    const pid = await makePatient();
    await expect(
      sqlClient()`insert into people (patient_id, status, name, created_via) values (${pid}, 'approved', 'Priya', 'caregiver')`,
    ).rejects.toThrow(/people_approved_fields_check/);
  });

  it("requires embedding length to equal dim", async () => {
    const pid = await makePatient();
    const [person] = await sqlClient()`insert into people (patient_id, created_via) values (${pid}, 'seed') returning id`;
    await expect(
      sqlClient()`insert into face_embeddings (person_id, model, dim, embedding, source)
                  values (${person.id}, 'm', 3, '{0.1,0.2}', 'upload')`,
    ).rejects.toThrow(/face_embeddings_dim_check/);
  });
});
