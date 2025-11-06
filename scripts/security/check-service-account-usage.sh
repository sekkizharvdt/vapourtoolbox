#!/bin/bash

# Check Service Account Usage
# This script helps identify if service accounts are actively being used

echo "=================================================="
echo "  SERVICE ACCOUNT USAGE CHECK"
echo "  Project: vapour-toolbox"
echo "=================================================="
echo ""

PROJECT_ID="vapour-toolbox"

# Check if gcloud is available
if ! command -v gcloud &> /dev/null; then
    echo "❌ gcloud CLI not found. Please install Google Cloud SDK."
    echo "   Install: https://cloud.google.com/sdk/docs/install"
    exit 1
fi

echo "🔍 Checking active service accounts..."
echo ""

# List of service accounts to check
SA_COMPUTE="697891123609-compute@developer.gserviceaccount.com"
SA_APPENGINE="vapour-toolbox@appspot.gserviceaccount.com"
SA_FIREBASE="firebase-adminsdk-fbsvc@vapour-toolbox.iam.gserviceaccount.com"

# Function to check service account activity
check_account() {
    local account=$1
    local name=$2

    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "📋 $name"
    echo "   Email: $account"
    echo ""

    # Check if account exists
    if gcloud iam service-accounts describe "$account" --project="$PROJECT_ID" &>/dev/null; then
        echo "   ✅ Account exists"

        # Check for keys
        echo ""
        echo "   🔑 Checking for active keys..."
        KEY_COUNT=$(gcloud iam service-accounts keys list \
            --iam-account="$account" \
            --project="$PROJECT_ID" \
            --filter="keyType:USER_MANAGED" \
            --format="value(name)" 2>/dev/null | wc -l)

        if [ "$KEY_COUNT" -gt 0 ]; then
            echo "   ⚠️  Found $KEY_COUNT user-managed key(s)"
            echo "   💡 This account might be in use"
        else
            echo "   ✅ No user-managed keys found"
            echo "   💡 Likely not actively used (only Google-managed keys)"
        fi

    else
        echo "   ⚠️  Account not found or no access"
    fi
    echo ""
}

# Check each account
check_account "$SA_COMPUTE" "Compute Engine Default Service Account"
check_account "$SA_APPENGINE" "App Engine Default Service Account"
check_account "$SA_FIREBASE" "Firebase Admin SDK Service Account"

echo "=================================================="
echo "  RECOMMENDATIONS"
echo "=================================================="
echo ""
echo "📊 Based on the results above:"
echo ""
echo "1. Accounts with NO user-managed keys:"
echo "   → Probably not actively used"
echo "   → Safe to downgrade from Editor to minimal permissions"
echo ""
echo "2. Accounts with user-managed keys:"
echo "   → Actively being used somewhere"
echo "   → Need to check what's using them before changing"
echo ""
echo "3. Firebase Admin SDK account:"
echo "   → This is used by GitHub Actions"
echo "   → Already verified as acceptable"
echo ""
echo "💡 Next step:"
echo "   If Compute/App Engine accounts have no keys,"
echo "   we can safely remove their Editor role."
echo ""
