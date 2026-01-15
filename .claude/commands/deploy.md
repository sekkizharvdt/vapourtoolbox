# Deploy

Deploy to Firebase hosting and functions.

## Arguments

- `$ARGUMENTS` - Optional: "hosting", "functions", "rules", or "all" (default: all)

## Steps

1. Before deploying, ensure build passes:
   - Run `/build` skill first

2. Deploy based on arguments:

   **Hosting only:**

   ```bash
   firebase deploy --only hosting
   ```

   **Functions only:**

   ```bash
   firebase deploy --only functions
   ```

   **Firestore rules:**

   ```bash
   firebase deploy --only firestore:rules
   ```

   **Firestore indexes:**

   ```bash
   firebase deploy --only firestore:indexes
   ```

   **All (default):**

   ```bash
   firebase deploy
   ```

3. After deployment:
   - Verify the deployment worked by checking the live site
   - Check function logs if functions were deployed:
     ```bash
     firebase functions:log --only functionName
     ```

4. If deployment fails:
   - Check for missing environment variables
   - Verify Firebase project is correct
   - Check for permission issues
