# New Service

Create a new Firestore service following codebase patterns.

## Arguments

- `$ARGUMENTS` - Required: service name (e.g., "paymentPlanning" or "recurring-transaction")

## Steps

1. Create the service file at `apps/web/src/lib/{module}/{serviceName}Service.ts`

2. Follow this pattern:

   ```typescript
   /**
    * Service Name Service
    *
    * Description of what this service handles.
    */

   import {
     Firestore,
     collection,
     doc,
     getDoc,
     getDocs,
     addDoc,
     updateDoc,
     deleteDoc,
     query,
     where,
     orderBy,
     Timestamp,
     writeBatch,
   } from 'firebase/firestore';
   import { COLLECTIONS } from '@vapour/firebase';
   import { createLogger } from '@vapour/logger';
   import { docToTyped } from '@/lib/firebase/typeHelpers';
   import type { YourType } from '@vapour/types';

   const logger = createLogger('serviceName');

   // Get single document
   export async function getItem(db: Firestore, id: string): Promise<YourType | null> {
     const docRef = doc(db, COLLECTIONS.YOUR_COLLECTION, id);
     const snapshot = await getDoc(docRef);

     if (!snapshot.exists()) {
       return null;
     }

     return docToTyped<YourType>(snapshot.id, snapshot.data());
   }

   // List documents with filters
   export async function listItems(
     db: Firestore,
     filters?: { status?: string }
   ): Promise<YourType[]> {
     const constraints = [];

     if (filters?.status) {
       constraints.push(where('status', '==', filters.status));
     }

     constraints.push(orderBy('createdAt', 'desc'));

     const q = query(collection(db, COLLECTIONS.YOUR_COLLECTION), ...constraints);
     const snapshot = await getDocs(q);

     return snapshot.docs.map((doc) => docToTyped<YourType>(doc.id, doc.data()));
   }

   // Create document
   export async function createItem(
     db: Firestore,
     data: Omit<YourType, 'id' | 'createdAt' | 'updatedAt'>,
     userId: string
   ): Promise<string> {
     const now = Timestamp.now();

     const docRef = await addDoc(collection(db, COLLECTIONS.YOUR_COLLECTION), {
       ...data,
       createdAt: now,
       updatedAt: now,
       createdBy: userId,
       updatedBy: userId,
     });

     logger.info('Created item', { id: docRef.id });
     return docRef.id;
   }
   ```

3. Add collection constant to `packages/firebase/src/collections.ts`:

   ```typescript
   YOUR_COLLECTION: 'yourCollection',
   ```

4. Add types to `packages/types/src/yourType.ts` and export from `packages/types/src/index.ts`

5. Create test file at `apps/web/src/lib/{module}/{serviceName}Service.test.ts`

6. Add Firestore indexes to `firestore.indexes.json` if needed for compound queries.
