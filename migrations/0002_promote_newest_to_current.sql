INSERT INTO issues (slug, issue_number, publication_date, payload, created_at, updated_at)
SELECT 'current', issue_number, publication_date, payload, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM issue_history
ORDER BY issue_number DESC
LIMIT 1
ON CONFLICT(slug) DO UPDATE SET
  issue_number = excluded.issue_number,
  publication_date = excluded.publication_date,
  payload = excluded.payload,
  updated_at = CURRENT_TIMESTAMP;
