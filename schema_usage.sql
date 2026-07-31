-- Statistiky používání TN mapy pro /admin.
-- Agregujeme po DNECH a po klientech, ne jednotlivé události: pro „kolik minut kdo
-- pracoval" to stačí, databáze neroste do nekonečna a nesbírá se nic osobního
-- nad rámec jména, které si člověk sám zadá.
CREATE TABLE IF NOT EXISTS usage_daily (
  day        TEXT    NOT NULL,          -- 'YYYY-MM-DD' (UTC)
  client_id  TEXT    NOT NULL,          -- anonymní id prohlížeče (localStorage)
  name       TEXT    NOT NULL DEFAULT '',
  seconds    INTEGER NOT NULL DEFAULT 0, -- aktivní čas nad mapou
  exports    INTEGER NOT NULL DEFAULT 0, -- vyrobené exporty (video/PNG)
  routes     INTEGER NOT NULL DEFAULT 0, -- vykreslené trasy
  chat       INTEGER NOT NULL DEFAULT 0, -- dotazy na AI asistenta
  last_seen  INTEGER NOT NULL DEFAULT 0, -- ms epoch
  PRIMARY KEY (day, client_id)
);

CREATE INDEX IF NOT EXISTS idx_usage_day ON usage_daily (day);
CREATE INDEX IF NOT EXISTS idx_usage_last ON usage_daily (last_seen);
