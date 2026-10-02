-- Down migration for 0002 (entries / assets / entry_versions). Drop FK-dependent tables first.
DROP TABLE IF EXISTS "entry_versions";
DROP TABLE IF EXISTS "entries";
DROP TABLE IF EXISTS "assets";
DROP TYPE IF EXISTS "entry_type";
DROP TYPE IF EXISTS "visibility";
DROP TYPE IF EXISTS "job_status";
