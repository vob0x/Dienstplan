-- Multi-date swap grouping: links multiple swap records that belong together
ALTER TABLE dp_shift_swaps
  ADD COLUMN IF NOT EXISTS swap_group_id UUID DEFAULT NULL;

-- Index for fast group lookups
CREATE INDEX IF NOT EXISTS idx_dp_shift_swaps_group_id
  ON dp_shift_swaps (swap_group_id)
  WHERE swap_group_id IS NOT NULL;
