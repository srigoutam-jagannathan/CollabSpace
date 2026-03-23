-- Add badges and portfolio_links columns to profiles
-- Run this in the Supabase SQL Editor

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS badges TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS portfolio_links JSONB NOT NULL DEFAULT '[]';

-- Ensure skills column exists with correct default (may already exist)
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS skills TEXT[] NOT NULL DEFAULT '{}';
