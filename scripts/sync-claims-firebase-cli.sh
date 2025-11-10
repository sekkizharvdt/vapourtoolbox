#!/bin/bash

# Force sync custom claims using Firebase CLI
# This script uses Firebase Functions to sync claims

EMAIL="${1:-sekkizhar@vapourdesal.com}"

echo "🔧 Syncing custom claims for: $EMAIL"
echo ""

# Get the user's UID from Firestore
echo "📋 Step 1: Getting user UID..."

# Use Firebase CLI to run a one-time function
cat > /tmp/sync-user-claims.js << 'EOF'
const admin = require('firebase-admin');

// Initialize with default credentials (uses Firebase CLI auth)
admin.initializeApp();

const email = process.argv[2];

async function syncClaims() {
  try {
    // Get user by email
    const userRecord = await admin.auth().getUserByEmail(email);
    const userId = userRecord.uid;

    console.log(`Found user: ${userId}`);

    // Get Firestore data
    const userDoc = await admin.firestore().collection('users').doc(userId).get();
    const userData = userDoc.data();

    if (!userData) {
      console.error('User document not found in Firestore');
      process.exit(1);
    }

    const { status, isActive, permissions } = userData;
    const domain = email.endsWith('@vapourdesal.com') ? 'internal' : 'external';

    console.log(`Current Firestore permissions: ${permissions}`);
    console.log(`Current custom claims:`, userRecord.customClaims);

    if (status === 'active' && isActive === true && typeof permissions === 'number') {
      // Update custom claims
      await admin.auth().setCustomUserClaims(userId, {
        permissions,
        domain,
      });

      console.log('✅ Successfully synced claims!');
      console.log(`   Permissions: ${permissions}`);
      console.log(`   Domain: ${domain}`);
      console.log('');
      console.log('⚠️  User must sign out and sign back in to see changes');
    } else {
      console.error('Cannot sync - user is not active or permissions invalid');
      process.exit(1);
    }

    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

syncClaims();
EOF

# Check if firebase-admin is installed in functions
if [ ! -d "packages/functions/node_modules/firebase-admin" ]; then
  echo "📦 Installing firebase-admin..."
  cd packages/functions && npm install firebase-admin && cd ../..
fi

# Run the script using the functions environment
echo "🚀 Step 2: Syncing claims..."
cd packages/functions && node /tmp/sync-user-claims.js "$EMAIL"
RESULT=$?
cd ../..

# Cleanup
rm /tmp/sync-user-claims.js

if [ $RESULT -eq 0 ]; then
  echo ""
  echo "✅ Claims sync completed!"
  echo ""
  echo "📝 Next steps:"
  echo "   1. Sign out of the application"
  echo "   2. Close all browser tabs"
  echo "   3. Sign back in"
  echo "   4. Navigate to /super-admin/module-integrations/accounting"
else
  echo ""
  echo "❌ Claims sync failed. Check the error above."
  exit 1
fi
