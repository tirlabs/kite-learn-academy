-- Records the adult eligibility declaration and policy versions accepted at registration.
ALTER TABLE users ADD COLUMN adult_confirmed_at TEXT;
ALTER TABLE users ADD COLUMN terms_version TEXT;
ALTER TABLE users ADD COLUMN privacy_version TEXT;
