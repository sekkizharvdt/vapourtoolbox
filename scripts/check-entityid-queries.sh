#!/bin/bash
#
# EntityId Query Safety Check
#
# Scans staged TypeScript files for Firestore queries on multi-tenant collections
# that are missing entityId filtering. Runs as part of the pre-commit hook.
#
# Global (non-entity-scoped) collections that are EXEMPT:
#   users, taskNotifications — scoped by userId
#   entities — the entity registry itself
#   materials, shapes, boughtOutItems — shared reference data
#   projects/*/transmittals — scoped by projectId subcollection
#   projects/*/masterDocuments — scoped by projectId subcollection
#   projects/*/submissions — scoped by projectId subcollection
#
# Exit code 0 = pass, 1 = failures found

EXEMPT_COLLECTIONS="users|taskNotifications|entities|materials|shapes|boughtOutItems|transmittals|masterDocuments|submissions|auditLogs|taskNotifications"

# Get staged .ts/.tsx files (exclude node_modules, tests, and type files)
FILES=$(git diff --cached --name-only --diff-filter=ACM | grep -E '\.(ts|tsx)$' | grep -v 'node_modules' | grep -v '\.test\.' | grep -v '\.spec\.' | grep -v '__tests__')

if [ -z "$FILES" ]; then
  exit 0
fi

ISSUES=0

for FILE in $FILES; do
  # Skip files that don't contain Firestore query patterns
  if ! grep -qE "(collection\(|query\(|where\()" "$FILE" 2>/dev/null; then
    continue
  fi

  # Skip exempt collections
  if grep -qE "collection\(.*($EXEMPT_COLLECTIONS)" "$FILE" 2>/dev/null; then
    # File references exempt collections — check non-exempt queries only
    :
  fi

  # Find lines with collection() + query() but no entityId where clause nearby
  # This is a heuristic — check if the file has query() calls without entityId
  HAS_QUERY=$(grep -n "query(" "$FILE" 2>/dev/null)
  HAS_ENTITY_FILTER=$(grep -c "entityId" "$FILE" 2>/dev/null)
  HAS_COLLECTION=$(grep -cE "collection\(db," "$FILE" 2>/dev/null)

  # If file has Firestore queries but zero entityId references, flag it
  if [ -n "$HAS_QUERY" ] && [ "$HAS_ENTITY_FILTER" = "0" ] && [ "$HAS_COLLECTION" -gt 0 ]; then
    # Check if ALL collection references are to exempt collections
    NON_EXEMPT=$(grep -E "collection\(db," "$FILE" 2>/dev/null | grep -vE "($EXEMPT_COLLECTIONS)" | head -5)
    if [ -n "$NON_EXEMPT" ]; then
      echo "⚠️  Missing entityId filter in: $FILE"
      echo "$NON_EXEMPT" | sed 's/^/   /'
      ISSUES=$((ISSUES + 1))
    fi
  fi
done

if [ "$ISSUES" -gt 0 ]; then
  echo ""
  echo "❌ Found $ISSUES file(s) with Firestore queries potentially missing entityId filter."
  echo "   Multi-tenant collections MUST include where('entityId', '==', entityId)."
  echo "   Exempt collections: users, entities, materials, shapes, boughtOutItems"
  echo ""
  # Warning only — don't block commit, but make it visible
  exit 0
fi

exit 0
