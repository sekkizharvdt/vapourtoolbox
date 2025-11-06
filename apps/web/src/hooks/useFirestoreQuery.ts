/**
 * Custom hook for Firestore real-time queries
 *
 * Eliminates boilerplate code for:
 * - Setting up onSnapshot listeners
 * - Managing loading states
 * - Handling errors
 * - Automatic cleanup on unmount
 *
 * @example
 * ```tsx
 * const { data, loading, error } = useFirestoreQuery<Invoice>(
 *   query(collection(db, 'transactions'), where('type', '==', 'CUSTOMER_INVOICE'))
 * );
 * ```
 */

import { useEffect, useState } from 'react';
import { onSnapshot, type Query, type DocumentData } from 'firebase/firestore';

interface UseFirestoreQueryResult<T> {
  data: T[];
  loading: boolean;
  error: Error | null;
}

export function useFirestoreQuery<T = DocumentData>(
  firestoreQuery: Query<DocumentData> | null,
  options?: {
    /**
     * Transform function to customize how documents are mapped
     * Default: { id: doc.id, ...doc.data() }
     */
    transform?: (doc: { id: string; data: DocumentData }) => T;

    /**
     * Whether to start listening immediately
     * Default: true
     */
    enabled?: boolean;
  }
): UseFirestoreQueryResult<T> {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const { transform, enabled = true } = options || {};

  useEffect(() => {
    // Don't subscribe if query is null or disabled
    if (!firestoreQuery || !enabled) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    // Set up real-time listener
    const unsubscribe = onSnapshot(
      firestoreQuery,
      (snapshot) => {
        try {
          const documents = snapshot.docs.map((doc) => {
            if (transform) {
              return transform({ id: doc.id, data: doc.data() });
            }
            return { id: doc.id, ...doc.data() } as T;
          });

          setData(documents);
          setLoading(false);
        } catch (err) {
          setError(err instanceof Error ? err : new Error('Unknown error'));
          setLoading(false);
        }
      },
      (err) => {
        console.error('[useFirestoreQuery] Listener error:', err);
        setError(err instanceof Error ? err : new Error('Firestore listener error'));
        setLoading(false);
      }
    );

    // Cleanup listener on unmount
    return () => {
      unsubscribe();
    };
  }, [firestoreQuery, transform, enabled]);

  return { data, loading, error };
}

/**
 * Custom hook for a single Firestore document
 *
 * @example
 * ```tsx
 * const { data, loading, error } = useFirestoreDocument<User>(
 *   doc(db, 'users', userId)
 * );
 * ```
 */
export function useFirestoreDocument<T = DocumentData>(
  firestoreDoc: any, // DocumentReference
  options?: {
    transform?: (doc: { id: string; data: DocumentData }) => T;
    enabled?: boolean;
  }
): { data: T | null; loading: boolean; error: Error | null } {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const { transform, enabled = true } = options || {};

  useEffect(() => {
    if (!firestoreDoc || !enabled) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const unsubscribe = onSnapshot(
      firestoreDoc,
      (snapshot: any) => {
        try {
          if (!snapshot.exists()) {
            setData(null);
            setLoading(false);
            return;
          }

          if (transform) {
            setData(transform({ id: snapshot.id, data: snapshot.data() }));
          } else {
            setData({ id: snapshot.id, ...snapshot.data() } as T);
          }
          setLoading(false);
        } catch (err) {
          setError(err instanceof Error ? err : new Error('Unknown error'));
          setLoading(false);
        }
      },
      (err: Error) => {
        console.error('[useFirestoreDocument] Listener error:', err);
        setError(err instanceof Error ? err : new Error('Firestore listener error'));
        setLoading(false);
      }
    );

    return () => {
      unsubscribe();
    };
  }, [firestoreDoc, transform, enabled]);

  return { data, loading, error };
}
