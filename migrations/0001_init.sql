CREATE TABLE IF NOT EXISTS issues (
  slug TEXT PRIMARY KEY,
  issue_number INTEGER NOT NULL,
  publication_date TEXT NOT NULL,
  payload TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS issue_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  issue_number INTEGER NOT NULL,
  publication_date TEXT NOT NULL,
  payload TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_issue_history_created_at
  ON issue_history(created_at DESC);
