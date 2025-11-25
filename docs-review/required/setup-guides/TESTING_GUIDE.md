# 🧪 Testing Guide - Phase 3 User Management

## 🚀 Quick Start (First Time Setup)

### 1. Install Dependencies

```bash
cd C:\Users\sekki\VDT-Unified
pnpm install
```

### 2. Start Development Server

```bash
cd apps\web
pnpm dev
```

### 3. Open Browser

Navigate to: **http://localhost:3000**

---

## 🔐 Firebase Setup Required

### Before Testing - Enable Google Sign-In

1. Go to: https://console.firebase.google.com/project/vapour-toolbox/authentication
2. Click **"Sign-in method"** tab
3. Click **"Google"** provider
4. Toggle **"Enable"**
5. Add your email: `support@vapourdesal.com` (or your company email)
6. Click **"Save"**

### Deploy Firestore Security Rules

1. Install Firebase CLI (if not installed):

   ```bash
   npm install -g firebase-tools
   ```

2. Login to Firebase:

   ```bash
   firebase login
   ```

3. Initialize Firebase (from project root):

   ```bash
   cd C:\Users\sekki\VDT-Unified
   firebase init firestore
   ```

   - Select: Use existing project
   - Choose: `vapour-toolbox`
   - Rules file: `firestore.rules` (already exists)
   - Press Enter

4. Deploy rules:
   ```bash
   firebase deploy --only firestore:rules
   ```

---

## 🧪 What You Can Test Right Now

### 1. Login Flow (Google OAuth)

**Route**: `/login` (http://localhost:3000/login)

**What to Test:**

- ✅ Click "Sign in with Google"
- ✅ Choose your Google account
- ✅ Should see pending approval page (if first time)
- ✅ Domain validation (only @vapourdesal.com allowed by default)

**Expected Behavior:**

- If you sign in with `@vapourdesal.com` → Redirects to `/pending-approval`
- If you sign in with other domain → Shows "unauthorized domain" error

---

### 2. User Management Module

**Route**: `/dashboard/users` (http://localhost:3000/dashboard/users)

**Prerequisites:**

- You need MANAGE_USERS permission (won't work for first user)
- First user needs to be manually approved in Firebase Console

#### Features to Test:

##### A. Pending Users Approval ⭐ NEW

**What You'll See:**

- Yellow warning banner at top
- Shows users with status = "pending"
- Each user shows: photo, name, email, signup date

**Actions:**

1. Click "Review & Approve"
2. Fill in:
   - Job Title (optional)
   - Roles (required, multi-select)
   - Department (required)
3. Click "Approve User"
4. User status changes to "active"

**OR**

1. Click "Reject"
2. Confirm dialog
3. User status changes to "inactive"

##### B. User List View

**What You'll See:**

- Table of all users (excluding pending)
- Columns: Name, Email, Roles, Department, Status, Projects, Actions

**Features:**

- 🔍 Search by name or email
- 🎛️ Filter by status (Active, Pending, Inactive)
- 🎛️ Filter by role (12 roles)
- 📄 Pagination (10/25/50/100 per page)
- 🔄 Real-time updates (changes appear instantly)

##### C. Edit User

**Actions:**

1. Click pencil icon on any user
2. Edit dialog opens
3. Can change:
   - Display Name
   - Phone/Mobile
   - Job Title
   - Roles (multi-select)
   - Department
   - Status
4. Click "Save Changes"
5. User document updates in Firestore
6. Changes appear immediately in table

---

## ⚠️ Current Limitations

### Custom Claims Don't Auto-Update

**Issue**: When you approve a user or change their roles, custom claims are NOT automatically updated.

**Why**: Cloud Functions not yet implemented (coming next)

**Workaround**:

1. Manually set custom claims in Firebase Console
2. Or use Firebase Admin SDK
3. User needs to sign out and back in to get new claims

### Example Manual Claims Update (Firebase Admin SDK):

```javascript
admin.auth().setCustomUserClaims(uid, {
  roles: ['SUPER_ADMIN'],
  permissions: 2147483647, // All permissions
  domain: 'internal',
});
```

---

## 🐛 Troubleshooting

### "Access Denied" on /dashboard/users

**Cause**: Your user doesn't have MANAGE_USERS permission (permission bit 1)

**Fix**: Manually set custom claims for your user:

```javascript
{
  roles: ['SUPER_ADMIN'],
  permissions: 2147483647, // All permissions
  domain: 'internal'
}
```

### "No users found" in table

**Cause**: No users in Firestore `users` collection

**Fix**: Sign in with Google to create first user document

### Firestore permission denied errors

**Cause**: Security rules not deployed

**Fix**: Run `firebase deploy --only firestore:rules`

### "Pop-up blocked" on Google Sign-In

**Cause**: Browser blocking pop-ups

**Fix**: Allow pop-ups for localhost:3000

---

## 📊 Database Structure

### Users Collection (`users`)

```javascript
{
  uid: "firebase_uid",
  email: "user@vapourdesal.com",
  displayName: "John Doe",
  photoURL: "https://...",
  roles: ["SUPER_ADMIN"],
  department: "ENGINEERING",
  jobTitle: "Senior Engineer",
  status: "active", // or "pending" or "inactive"
  isActive: true,
  assignedProjects: [],
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

### Custom Claims (Set by Cloud Functions)

```javascript
{
  roles: ["SUPER_ADMIN"],
  permissions: 2147483647, // Bitwise permissions
  domain: "internal" // or "external"
}
```

---

## 🎯 Next Steps After Testing

Once you've tested the current features:

1. **Implement Cloud Functions** - Auto-set custom claims on user approval/role change
2. **Notification Center** - Bell icon in top bar for in-app notifications
3. **Invitation System** - Invite external CLIENT_PM users via email
4. **Complete Phase 3** - End-to-end user management working

---

## 💡 Tips

- Open browser DevTools (F12) to see console logs
- Check Network tab for Firebase API calls
- Firestore data visible at: https://console.firebase.google.com/project/vapour-toolbox/firestore
- Authentication logs: https://console.firebase.google.com/project/vapour-toolbox/authentication/users

---

## 🆘 Need Help?

If you encounter issues:

1. Check browser console for errors
2. Check Firestore rules are deployed
3. Verify Google Sign-In is enabled
4. Ensure your email domain is @vapourdesal.com (or added to NEXT_PUBLIC_ALLOWED_CLIENT_DOMAINS)
