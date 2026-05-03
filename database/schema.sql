-- ============================================================================
-- RaushanSYNC Maths - Initial Database Schema
-- Production-Ready Supabase Initialization
-- 
-- Purpose: Setup initial profiles, progress, and practice_scores architecture
--          for the RaushanSYNC Maths platform. Run this script once on a 
--          fresh Supabase project.
-- ============================================================================

-- Step 1: Create Schema Tables
-- ============================================================================

-- 1.1 PROFILES table - User metadata only
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    education_level TEXT,
    phone TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    PRIMARY KEY (id),
    CONSTRAINT full_name_not_empty CHECK (full_name <> '')
);

COMMENT ON TABLE public.profiles IS 'User profile metadata. Email stays in auth.users only.';
COMMENT ON COLUMN public.profiles.id IS 'Foreign key to auth.users(id)';
COMMENT ON COLUMN public.profiles.full_name IS 'User display name';
COMMENT ON COLUMN public.profiles.education_level IS 'e.g., "Class 6", "Class 7", etc.';
COMMENT ON COLUMN public.profiles.phone IS 'Optional contact number';

-- 1.2 PROGRESS table - Track completion of articles and practices
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.progress (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    site TEXT NOT NULL DEFAULT 'shared',
    item_path TEXT NOT NULL,
    item_type TEXT NOT NULL,
    completed BOOLEAN DEFAULT FALSE,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE (user_id, site, item_path),
    CONSTRAINT valid_item_type CHECK (item_type IN ('article', 'practice'))
);

COMMENT ON TABLE public.progress IS 'Track which articles and practice problems users have completed.';
COMMENT ON COLUMN public.progress.user_id IS 'References the authenticated user';
COMMENT ON COLUMN public.progress.site IS 'Shared site scope identifier used by both maths and science domains.';
COMMENT ON COLUMN public.progress.item_path IS 'URL path or unique identifier (e.g., "/notes/class07/chapter01/")';
COMMENT ON COLUMN public.progress.item_type IS 'Either "article" or "practice"';
COMMENT ON COLUMN public.progress.completed IS 'Whether user completed this item';
COMMENT ON COLUMN public.progress.updated_at IS 'Last update timestamp, auto-refreshed on change';

-- 1.3 PRACTICE_SCORES table - Store practice quiz scores
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.practice_scores (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    site TEXT NOT NULL DEFAULT 'shared',
    practice_path TEXT NOT NULL,
    score INTEGER NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE (user_id, site, practice_path),
    CONSTRAINT score_range CHECK (score >= 0 AND score <= 100)
);

COMMENT ON TABLE public.practice_scores IS 'Store user scores (0-100) on practice quizzes by path.';
COMMENT ON COLUMN public.practice_scores.user_id IS 'References the authenticated user';
COMMENT ON COLUMN public.practice_scores.site IS 'Shared site scope identifier used by both maths and science domains.';
COMMENT ON COLUMN public.practice_scores.practice_path IS 'URL path to the practice quiz';
COMMENT ON COLUMN public.practice_scores.score IS 'Score percentage (0-100)';
COMMENT ON COLUMN public.practice_scores.updated_at IS 'Last update timestamp, auto-refreshed on change';

-- Step 2: Create Optimized Indexes
-- ============================================================================

-- Progress indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_progress_user_id 
    ON public.progress(user_id);

CREATE INDEX IF NOT EXISTS idx_progress_user_id_item_type 
    ON public.progress(user_id, item_type);

CREATE INDEX IF NOT EXISTS idx_progress_user_id_site 
    ON public.progress(user_id, site);

-- Practice scores indexes
CREATE INDEX IF NOT EXISTS idx_practice_scores_user_id 
    ON public.practice_scores(user_id);

CREATE INDEX IF NOT EXISTS idx_practice_scores_user_id_site 
    ON public.practice_scores(user_id, site);

-- Normalize any pre-existing site values so both domains share one data scope.
UPDATE public.progress
SET site = 'shared'
WHERE site IS DISTINCT FROM 'shared';

UPDATE public.practice_scores
SET site = 'shared'
WHERE site IS DISTINCT FROM 'shared';

-- Step 3: Enable Row Level Security (RLS)
-- ============================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.practice_scores ENABLE ROW LEVEL SECURITY;

-- Step 4: Create RLS Policies - Users can only see their own data
-- ============================================================================

-- 4.1 PROFILES policies
-- ============================================================================

-- Users can view their own profile
CREATE POLICY "Users can view own profile"
    ON public.profiles
    FOR SELECT
    USING (auth.uid() = id);

-- Users can insert their own profile (during signup)
CREATE POLICY "Users can insert own profile"
    ON public.profiles
    FOR INSERT
    WITH CHECK (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
    ON public.profiles
    FOR UPDATE
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- Users can delete their own profile
CREATE POLICY "Users can delete own profile"
    ON public.profiles
    FOR DELETE
    USING (auth.uid() = id);

-- 4.2 PROGRESS policies
-- ============================================================================

-- Users can view their own progress
CREATE POLICY "Users can view own progress"
    ON public.progress
    FOR SELECT
    USING (auth.uid() = user_id);

-- Users can insert their own progress records
CREATE POLICY "Users can insert own progress"
    ON public.progress
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Users can update their own progress records
CREATE POLICY "Users can update own progress"
    ON public.progress
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Users can delete their own progress records
CREATE POLICY "Users can delete own progress"
    ON public.progress
    FOR DELETE
    USING (auth.uid() = user_id);

-- 4.3 PRACTICE_SCORES policies
-- ============================================================================

-- Users can view their own practice scores
CREATE POLICY "Users can view own practice scores"
    ON public.practice_scores
    FOR SELECT
    USING (auth.uid() = user_id);

-- Users can insert their own practice scores
CREATE POLICY "Users can insert own practice scores"
    ON public.practice_scores
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Users can update their own practice scores
CREATE POLICY "Users can update own practice scores"
    ON public.practice_scores
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Users can delete their own practice scores
CREATE POLICY "Users can delete own practice scores"
    ON public.practice_scores
    FOR DELETE
    USING (auth.uid() = user_id);

-- Step 5: Create Auto-Update Triggers for updated_at
-- ============================================================================

-- 5.1 Trigger function
-- ============================================================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 5.2 Apply triggers to tables with updated_at
-- ============================================================================

-- Progress table trigger
DROP TRIGGER IF EXISTS trigger_update_progress_updated_at ON public.progress;
CREATE TRIGGER trigger_update_progress_updated_at
    BEFORE UPDATE ON public.progress
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Practice scores table trigger
DROP TRIGGER IF EXISTS trigger_update_practice_scores_updated_at ON public.practice_scores;
CREATE TRIGGER trigger_update_practice_scores_updated_at
    BEFORE UPDATE ON public.practice_scores
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Step 6: Auto-Create Profile on Auth Signup
-- ============================================================================

-- 6.1 Trigger function to create profile when user signs up
-- ============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, full_name, education_level)
    VALUES (
        new.id,
        COALESCE(new.raw_user_meta_data->>'full_name', 'Student'),
        NULLIF(new.raw_user_meta_data->>'education_level', '')
    )
    ON CONFLICT (id) DO UPDATE
    SET full_name = COALESCE(
            NULLIF(new.raw_user_meta_data->>'full_name', ''),
            profiles.full_name
        ),
        education_level = COALESCE(
            NULLIF(new.raw_user_meta_data->>'education_level', ''),
            profiles.education_level
        );
    
    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 6.2 Trigger on auth.users
-- ============================================================================
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- Step 7: Grants for authenticated users
-- ============================================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.progress TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.practice_scores TO authenticated;

-- ============================================================================
-- Database Initialization Complete!
-- ============================================================================
-- 
-- Summary of new schema:
-- 
-- TABLES CREATED:
--   - profiles (minimal user metadata)
--   - progress (article/practice completion tracking)
--   - practice_scores (quiz score storage)
--
-- Features:
--   ✅ Email stays in auth.users (Supabase managed)
--   ✅ RLS enabled on all tables
--   ✅ Auto-updating timestamps
--   ✅ Auto-profile creation on signup
--   ✅ Optimized indexes for common queries
--   ✅ Data integrity constraints (UNIQUE, CHECK)
--   ✅ Production-ready and free-tier compatible
--
-- ============================================================================
