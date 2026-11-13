-- Sdílené presety a projekty TN mapy.
-- Jedna tabulka pro obě entity: klíč (entity, id) umožňuje slučování po položkách,
-- které původní PHP dělalo nad JSON polem. updated_at je autorita pro „novější
-- vyhrává" při zápisu z víc otevřených okien.
CREATE TABLE IF NOT EXISTS items (
  entity     TEXT    NOT NULL,          -- 'presets' | 'projects'
  id         TEXT    NOT NULL,
  json       TEXT    NOT NULL,          -- celá položka tak, jak ji posílá appka
  updated_at INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (entity, id)
);

CREATE INDEX IF NOT EXISTS idx_items_entity ON items (entity);

-- Smazané položky (appka podle nich pozná smazání od „ještě nedoneseno").
CREATE TABLE IF NOT EXISTS deletions (
  entity     TEXT    NOT NULL,
  id         TEXT    NOT NULL,
  deleted_at INTEGER NOT NULL,
  PRIMARY KEY (entity, id)
);

-- Historie verzí: celý stav entity PŘED každým zápisem z appky (functions/api/_history.js).
-- Obnova v /admin → Historie. Drží se 30 dní, aspoň posledních 50, nejvýš 300 verzí.
CREATE TABLE IF NOT EXISTS items_history (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  entity   TEXT    NOT NULL,
  saved_at INTEGER NOT NULL,
  count    INTEGER NOT NULL,
  hash     TEXT    NOT NULL,
  reason   TEXT    NOT NULL DEFAULT '',
  json     TEXT    NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_history_entity ON items_history (entity, id);
