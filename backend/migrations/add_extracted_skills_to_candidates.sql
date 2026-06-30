-- Migration: add extracted_skills column to candidates table
-- Run this once before starting the server after the local-storage refactor.
-- Safe to run multiple times (uses IF NOT EXISTS logic via IGNORE / MODIFY on same type).

ALTER TABLE candidates
  ADD COLUMN IF NOT EXISTS extracted_skills JSON DEFAULT NULL;
