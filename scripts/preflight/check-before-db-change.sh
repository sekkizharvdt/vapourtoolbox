#!/bin/bash

# Pre-Flight Checklist for Database-Related Changes
#
# Run this script BEFORE making any changes that involve Firestore queries
#
# Usage: ./scripts/preflight/check-before-db-change.sh <collection-name>

COLLECTION=$1

if [ -z "$COLLECTION" ]; then
  echo "Usage: ./scripts/preflight/check-before-db-change.sh <collection-name>"
  echo "Example: ./scripts/preflight/check-before-db-change.sh entities"
  exit 1
fi

echo "═══════════════════════════════════════════════════════════════════"
echo "  PRE-FLIGHT CHECKLIST FOR DATABASE CHANGES"
echo "  Collection: $COLLECTION"
echo "═══════════════════════════════════════════════════════════════════"
echo

# Step 1: Check if analysis script exists
echo "Step 1: Schema Analysis"
echo "─────────────────────────────────────────────────────────────────"

if [ -f "scripts/analysis/check-$COLLECTION-schema.js" ]; then
  echo "✅ Running schema analysis..."
  node "scripts/analysis/check-$COLLECTION-schema.js"
  SCHEMA_EXIT=$?

  if [ $SCHEMA_EXIT -ne 0 ]; then
    echo
    echo "⚠️  Schema analysis found issues!"
    echo "   Review the output above before proceeding."
    echo
  fi
else
  echo "⚠️  No schema analysis script found for '$COLLECTION'"
  echo "   Expected: scripts/analysis/check-$COLLECTION-schema.js"
  echo "   Consider creating one based on check-entity-schema.js"
  echo
fi

echo
echo "Step 2: Manual Checklist"
echo "─────────────────────────────────────────────────────────────────"
echo
echo "Before proceeding with database query changes, verify:"
echo
echo "  [ ] 1. All documents have the fields you're querying"
echo "  [ ] 2. Composite index exists (if using where() + orderBy())"
echo "  [ ] 3. Query is backward compatible with existing data"
echo "  [ ] 4. Types mark optional fields as optional (field?:)"
echo "  [ ] 5. Migration plan ready (if schema changes needed)"
echo "  [ ] 6. No duplicate routes/implementations exist"
echo "  [ ] 7. Tested with production-like data locally"
echo
echo "═══════════════════════════════════════════════════════════════════"
echo
echo "Common Gotchas:"
echo "  - where('field', '==', value) excludes docs without that field"
echo "  - orderBy() requires single-field index (automatic)"
echo "  - where() + orderBy() requires composite index (manual)"
echo "  - Types should reflect database reality, not ideal state"
echo
echo "Next Steps:"
echo "  1. Review analysis output above"
echo "  2. Check all items in manual checklist"
echo "  3. If schema changes needed: plan migration first"
echo "  4. Deploy indexes → code → migration (in that order)"
echo
echo "═══════════════════════════════════════════════════════════════════"
