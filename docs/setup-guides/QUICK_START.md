# 🚀 Quick Start Guide

## ✅ Prerequisites (Already Done!)
- ✅ Firebase project created: `vapour-toolbox`
- ✅ Google Authentication enabled
- ✅ Environment variables configured: `apps/web/.env.local`

---

## 🏃 Start Testing in 3 Steps

### Step 1: Deploy Firestore Rules (One-Time Setup)

Open Command Prompt and run:

```bash
cd C:\Users\sekki\VDT-Unified

# Login to Firebase (if not logged in)
firebase login

# Deploy rules
firebase deploy --only firestore:rules
```

**OR** Double-click: `deploy-firestore.bat`

### Step 2: Start Development Server

```bash
cd C:\Users\sekki\VDT-Unified\apps\web
pnpm dev
```

Wait for:
```
ready - started server on 0.0.0.0:3000, url: http://localhost:3000
```

### Step 3: Open Browser

Navigate to: **http://localhost:3000**

---

## 🎯 First Time Login

1. You'll see the login page
2. Click **"Sign in with Google"**
3. Choose your **@vapourdesal.com** account
4. You'll be redirected to **"/pending-approval"** page
5. You're stuck here until an admin approves you!

---

## 👨‍💼 Approve Your First User (Manual)

Since you don't have an admin yet, you need to manually approve yourself:

### Option A: Using Firebase Console (Easiest)

1. Go to: https://console.firebase.google.com/project/vapour-toolbox/firestore
2. Find the `users` collection
3. Click on your user document (your UID)
4. Click "Edit" (pencil icon)
5. Change these fields:
   ```json
   {
     "status": "active",
     "isActive": true,
     "roles": ["SUPER_ADMIN"],
     "department": "MANAGEMENT"
   }
   ```
6. Click "Update"

### Option B: Set Custom Claims (Best)

Open Firebase Console and go to Authentication → Users → Click on your user → Then run this in Firebase Admin SDK or Functions:

```javascript
admin.auth().setCustomUserClaims('YOUR_USER_UID', {
  roles: ['SUPER_ADMIN'],
  permissions: 2147483647, // All permissions (bitwise)
  domain: 'internal'
});
```

**After setting claims:**
1. Sign out from the app
2. Sign back in
3. You should now have full access!

---

## 🎉 Test User Management Features

Once you're logged in with admin access:

### Go to User Management
Navigate to: **http://localhost:3000/dashboard/users**

### What You Can Do:

#### 1. View All Users
- See list of all users in real-time
- Search by name or email
- Filter by status (Active, Pending, Inactive)
- Filter by role

#### 2. Approve Pending Users ⭐
- Yellow banner shows users awaiting approval
- Click "Review & Approve"
- Set job title, roles, department
- Click "Approve User"

#### 3. Edit Existing Users
- Click pencil icon on any user
- Change name, phone, roles, department, status
- Click "Save Changes"

#### 4. Create Test Users
To test approval flow:
1. Open incognito window
2. Go to http://localhost:3000
3. Sign in with different @vapourdesal.com account
4. They'll be pending
5. Go back to admin window
6. Approve them!

---

## 📊 What's Working vs What's Not

### ✅ Working Now:
- Google OAuth login
- Domain validation (@vapourdesal.com only)
- Pending approval page
- User list view with search/filters
- Edit user details
- Approve/Reject pending users
- Real-time updates

### ⚠️ Not Yet Working (Coming Soon):
- **Custom claims auto-update** (Cloud Functions needed)
  - When you approve a user, their claims don't auto-update
  - You need to manually set claims OR wait for Cloud Functions

- **In-app notifications** (UI coming next)
  - Users won't get notified when approved

- **Invitation system** (Coming next)
  - Can't invite external CLIENT_PM users yet

---

## 🐛 Common Issues

### Issue: "Access Denied" on /dashboard/users
**Solution**: Your user needs MANAGE_USERS permission. Manually set custom claims as shown above.

### Issue: Can't see pending users
**Solution**: Have another user sign in (in incognito mode) to create a pending user.

### Issue: Changes don't save
**Solution**: Check browser console (F12) for errors. Verify Firestore rules are deployed.

### Issue: "Unauthorized domain" error
**Solution**: Make sure you're using @vapourdesal.com email. To allow other domains, add them to `NEXT_PUBLIC_ALLOWED_CLIENT_DOMAINS` in `.env.local`

---

## 📱 Development URLs

- **Login**: http://localhost:3000/login
- **Dashboard**: http://localhost:3000/dashboard
- **User Management**: http://localhost:3000/dashboard/users
- **Pending Approval**: http://localhost:3000/pending-approval

---

## 🔍 Debugging

### Check Firebase Console:
- **Firestore Data**: https://console.firebase.google.com/project/vapour-toolbox/firestore
- **Authentication**: https://console.firebase.google.com/project/vapour-toolbox/authentication
- **Rules**: https://console.firebase.google.com/project/vapour-toolbox/firestore/rules

### Check Browser Console:
- Press F12
- Go to Console tab
- Look for errors or warnings

### Check Network Requests:
- Press F12
- Go to Network tab
- Look for failed Firebase API calls

---

## 🎯 Next Steps

Once you've tested the basic user management:

1. **Cloud Functions** - Auto-set custom claims
2. **Notification Center** - In-app notifications
3. **Invitation System** - Invite external users
4. **Project Assignment** - Assign users to projects
5. **Entity Management** - Manage vendors/customers
6. **Project Management** - Create and manage projects

---

## 💡 Pro Tips

- Keep Firebase Console open while testing
- Use incognito windows to test multi-user scenarios
- Check Firestore data in real-time as you make changes
- Use browser DevTools to debug issues
- Real-time updates mean you don't need to refresh the page!

---

## 🆘 Need Help?

Refer to: `TESTING_GUIDE.md` for detailed testing instructions.

---

**You're all set! Start the dev server and test the app! 🚀**
