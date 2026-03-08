-- Simple database schema for caching API responses
-- Stores entire objects as JSON for simplicity

-- Listings cache table
CREATE TABLE IF NOT EXISTS listings (
  id TEXT PRIMARY KEY,
  data_json TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Neighborhood data cache table
CREATE TABLE IF NOT EXISTS neighborhood_data (
  listing_id TEXT PRIMARY KEY,
  data_json TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Index for checking data freshness
CREATE INDEX IF NOT EXISTS idx_listings_updated ON listings(updated_at);
CREATE INDEX IF NOT EXISTS idx_neighborhood_updated ON neighborhood_data(updated_at);
