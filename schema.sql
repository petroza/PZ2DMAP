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
