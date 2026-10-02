-- Down migration for 0000 (Better Auth tables). Drop FK-dependent tables first.
DROP TABLE IF EXISTS "account";
DROP TABLE IF EXISTS "session";
DROP TABLE IF EXISTS "verification";
DROP TABLE IF EXISTS "user";
