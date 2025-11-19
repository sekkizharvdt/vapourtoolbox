#!/bin/bash
# Simple script to call seedMaterials using gcloud (which uses your Firebase CLI auth)

echo "🔐 Getting authentication token..."
TOKEN=$(gcloud auth print-identity-token 2>/dev/null)

if [ -z "$TOKEN" ]; then
  echo "❌ Error: Could not get auth token"
  echo "💡 Run: gcloud auth login"
  exit 1
fi

echo "📦 Calling seedMaterials function..."
echo ""

curl -X POST \
  "https://seedmaterials-697891123609.asia-south1.run.app" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"data": {"dataType": "all", "deleteExisting": false}}' \
  2>/dev/null | jq '.' || echo "Response received (install jq for pretty output)"

echo ""
echo "✅ Request sent!"
echo "🌐 Check: https://console.firebase.google.com/project/vapour-toolbox/firestore"
