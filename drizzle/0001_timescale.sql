-- TimescaleDB features (PLAN §4). Every statement is wrapped so a database without
-- Timescale (or a plan that forbids a feature) keeps the plain tables and only logs a
-- WARNING. The dashboard falls back to plain SQL when patient_events_daily is missing.
DO $$ BEGIN
  CREATE EXTENSION IF NOT EXISTS timescaledb;
EXCEPTION WHEN others THEN RAISE WARNING 'waymax: timescaledb extension unavailable: %', SQLERRM;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  PERFORM create_hypertable('location_pings', by_range('recorded_at', interval '1 day'), if_not_exists => true);
EXCEPTION WHEN others THEN RAISE WARNING 'waymax: location_pings hypertable skipped: %', SQLERRM;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  PERFORM create_hypertable('patient_events', by_range('occurred_at', interval '7 days'), if_not_exists => true);
EXCEPTION WHEN others THEN RAISE WARNING 'waymax: patient_events hypertable skipped: %', SQLERRM;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  PERFORM create_hypertable('recognition_events', by_range('detected_at', interval '7 days'), if_not_exists => true);
EXCEPTION WHEN others THEN RAISE WARNING 'waymax: recognition_events hypertable skipped: %', SQLERRM;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS location_pings_patient_time ON location_pings (patient_id, recorded_at DESC);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS patient_events_patient_time ON patient_events (patient_id, occurred_at DESC);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS recognition_events_patient_time ON recognition_events (patient_id, detected_at DESC);
--> statement-breakpoint
DO $$ BEGIN
  EXECUTE $sql$
    CREATE MATERIALIZED VIEW patient_events_daily
    WITH (timescaledb.continuous, timescaledb.materialized_only = false) AS
    SELECT time_bucket(interval '1 day', occurred_at, 'America/New_York') AS day,
           patient_id, kind, count(*)::int AS n
    FROM patient_events
    GROUP BY day, patient_id, kind
    WITH NO DATA
  $sql$;
EXCEPTION WHEN others THEN RAISE WARNING 'waymax: patient_events_daily continuous aggregate skipped: %', SQLERRM;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  PERFORM add_continuous_aggregate_policy('patient_events_daily',
    start_offset => interval '30 days', end_offset => interval '1 hour',
    schedule_interval => interval '15 minutes');
EXCEPTION WHEN others THEN RAISE WARNING 'waymax: continuous aggregate policy skipped: %', SQLERRM;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE location_pings SET (timescaledb.compress, timescaledb.compress_segmentby = 'patient_id');
  PERFORM add_compression_policy('location_pings', interval '7 days');
EXCEPTION WHEN others THEN RAISE WARNING 'waymax: location_pings compression skipped: %', SQLERRM;
END $$;
