-- Reverse of 0008: English background ids back to the German ones.
UPDATE "app_settings" SET "defaults" = jsonb_set("defaults", '{background}', to_jsonb(CASE "defaults"->>'background'
	WHEN 'cork-photo' THEN 'kork-foto' WHEN 'cork-classic' THEN 'kork-klassisch' WHEN 'paper' THEN 'papier'
	WHEN 'linen' THEN 'leinen' WHEN 'sky' THEN 'himmel' WHEN 'mint' THEN 'minze' WHEN 'sun' THEN 'sonne'
	WHEN 'coral' THEN 'koralle' END))
	WHERE "defaults"->>'background' IN ('cork-photo','cork-classic','paper','linen','sky','mint','sun','coral');--> statement-breakpoint
UPDATE "boards" SET "settings" = jsonb_set("settings", '{background}', to_jsonb(CASE "settings"->>'background'
	WHEN 'cork-photo' THEN 'kork-foto' WHEN 'cork-classic' THEN 'kork-klassisch' WHEN 'paper' THEN 'papier'
	WHEN 'linen' THEN 'leinen' WHEN 'sky' THEN 'himmel' WHEN 'mint' THEN 'minze' WHEN 'sun' THEN 'sonne'
	WHEN 'coral' THEN 'koralle' END))
	WHERE "settings"->>'background' IN ('cork-photo','cork-classic','paper','linen','sky','mint','sun','coral');
