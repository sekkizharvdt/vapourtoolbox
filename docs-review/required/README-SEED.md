# Materials Data Seeding Guide

This guide explains how to seed your Firestore database with ASME standards materials data (pipes, fittings, and flanges).

## Prerequisites

- Firebase project deployed (✅ Already done)
- `seedMaterials` cloud function deployed (✅ Already done)
- Firebase user account with authentication

## Method 1: Using the Node.js Script (Recommended)

### Step 1: Set your Firebase credentials

```bash
export FIREBASE_USER_EMAIL="your@email.com"
export FIREBASE_USER_PASSWORD="your-password"
```

### Step 2: Run the seeding script

```bash
node scripts/seed-materials.js
```

The script will:

1. Authenticate to Firebase using your credentials
2. Call the `seedMaterials` cloud function
3. Seed all materials (pipes, fittings, flanges) to Firestore
4. Display the results

## Method 2: Using the Firebase Web Console

### Option A: Direct HTTP Call (using curl)

First, get an authentication token:

```bash
# Login to Firebase CLI (if not already logged in)
firebase login

# Get your ID token (this expires after 1 hour)
firebase auth:export --format=JSON /tmp/users.json --project vapour-toolbox
```

Then call the function:

```bash
curl -X POST \
  https://asia-south1-vapour-toolbox.cloudfunctions.net/seedmaterials \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ID_TOKEN" \
  -d '{"data": {"dataType": "all", "deleteExisting": false}}'
```

### Option B: Create a Simple Admin UI

You can also create a simple admin page in your Next.js app with a button to trigger seeding. Example:

```typescript
// pages/admin/seed.tsx
import { httpsCallable } from 'firebase/functions';
import { functions } from '@/lib/firebase';

export default function SeedPage() {
  const handleSeed = async () => {
    const seedMaterials = httpsCallable(functions, 'seedmaterials');
    const result = await seedMaterials({
      dataType: 'all',
      deleteExisting: false
    });
    console.log('Seeding result:', result.data);
  };

  return (
    <button onClick={handleSeed}>
      Seed Materials Database
    </button>
  );
}
```

## What Gets Seeded

### ASME B36.10-2022 - Carbon Steel Pipes

- **73 variants** covering NPS 1/8" to 42"
- All standard schedules (SCH 10, 20, 30, 40, 60, 80, 100, 120, 140, 160, XXS)
- Material: ASTM A106 Grade B Carbon Steel

### ASME B16.9-2024 - Butt Weld Fittings

- **68 variants** of elbows, tees, reducers, and caps
- NPS 1/2" to 24"
- All standard schedules

### ASME B16.5-2025 - Weld Neck Flanges

- **54 variants** covering NPS 1/2" to 24"
- Pressure classes: 150, 300, 600, 900, 1500, 2500
- Complete dimensional data

## Expected Results

After successful seeding, you should see:

```
✅ Seeding completed successfully!

📊 Results:
   Materials created: 3
   Variants created: 195

📋 Details:
   Pipes:
     Material ID: [auto-generated]
     Variants: 73
   Fittings:
     Material ID: [auto-generated]
     Variants: 68
   Flanges:
     Material ID: [auto-generated]
     Variants: 54
```

## Verification

After seeding, verify the data in:

1. **Firebase Console**: https://console.firebase.google.com/project/vapour-toolbox/firestore
2. **Your Web App**: https://toolbox.vapourdesal.com/materials/catalog

## Re-seeding

If you need to re-seed (e.g., after data updates):

```bash
# Set deleteExisting to true in the script
# Edit scripts/seed-materials.js line 53:
deleteExisting: true  // Changed from false

# Then re-run
node scripts/seed-materials.js
```

## Troubleshooting

### "User must be authenticated to seed data"

- Make sure you've set `FIREBASE_USER_EMAIL` and `FIREBASE_USER_PASSWORD`
- Ensure the user account exists in Firebase Authentication

### "Material already exists"

- This is expected if you've already seeded the data
- Use `deleteExisting: true` to overwrite existing data

### "Container Healthcheck failed"

- This was fixed in deployment - should not occur anymore
- If it does, check that seed data files are in `functions/lib/seed-data/`

## Next Steps

After seeding:

1. Visit https://toolbox.vapourdesal.com/materials/catalog to see your data
2. Test the search and filtering functionality
3. Create BOMs that use these materials
