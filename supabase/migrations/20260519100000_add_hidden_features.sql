-- Migration to add hidden_features column to settings table
ALTER TABLE settings ADD COLUMN IF NOT EXISTS hidden_features text[] DEFAULT '{}'::text[];
