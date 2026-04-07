-- Fix: Team creation fails because AFTER INSERT triggers on teams
-- try to INSERT into dp_roles and dp_categories, but RLS blocks both:
--   1. dp_roles INSERT requires admin role (chicken-and-egg)
--   2. dp_categories INSERT requires is_team_member (user not yet a member when trigger fires)
-- Solution: Make BOTH trigger functions SECURITY DEFINER.

-- Fix 1: Auto-assign creator as admin
CREATE OR REPLACE FUNCTION assign_team_creator_as_dp_admin()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO dp_roles (team_id, user_id, role)
    VALUES (NEW.id, NEW.creator_id, 'admin')
    ON CONFLICT (team_id, user_id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Fix 2: Create default categories for new team
CREATE OR REPLACE FUNCTION create_default_dp_categories()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO dp_categories (team_id, name, letter, color, sort_order, requires_approval) VALUES
        (NEW.id, 'Schicht A',  'SA', '#7EB8C4', 0, FALSE),
        (NEW.id, 'Schicht B',  'SB', '#B8A8E0', 1, FALSE),
        (NEW.id, 'Ferien',      'F', '#E5A84B', 2, TRUE),
        (NEW.id, 'Krankheit',   'K', '#D4706E', 3, TRUE);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
