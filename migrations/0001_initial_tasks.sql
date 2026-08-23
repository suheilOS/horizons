CREATE TABLE tasks (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL,
  text TEXT NOT NULL,
  horizon TEXT NOT NULL CHECK (horizon IN ('today', 'week', 'month', 'year', 'life')),
  period_key TEXT NOT NULL,
  time_zone TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX tasks_user_created_idx ON tasks (user_id, created_at, id);
