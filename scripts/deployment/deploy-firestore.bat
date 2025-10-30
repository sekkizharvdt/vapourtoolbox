@echo off
echo Deploying Firestore Security Rules...
firebase deploy --only firestore:rules
echo.
echo Rules deployed successfully!
pause
