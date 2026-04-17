#!/bin/bash
# Stale Test Events Cleanup Script
# Issue #15: Resolves pre-existing mutate-events contract/query failures
# 
# This script removes stale test data from the events table that accumulated
# during development, which was causing test failures due to data pollution.
#
# Usage:
#   psql $DATABASE_URL -f scripts/cleanup-stale-test-events.sql
#
# Safety: Only deletes rows with group_id LIKE 'allura-test-%', preserving
# production data (allura-roninmemory and other non-test group IDs).

-- Step 1: Verify scope before delete
-- Shows count of test data per group_id
SELECT 
    group_id, 
    COUNT(*) as row_count
FROM events 
WHERE group_id LIKE 'allura-test-%'
GROUP BY group_id
ORDER BY row_count DESC;

-- Step 2: Backup (optional but recommended)
-- Uncomment if you want to backup before delete:
-- COPY (SELECT * FROM events WHERE group_id LIKE 'allura-test-%') 
-- TO '/tmp/stale_test_events_backup.csv' CSV HEADER;

-- Step 3: Delete stale test events
-- Excludes allura-roninmemory (production data) and any other IDs you want to keep
-- Note: Must delete from outcomes first due to foreign key constraint
DELETE FROM outcomes 
WHERE group_id LIKE 'allura-test-%'
  AND group_id NOT IN ('allura-roninmemory');

DELETE FROM events 
WHERE group_id LIKE 'allura-test-%'
  AND group_id NOT IN ('allura-roninmemory');

-- Step 4: Verify deletion
-- Should show 0 rows for allura-test-* group_ids (except allura-roninmemory)
SELECT 
    COUNT(*) as remaining_test_rows
FROM events 
WHERE group_id LIKE 'allura-test-%'
  AND group_id NOT IN ('allura-roninmemory');
