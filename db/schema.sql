-- Cloudflare D1 schema (permanent store). Idempotent: safe to run again.
CREATE TABLE IF NOT EXISTS posts (
  id TEXT PRIMARY KEY,
  status TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  updated_by TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_posts_status ON posts(status, created_at DESC);
CREATE TABLE IF NOT EXISTS site_settings (
  key TEXT PRIMARY KEY,
  data TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  payload TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  run_after INTEGER NOT NULL DEFAULT 0,
  locked_until INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_jobs_ready ON jobs(kind, run_after, locked_until);
-- Likes, views and phone alerts were removed from the site.
DROP TABLE IF EXISTS post_stats;
DROP TABLE IF EXISTS post_views;
DROP TABLE IF EXISTS post_votes;
DROP TABLE IF EXISTS stat_jobs_done;
DROP TABLE IF EXISTS push_subs;
