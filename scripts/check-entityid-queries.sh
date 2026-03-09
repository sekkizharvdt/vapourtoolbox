#!/bin/bash
#
# EntityId Query Safety Check
#
# In this single-tenant system, entityId on transactions is the COUNTERPARTY
# (vendor/customer), NOT a tenant ID. Only the `accounts` collection uses
# entityId as a tenant marker (value: 'default-entity').
#
# This check warns if new code filters transactions by claims.entityId,
# which is almost always a bug — it filters by tenant marker instead of
# counterparty, returning zero results.
#
# Exit code 0 = pass (warning only, non-blocking)

# Get staged .ts/.tsx files (exclude node_modules, tests, and type files)
FILES=$(git diff --cached --name-only --diff-filter=ACM | grep -E '\.(ts|tsx)$' | grep -v 'node_modules' | grep -v '\.test\.' | grep -v '\.spec\.' | grep -v '__tests__')

if [ -z "$FILES" ]; then
  exit 0
fi

ISSUES=0

for FILE in $FILES; do
  # Check for the known anti-pattern: filtering transactions by claims.entityId
  # This is wrong because claims.entityId = 'default-entity' (tenant marker)
  # while transaction.entityId = vendor/customer ID (counterparty)
  MISUSE=$(grep -nE "claims(\?)?\.entityId" "$FILE" 2>/dev/null | grep -iE "where|filter|query" | head -3)
  if [ -n "$MISUSE" ]; then
    echo "⚠️  Potential entityId misuse in: $FILE"
    echo "$MISUSE" | sed 's/^/   /'
    echo "   Note: claims.entityId is the tenant marker ('default-entity'),"
    echo "   NOT the counterparty. Don't use it to filter transactions."
    ISSUES=$((ISSUES + 1))
  fi
done

if [ "$ISSUES" -gt 0 ]; then
  echo ""
  echo "⚠️  Found $ISSUES file(s) potentially using claims.entityId to filter transactions."
  echo "   See CLAUDE.md rule #1: entityId on transactions is the COUNTERPARTY."
  echo ""
fi

# Warning only — don't block commit
exit 0
