# 👤 First Admin User Setup

Since you don't have any admin users yet, you need to manually create your first SUPER_ADMIN.

## ⚠️ PREREQUISITES: Firebase Console Setup

Before starting, you MUST configure Firebase Console:

### 1. Enable Google Authentication

1. Go to: https://console.firebase.google.com/project/vapour-toolbox/authentication/providers
2. Click on **Google** provider
3. If not enabled, click **Enable** toggle
4. Verify Web SDK configuration is correct
5. Click **Save**

### 2. Add Authorized Domains

1. Go to: https://console.firebase.google.com/project/vapour-toolbox/authentication/settings
2. Scroll to **Authorized domains** section
3. Make sure `localhost` is in the list (should be there by default)
4. If deploying to production later, add your production domain here

**Without these steps, you'll get "auth/internal-error" when trying to sign in!**

---

## 🚀 Quick Setup (3 Steps)

### Step 1: Start the App & Sign In

```bash
cd C:\Users\sekki\VDT-Unified\apps\web
pnpm dev
```

Open browser: **http://localhost:3000**

1. Click "Sign in with Google"
2. Choose your **@vapourdesal.com** account
3. You'll see the "Pending Approval" page
4. **Leave this page open** (you'll need your User ID)

---

### Step 2: Find Your User ID

**Option A: From the URL (If you got redirected)**
- Look at the browser URL
- Won't work if you're on pending-approval page

**Option B: From Firebase Console (Easiest)**

1. Go to: https://console.firebase.google.com/project/vapour-toolbox/authentication/users
2. Find your email in the list
3. Click on your email
4. Copy the **User UID** (looks like: `abcd1234efgh5678...`)

---

### Step 3: Set Admin Claims & Update User Document

#### A. Go to Firestore Console

https://console.firebase.google.com/project/vapour-toolbox/firestore/data

#### B. Find/Create Your User Document

1. Look for `users` collection (if it doesn't exist, it will be created when you sign in)
2. If you don't see your user document:
   - Click "Start collection"
   - Collection ID: `users`
   - Document ID: **Your User UID from Step 2**
   - Click "Add document"

3. If the document exists, click on it to edit

#### C. Set These Fields

Click "Add field" for each of these:

| Field | Type | Value |
|-------|------|-------|
| `email` | string | `your-email@vapourdesal.com` |
| `displayName` | string | `Your Name` |
| `photoURL` | string | *(your Google photo URL - optional)* |
| `status` | string | `active` |
| `isActive` | boolean | `true` |
| `roles` | array | Click "+" → string → `SUPER_ADMIN` |
| `department` | string | `MANAGEMENT` |
| `jobTitle` | string | `Administrator` (optional) |
| `assignedProjects` | array | *(empty for now)* |
| `createdAt` | timestamp | *(click "Use server timestamp")* |
| `updatedAt` | timestamp | *(click "Use server timestamp")* |

**Your document should look like this:**
```json
{
  "email": "you@vapourdesal.com",
  "displayName": "Your Name",
  "status": "active",
  "isActive": true,
  "roles": ["SUPER_ADMIN"],
  "department": "MANAGEMENT",
  "jobTitle": "Administrator",
  "assignedProjects": [],
  "createdAt": "January 1, 2025 at 12:00:00 AM UTC+5:30",
  "updatedAt": "January 1, 2025 at 12:00:00 AM UTC+5:30"
}
```

Click **"Save"**

---

### Step 4: Set Custom Claims (IMPORTANT!)

Custom claims are what give you actual permissions. Without these, you still won't have access.

#### Option A: Using Firebase CLI (Easiest)

Create a file `set-admin-claims.js`:

```javascript
const admin = require('firebase-admin');

// Initialize Firebase Admin
admin.initializeApp();

async function setAdminClaims() {
  const userEmail = 'YOUR-EMAIL@vapourdesal.com'; // CHANGE THIS

  try {
    // Get user by email
    const user = await admin.auth().getUserByEmail(userEmail);

    // Set custom claims
    await admin.auth().setCustomUserClaims(user.uid, {
      roles: ['SUPER_ADMIN'],
      permissions: 2147483647, // All permissions (max 32-bit int)
      domain: 'internal'
    });

    console.log('✅ Admin claims set successfully!');
    console.log('User needs to sign out and sign back in to see changes.');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

setAdminClaims();
```

Run it:
```bash
npm install firebase-admin
GOOGLE_APPLICATION_CREDENTIALS="path/to/serviceAccountKey.json" node set-admin-claims.js
```

#### Option B: Using Firebase Console (Alternative)

Firebase Console doesn't have a UI for custom claims. You'll need to use:
1. Firebase Functions (deploy a callable function)
2. Firebase Admin SDK (Option A above)
3. Wait for our Cloud Functions to be deployed (coming soon)

---

### Step 5: Sign Out & Sign Back In

1. Go back to your app
2. Click "Sign Out" button
3. Sign in again with Google
4. You should now have full access!

Go to: **http://localhost:3000/dashboard/users**

You should see the User Management page with full access! 🎉

---

## ✅ Verify You're an Admin

Once logged in, check:

1. **Dashboard** - You can see all module cards
2. **User Management** - No "Access Denied" message
3. **Browser Console (F12)** - Check claims:
   ```javascript
   // Your claims should show:
   {
     roles: ['SUPER_ADMIN'],
     permissions: 2147483647,
     domain: 'internal'
   }
   ```

---

## 🔑 Understanding Permissions

### Roles vs Permissions

- **Roles**: Human-readable labels (SUPER_ADMIN, ENGINEER, etc.)
- **Permissions**: Bitwise flags for fine-grained access control
  - Bit 1 (1): MANAGE_USERS
  - Bit 2 (2): VIEW_USERS
  - Bit 3 (4): MANAGE_ROLES
  - ... (32 total permissions)

### SUPER_ADMIN Gets Everything

```javascript
permissions: 2147483647  // Binary: 01111111111111111111111111111111
                        // All 31 permission bits enabled
```

### Why Both?

- **Roles** → Displayed in UI, easier to understand
- **Permissions** → Enforced in Firestore rules, faster than role checks
- Each role → Calculated permission bits automatically (once Cloud Functions are deployed)

---

## 🐛 Troubleshooting

### Still seeing "Pending Approval"?
- Make sure `status` = `"active"` (not `"pending"`)
- Make sure `isActive` = `true`
- Sign out and sign back in

### "Access Denied" on /dashboard/users?
- You need custom claims set (Step 4)
- Check browser console for claims
- Sign out and sign back in after setting claims

### User document not created?
- Sign in at least once to create the document
- If still missing, create it manually (Step 3)

### Claims not updating?
- Custom claims are cached in the ID token
- Must sign out and sign back in to refresh
- Or wait 1 hour for automatic refresh

---

## 🚀 Next Steps

Once you're logged in as admin:

1. ✅ Test User Management features
2. ✅ Approve other pending users
3. ✅ Edit user roles and departments
4. ⏳ Cloud Functions (auto-set claims on approval)
5. ⏳ Notification Center
6. ⏳ Invitation System for external users

---

## 💡 Pro Tip

Create a second test user:
1. Open incognito window
2. Go to http://localhost:3000
3. Sign in with different @vapourdesal.com account
4. They'll show as "pending" in your admin view
5. Test the approval workflow!

---

**You're ready to test! 🎉**
