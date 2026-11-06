-- KiteLearn: secure administrator invitation workflow
-- New isolated table; existing auth_tokens purpose constraint remains unchanged.
CREATE TABLE IF NOT EXISTS admin_invitations (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  email_normalized TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  used_at TEXT,
  invited_by TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (invited_by) REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_admin_invitations_email
  ON admin_invitations(email_normalized, expires_at);
CREATE INDEX IF NOT EXISTS idx_admin_invitations_expiry
  ON admin_invitations(expires_at);
