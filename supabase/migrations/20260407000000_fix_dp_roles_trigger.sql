-- Fix: Team creation fails because the AFTER INSERT trigger on teams
-- tries to INSERT into dp_roles, but the RLS INSERT policy on dp_roles
-- requires the user to already be admin — chicken-and-egg problem.
-- Solution: Make the trigger function SECURITY DEFINER so it runs with
-- the function owner's privileges (bypassing RLS).

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
