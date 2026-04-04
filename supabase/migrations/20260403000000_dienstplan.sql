-- ============================================================================
-- Dienstplan V6 – Supabase Migration
-- Shared Supabase instance with Zeiterfassung
-- Uses existing: profiles, teams, team_members (from Zeiterfassung)
-- Adds: dp_members, dp_duties, dp_categories, dp_roles, dp_shift_swaps, dp_approvals
-- ============================================================================

-- Enable UUID extension (may already exist from Zeiterfassung)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- DIENSTPLAN MEMBERS (Mitarbeiter im Dienstplan)
-- ============================================================================
CREATE TABLE IF NOT EXISTS dp_members (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL, -- Optional link to auth user
    name TEXT NOT NULL,
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- DIENSTPLAN CATEGORIES (Diensttypen: Arbeit, Ferien, Pikett, etc.)
-- ============================================================================
CREATE TABLE IF NOT EXISTS dp_categories (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    letter VARCHAR(2) NOT NULL DEFAULT 'X',
    color TEXT NOT NULL DEFAULT '#7EB8C4',
    sort_order INTEGER DEFAULT 0,
    requires_approval BOOLEAN DEFAULT FALSE, -- Ferien, Krankheit etc. need approval
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- DIENSTPLAN DUTIES (Dienst-Einträge: Member × Datum × Kategorie)
-- ============================================================================
CREATE TABLE IF NOT EXISTS dp_duties (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    member_id UUID NOT NULL REFERENCES dp_members(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    category_id UUID NOT NULL REFERENCES dp_categories(id) ON DELETE CASCADE,
    note TEXT,
    approval_status TEXT DEFAULT 'none' CHECK (approval_status IN ('none', 'pending', 'approved', 'rejected')),
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(member_id, date) -- One duty per member per day
);

-- ============================================================================
-- DIENSTPLAN ROLES (Rollen im Team)
-- ============================================================================
CREATE TABLE IF NOT EXISTS dp_roles (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'planner', 'member')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(team_id, user_id)
);

-- ============================================================================
-- DIENSTPLAN SHIFT SWAPS (Schicht-Tausch-Anfragen)
-- ============================================================================
CREATE TABLE IF NOT EXISTS dp_shift_swaps (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    requester_member_id UUID NOT NULL REFERENCES dp_members(id) ON DELETE CASCADE,
    target_member_id UUID NOT NULL REFERENCES dp_members(id) ON DELETE CASCADE,
    requester_duty_id UUID NOT NULL REFERENCES dp_duties(id) ON DELETE CASCADE,
    target_duty_id UUID REFERENCES dp_duties(id) ON DELETE SET NULL, -- NULL if target date has no duty
    target_date DATE NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'approved', 'completed', 'cancelled')),
    requester_note TEXT,
    responder_note TEXT,
    admin_note TEXT,
    accepted_at TIMESTAMPTZ,
    approved_by UUID REFERENCES auth.users(id),
    approved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- DIENSTPLAN APPROVALS (Genehmigungs-Anfragen für Abwesenheiten)
-- ============================================================================
CREATE TABLE IF NOT EXISTS dp_approvals (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    duty_id UUID NOT NULL REFERENCES dp_duties(id) ON DELETE CASCADE,
    requested_by UUID NOT NULL REFERENCES auth.users(id),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    note TEXT,
    decided_by UUID REFERENCES auth.users(id),
    decided_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- DIENSTPLAN USER SETTINGS
-- ============================================================================
CREATE TABLE IF NOT EXISTS dp_user_settings (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    theme TEXT DEFAULT 'cyber' CHECK (theme IN ('cyber', 'light')),
    language TEXT DEFAULT 'de' CHECK (language IN ('de', 'fr')),
    default_view TEXT DEFAULT 'month' CHECK (default_view IN ('month', 'week', 'day', 'year')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- INDEXES
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_dp_duties_team_date ON dp_duties(team_id, date);
CREATE INDEX IF NOT EXISTS idx_dp_duties_member_date ON dp_duties(member_id, date);
CREATE INDEX IF NOT EXISTS idx_dp_members_team ON dp_members(team_id);
CREATE INDEX IF NOT EXISTS idx_dp_roles_team ON dp_roles(team_id);
CREATE INDEX IF NOT EXISTS idx_dp_shift_swaps_team ON dp_shift_swaps(team_id);
CREATE INDEX IF NOT EXISTS idx_dp_approvals_team ON dp_approvals(team_id);

-- ============================================================================
-- AUTO-UPDATE TRIGGERS
-- ============================================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
    tbl TEXT;
BEGIN
    FOREACH tbl IN ARRAY ARRAY['dp_members', 'dp_categories', 'dp_duties', 'dp_shift_swaps', 'dp_approvals', 'dp_user_settings']
    LOOP
        EXECUTE format(
            'DROP TRIGGER IF EXISTS trigger_updated_at ON %I; CREATE TRIGGER trigger_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION update_updated_at();',
            tbl, tbl
        );
    END LOOP;
END;
$$;

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE dp_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE dp_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE dp_duties ENABLE ROW LEVEL SECURITY;
ALTER TABLE dp_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE dp_shift_swaps ENABLE ROW LEVEL SECURITY;
ALTER TABLE dp_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE dp_user_settings ENABLE ROW LEVEL SECURITY;

-- Helper: Check if user is in a team
CREATE OR REPLACE FUNCTION is_team_member(p_team_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM team_members
        WHERE team_id = p_team_id AND user_id = auth.uid()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper: Check if user has admin/planner role in team
CREATE OR REPLACE FUNCTION has_team_role(p_team_id UUID, p_roles TEXT[])
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM dp_roles
        WHERE team_id = p_team_id AND user_id = auth.uid() AND role = ANY(p_roles)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Members: Team members can read, admins/planners can write
CREATE POLICY dp_members_select ON dp_members FOR SELECT USING (is_team_member(team_id));
CREATE POLICY dp_members_insert ON dp_members FOR INSERT WITH CHECK (is_team_member(team_id));
CREATE POLICY dp_members_update ON dp_members FOR UPDATE USING (is_team_member(team_id));
CREATE POLICY dp_members_delete ON dp_members FOR DELETE USING (has_team_role(team_id, ARRAY['admin', 'planner']));

-- Categories: Team members can read, admins/planners can write
CREATE POLICY dp_categories_select ON dp_categories FOR SELECT USING (is_team_member(team_id));
CREATE POLICY dp_categories_insert ON dp_categories FOR INSERT WITH CHECK (is_team_member(team_id));
CREATE POLICY dp_categories_update ON dp_categories FOR UPDATE USING (is_team_member(team_id));
CREATE POLICY dp_categories_delete ON dp_categories FOR DELETE USING (has_team_role(team_id, ARRAY['admin', 'planner']));

-- Duties: Team members can read/write
CREATE POLICY dp_duties_select ON dp_duties FOR SELECT USING (is_team_member(team_id));
CREATE POLICY dp_duties_insert ON dp_duties FOR INSERT WITH CHECK (is_team_member(team_id));
CREATE POLICY dp_duties_update ON dp_duties FOR UPDATE USING (is_team_member(team_id));
CREATE POLICY dp_duties_delete ON dp_duties FOR DELETE USING (is_team_member(team_id));

-- Roles: Team members can read, only admins can modify
CREATE POLICY dp_roles_select ON dp_roles FOR SELECT USING (is_team_member(team_id));
CREATE POLICY dp_roles_insert ON dp_roles FOR INSERT WITH CHECK (has_team_role(team_id, ARRAY['admin']));
CREATE POLICY dp_roles_update ON dp_roles FOR UPDATE USING (has_team_role(team_id, ARRAY['admin']));
CREATE POLICY dp_roles_delete ON dp_roles FOR DELETE USING (has_team_role(team_id, ARRAY['admin']));

-- Shift swaps: Team members can read/create, admins can approve
CREATE POLICY dp_swaps_select ON dp_shift_swaps FOR SELECT USING (is_team_member(team_id));
CREATE POLICY dp_swaps_insert ON dp_shift_swaps FOR INSERT WITH CHECK (is_team_member(team_id));
CREATE POLICY dp_swaps_update ON dp_shift_swaps FOR UPDATE USING (is_team_member(team_id));
CREATE POLICY dp_swaps_delete ON dp_shift_swaps FOR DELETE USING (has_team_role(team_id, ARRAY['admin']));

-- Approvals: Team members can read/create, admins can decide
CREATE POLICY dp_approvals_select ON dp_approvals FOR SELECT USING (is_team_member(team_id));
CREATE POLICY dp_approvals_insert ON dp_approvals FOR INSERT WITH CHECK (is_team_member(team_id));
CREATE POLICY dp_approvals_update ON dp_approvals FOR UPDATE USING (is_team_member(team_id));
CREATE POLICY dp_approvals_delete ON dp_approvals FOR DELETE USING (has_team_role(team_id, ARRAY['admin']));

-- User settings: Only own settings
CREATE POLICY dp_settings_select ON dp_user_settings FOR SELECT USING (user_id = auth.uid());
CREATE POLICY dp_settings_insert ON dp_user_settings FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY dp_settings_update ON dp_user_settings FOR UPDATE USING (user_id = auth.uid());

-- ============================================================================
-- DEFAULT DATA TRIGGER: Create default categories when team is created
-- ============================================================================
CREATE OR REPLACE FUNCTION create_default_dp_categories()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO dp_categories (team_id, name, letter, color, sort_order, requires_approval) VALUES
        (NEW.id, 'Arbeit',      'A', '#7EB8C4', 0, FALSE),
        (NEW.id, 'Ferien',      'F', '#E5A84B', 1, TRUE),
        (NEW.id, 'Pikett',      'P', '#B8A8E0', 2, FALSE),
        (NEW.id, 'Daagesdubel', 'D', '#6EC49E', 3, FALSE),
        (NEW.id, 'Krankheit',   'K', '#D4706E', 4, TRUE),
        (NEW.id, 'Militär',     'M', '#8B8578', 5, TRUE);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_create_default_dp_categories
    AFTER INSERT ON teams
    FOR EACH ROW
    EXECUTE FUNCTION create_default_dp_categories();

-- ============================================================================
-- AUTO-ASSIGN CREATOR AS ADMIN
-- ============================================================================
CREATE OR REPLACE FUNCTION assign_team_creator_as_dp_admin()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO dp_roles (team_id, user_id, role) VALUES (NEW.id, NEW.creator_id, 'admin')
    ON CONFLICT (team_id, user_id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_assign_dp_admin
    AFTER INSERT ON teams
    FOR EACH ROW
    EXECUTE FUNCTION assign_team_creator_as_dp_admin();

-- ============================================================================
-- AUTO-CREATE USER SETTINGS ON PROFILE CREATION
-- ============================================================================
CREATE OR REPLACE FUNCTION create_dp_user_settings()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO dp_user_settings (user_id) VALUES (NEW.id)
    ON CONFLICT (user_id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Only create trigger if profiles table exists (shared with Zeiterfassung)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'profiles') THEN
        EXECUTE 'DROP TRIGGER IF EXISTS trigger_create_dp_settings ON profiles';
        EXECUTE 'CREATE TRIGGER trigger_create_dp_settings AFTER INSERT ON profiles FOR EACH ROW EXECUTE FUNCTION create_dp_user_settings()';
    END IF;
END;
$$;

-- ============================================================================
-- ENABLE REALTIME
-- ============================================================================
ALTER PUBLICATION supabase_realtime ADD TABLE dp_members;
ALTER PUBLICATION supabase_realtime ADD TABLE dp_duties;
ALTER PUBLICATION supabase_realtime ADD TABLE dp_categories;
ALTER PUBLICATION supabase_realtime ADD TABLE dp_shift_swaps;
ALTER PUBLICATION supabase_realtime ADD TABLE dp_approvals;
ALTER PUBLICATION supabase_realtime ADD TABLE dp_roles;
