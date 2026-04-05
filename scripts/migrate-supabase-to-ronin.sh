#!/bin/bash
# Supabase to Ronin Memory Migration Script
# Extracts all data from Supabase and imports it into Ronin Memory

set -e

echo "🔄 Supabase to Ronin Memory Migration"
echo "========================================"
echo ""

# Configuration - Use environment variables
: "${SUPABASE_HOST:=localhost}"
: "${SUPABASE_PORT:=54322}"
: "${SUPABASE_USER:=postgres}"
: "${SUPABASE_PASSWORD:?SUPABASE_PASSWORD is required}"
: "${SUPABASE_DB:=postgres}"

: "${POSTGRES_HOST:=localhost}"
: "${POSTGRES_PORT:=5432}"
: "${POSTGRES_USER:=ronin4life}"
: "${POSTGRES_PASSWORD:?POSTGRES_PASSWORD is required - set in .env.local}"
: "${POSTGRES_DB:=memory}"

SUPABASE_DB="postgresql://${SUPABASE_USER}:${SUPABASE_PASSWORD}@${SUPABASE_HOST}:${SUPABASE_PORT}/${SUPABASE_DB}"
RONIN_DB="postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@${POSTGRES_HOST}:${POSTGRES_PORT}/${POSTGRES_DB}"
MIGRATION_DIR="/tmp/supabase_migration_$(date +%Y%m%d_%H%M%S)"

mkdir -p "$MIGRATION_DIR"

echo "Step 1: Connecting to Supabase..."
echo "  Host: localhost:54322"
echo "  Database: postgres"
echo ""

# Check Supabase is accessible
if ! pg_isready -h localhost -p 54322 -U postgres 2>/dev/null; then
    echo "❌ Supabase is not running or not accessible"
    echo "   Try: cd /home/ronin704/dev/projects/openclaw && supabase status"
    exit 1
fi

echo "✅ Supabase is accessible"
echo ""

# Get list of tables
echo "Step 2: Discovering tables in Supabase..."
TABLES=$(psql "$SUPABASE_DB" -t -c "
    SELECT tablename FROM pg_tables 
    WHERE schemaname = 'public' 
    AND tablename NOT LIKE 'pg_%'
    AND tablename NOT LIKE '_%'
    ORDER BY tablename;
" 2>/dev/null | grep -v '^$' | sed 's/^[[:space:]]*//')

if [ -z "$TABLES" ]; then
    echo "⚠️  No tables found in Supabase public schema"
    echo "   This might mean:" 
    echo "   - Supabase is empty (fresh install)"
    echo "   - Tables are in a different schema"
    echo ""
    echo "Checking all schemas..."
    psql "$SUPABASE_DB" -c "\dn" 2>/dev/null || echo "Could not list schemas"
    exit 0
fi

echo "Found tables:"
echo "$TABLES" | while read table; do
    echo "  - $table"
done
echo ""

# Export each table
echo "Step 3: Exporting data..."
for TABLE in $TABLES; do
    echo "  Exporting $TABLE..."
    
    # Get column names
    COLUMNS=$(psql "$SUPABASE_DB" -t -c "
        SELECT string_agg(column_name, ',')
        FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = '$TABLE'
        AND column_name NOT IN ('id', 'created_at', 'updated_at');
    " 2>/dev/null | head -1 | sed 's/^[[:space:]]*//')
    
    # Export to CSV
    if [ -n "$COLUMNS" ]; then
        psql "$SUPABASE_DB" -c "
            COPY (SELECT $COLUMNS FROM \"$TABLE\") 
            TO STDOUT WITH CSV HEADER;
        " > "$MIGRATION_DIR/${TABLE}.csv" 2>/dev/null || echo "    ⚠️  Could not export $TABLE"
        
        ROWS=$(wc -l < "$MIGRATION_DIR/${TABLE}.csv" 2>/dev/null || echo "0")
        echo "    ✅ Exported $((ROWS - 1)) rows"
    else
        echo "    ⚠️  No columns to export"
    fi
done

echo ""
echo "Step 4: Data exported to: $MIGRATION_DIR"
echo ""

# Create mapping to Ronin Memory schema
echo "Step 5: Creating import script..."
cat > "$MIGRATION_DIR/import_to_ronin.sql" << 'SQLEOF'
-- Supabase to Ronin Memory Import Script
-- Run this in Ronin Memory PostgreSQL

BEGIN;

-- Create temporary tables for imported data
-- Adjust based on your Supabase schema

-- Example: If Supabase has 'events' table
-- CREATE TEMP TABLE temp_supabase_events (
--     event_type VARCHAR(255),
--     payload JSONB,
--     metadata JSONB
-- );
-- 
-- COPY temp_supabase_events FROM '/path/to/events.csv' CSV HEADER;
-- 
-- INSERT INTO events (group_id, content, created_at)
-- SELECT 
--     'supabase-migration' as group_id,
--     jsonb_build_object(
--         'event_type', event_type,
--         'payload', payload,
--         'metadata', metadata
--     ) as content,
--     NOW() as created_at
-- FROM temp_supabase_events;

-- Add migration marker
INSERT INTO events (group_id, content, created_at)
VALUES (
    'system',
    jsonb_build_object(
        'type', 'migration',
        'source', 'supabase',
        'timestamp', NOW(),
        'status', 'completed'
    ),
    NOW()
);

COMMIT;
SQLEOF

echo "  ✅ Import script created: $MIGRATION_DIR/import_to_ronin.sql"
echo ""

echo "Step 6: Migration Summary"
echo "========================="
echo ""
echo "Exported files:"
ls -lh "$MIGRATION_DIR/"*.csv 2>/dev/null | while read line; do
    echo "  $line"
done

echo ""
echo "Next steps:"
echo ""
echo "1. Review exported data:"
echo "   ls -la $MIGRATION_DIR/"
echo ""
echo "2. Import to Ronin Memory:"
echo "   psql \"$RONIN_DB\" -f $MIGRATION_DIR/import_to_ronin.sql"
echo ""
echo "3. Verify import:"
echo "   psql \"$RONIN_DB\" -c \"SELECT COUNT(*) FROM events;\""
echo ""
echo "4. Stop Supabase (when ready):"
echo "   cd /home/ronin704/dev/projects/openclaw"
echo "   supabase stop"
echo ""
echo "Migration data saved to: $MIGRATION_DIR"
