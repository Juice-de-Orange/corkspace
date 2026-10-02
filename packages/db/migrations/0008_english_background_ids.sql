-- Appearance background ids were German words; they are English now (cork-photo, paper, …).
-- Rewrite the stored values in both places that hold them: the global defaults and the
-- per-board overrides. Rows without a background, or with an already-English one, are untouched.
UPDATE "app_settings" SET "defaults" = jsonb_set("defaults", '{background}', to_jsonb(CASE "defaults"->>'background'
	WHEN 'kork-foto' THEN 'cork-photo' WHEN 'kork-klassisch' THEN 'cork-classic' WHEN 'papier' THEN 'paper'
	WHEN 'leinen' THEN 'linen' WHEN 'himmel' THEN 'sky' WHEN 'minze' THEN 'mint' WHEN 'sonne' THEN 'sun'
	WHEN 'koralle' THEN 'coral' END))
	WHERE "defaults"->>'background' IN ('kork-foto','kork-klassisch','papier','leinen','himmel','minze','sonne','koralle');--> statement-breakpoint
UPDATE "boards" SET "settings" = jsonb_set("settings", '{background}', to_jsonb(CASE "settings"->>'background'
	WHEN 'kork-foto' THEN 'cork-photo' WHEN 'kork-klassisch' THEN 'cork-classic' WHEN 'papier' THEN 'paper'
	WHEN 'leinen' THEN 'linen' WHEN 'himmel' THEN 'sky' WHEN 'minze' THEN 'mint' WHEN 'sonne' THEN 'sun'
	WHEN 'koralle' THEN 'coral' END))
	WHERE "settings"->>'background' IN ('kork-foto','kork-klassisch','papier','leinen','himmel','minze','sonne','koralle');
