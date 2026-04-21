-- SUPABASE DATABASE FIX (REMOVE FOREIGN KEY CONSTRAINTS)
-- Run these commands in Supabase SQL Editor to fix all issues

-- ============================================
-- 1. DISABLE RLS ON ALL TABLES
-- ============================================

ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE movies DISABLE ROW LEVEL SECURITY;
ALTER TABLE shares DISABLE ROW LEVEL SECURITY;
ALTER TABLE follows DISABLE ROW LEVEL SECURITY;
ALTER TABLE watched_logs DISABLE ROW LEVEL SECURITY;

-- ============================================
-- 2. REMOVE FOREIGN KEY CONSTRAINTS (MVP doesn't need them)
-- ============================================

-- Drop constraints on shares table
ALTER TABLE shares DROP CONSTRAINT IF EXISTS shares_sender_id_fkey;
ALTER TABLE shares DROP CONSTRAINT IF EXISTS shares_receiver_id_fkey;
ALTER TABLE shares DROP CONSTRAINT IF EXISTS shares_movie_id_fkey;

-- Drop constraints on follows table
ALTER TABLE follows DROP CONSTRAINT IF EXISTS follows_follower_id_fkey;
ALTER TABLE follows DROP CONSTRAINT IF EXISTS follows_following_id_fkey;

-- Drop constraints on watched_logs table
ALTER TABLE watched_logs DROP CONSTRAINT IF EXISTS watched_logs_user_id_fkey;
ALTER TABLE watched_logs DROP CONSTRAINT IF EXISTS watched_logs_movie_id_fkey;

-- ============================================
-- 3. ENSURE UNIQUE CONSTRAINTS (prevent duplicates)
-- ============================================

-- For follows table, ensure we can't send duplicate requests
ALTER TABLE follows DROP CONSTRAINT IF EXISTS follows_follower_id_following_id_key;
ALTER TABLE follows ADD CONSTRAINT follows_follower_id_following_id_key UNIQUE(follower_id, following_id);

-- For shares table, ensure we can't share same movie twice to same person
ALTER TABLE shares DROP CONSTRAINT IF EXISTS shares_sender_id_receiver_id_movie_id_key;
ALTER TABLE shares ADD CONSTRAINT shares_sender_id_receiver_id_movie_id_key UNIQUE(sender_id, receiver_id, movie_id);

-- ============================================
-- 4. CREATE INDEXES FOR PERFORMANCE
-- ============================================

-- Follows indexes
CREATE INDEX IF NOT EXISTS idx_follows_follower ON follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_follows_following ON follows(following_id);
CREATE INDEX IF NOT EXISTS idx_follows_status ON follows(status);

-- Shares indexes
CREATE INDEX IF NOT EXISTS idx_shares_sender ON shares(sender_id);
CREATE INDEX IF NOT EXISTS idx_shares_receiver ON shares(receiver_id);
CREATE INDEX IF NOT EXISTS idx_shares_movie ON shares(movie_id);

-- Users indexes
CREATE INDEX IF NOT EXISTS idx_users_auth_id ON users(auth_id);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);

-- ============================================
-- 5. VERIFY TABLES ARE READY
-- ============================================

SELECT 'users table ready' as status, COUNT(*) as count FROM users;
SELECT 'follows table ready' as status, COUNT(*) as count FROM follows;
SELECT 'shares table ready' as status, COUNT(*) as count FROM shares;
SELECT 'movies table ready' as status, COUNT(*) as count FROM movies;
