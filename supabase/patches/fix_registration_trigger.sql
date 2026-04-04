-- ============================================================================
-- FIX: Registration "Database error saving new user"
-- Problem: create_dp_user_settings() trigger lacks SECURITY DEFINER,
--          so RLS on dp_user_settings blocks the INSERT during signup
--          (auth.uid() may be NULL during trigger execution)
-- Solution: Make the function SECURITY DEFINER to bypass RLS
--
-- Run this in Supabase SQL Editor (Dashboard → SQL)
-- ============================================================================

-- Fix the trigger function
CREATE OR REPLACE FUNCTION create_dp_user_settings()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO dp_user_settings (user_id) VALUES (NEW.id)
    ON CONFLICT (user_id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Also fix the default categories trigger (same issue could occur)
CREATE OR REPLACE FUNCTION create_default_dp_categories()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO dp_categories (team_id, name, letter, color, sort_order, requires_approval) VALUES
        (NEW.id, 'Arbeit',      'A', '#7EB8C4', 0, FALSE),
        (NEW.id, 'Ferien',      'F', '#E5A84B', 1, TRUE),
        (NEW.id, 'Pikett',      'P', '#B8A8E0', 2, FALSE),
        (NEW.id, 'Tagesdienst', 'T', '#6EC49E', 3, FALSE),
        (NEW.id, 'Krankheit',   'K', '#D4706E', 4, TRUE),
        (NEW.id, 'Militär',     'M', '#8B8578', 5, TRUE);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Also fix the admin assignment trigger
CREATE OR REPLACE FUNCTION assign_team_creator_as_dp_admin()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO dp_roles (team_id, user_id, role) VALUES (NEW.id, NEW.creator_id, 'admin')
    ON CONFLICT (team_id, user_id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Verify: List all trigger functions and their security setting
SELECT p.proname, p.prosecdef
FROM pg_proc p
WHERE p.proname IN ('create_dp_user_settings', 'create_default_dp_categories', 'assign_team_creator_as_dp_admin');
