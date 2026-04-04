-- ============================================================================
-- SWAP REDESIGN MIGRATION
-- Erweitert dp_shift_swaps um Multi-Duty-Support, neue Status-Werte,
-- Swap-Type (swap vs reassignment) und Kategorie-Referenzen
-- ============================================================================

-- 1) Neue Spalte: swap_type (swap = Tausch, reassignment = Admin-Zuweisung)
ALTER TABLE dp_shift_swaps
  ADD COLUMN IF NOT EXISTS swap_type TEXT NOT NULL DEFAULT 'swap'
  CHECK (swap_type IN ('swap', 'reassignment'));

-- 2) Kategorie-Referenzen statt duty_id-Referenzen
--    (Duties können gelöscht werden; Kategorie bleibt als Audit-Info)
ALTER TABLE dp_shift_swaps
  ADD COLUMN IF NOT EXISTS requester_category_id UUID REFERENCES dp_categories(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS target_category_id UUID REFERENCES dp_categories(id) ON DELETE SET NULL;

-- 3) Status-Check aktualisieren (neue Werte)
ALTER TABLE dp_shift_swaps DROP CONSTRAINT IF EXISTS dp_shift_swaps_status_check;
ALTER TABLE dp_shift_swaps
  ADD CONSTRAINT dp_shift_swaps_status_check
  CHECK (status IN (
    'pending_responder', 'accepted', 'pending_approval',
    'approved', 'rejected_responder', 'rejected_approval',
    'cancelled'
  ));

-- 4) Alte Spalten entfernen (duty_id-Referenzen ersetzen)
--    Die neuen category_id-Spalten sind flexibler
ALTER TABLE dp_shift_swaps DROP COLUMN IF EXISTS requester_duty_id;
ALTER TABLE dp_shift_swaps DROP COLUMN IF EXISTS target_duty_id;

-- 5) Bestehende Swaps mit altem Status migrieren
UPDATE dp_shift_swaps SET status = 'pending_responder' WHERE status = 'pending';
UPDATE dp_shift_swaps SET status = 'rejected_responder' WHERE status = 'rejected';
UPDATE dp_shift_swaps SET status = 'approved' WHERE status = 'completed';

-- 6) Index für schnelle Abfragen
CREATE INDEX IF NOT EXISTS idx_dp_swaps_status ON dp_shift_swaps(status);
CREATE INDEX IF NOT EXISTS idx_dp_swaps_date ON dp_shift_swaps(target_date);
