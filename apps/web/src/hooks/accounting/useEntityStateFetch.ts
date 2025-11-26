import { useState, useEffect } from 'react';
import { getDoc, doc } from 'firebase/firestore';
import { getFirebase } from '@/lib/firebase';
import { COLLECTIONS } from '@vapour/firebase';

interface UseEntityStateFetchReturn {
  /**
   * Company's state code (e.g., '29' for Karnataka)
   */
  companyState: string;
  /**
   * Entity's (customer/vendor) state code
   */
  entityState: string;
  /**
   * Entity's name
   */
  entityName: string;
  /**
   * Loading state for company data
   */
  isLoadingCompany: boolean;
  /**
   * Loading state for entity data
   */
  isLoadingEntity: boolean;
  /**
   * Error fetching company data
   */
  companyError: string | null;
  /**
   * Error fetching entity data
   */
  entityError: string | null;
  /**
   * Manually update entity name (used when entity is selected)
   */
  setEntityName: (name: string) => void;
}

/**
 * Custom hook for fetching company and entity state information from Firestore.
 * Used for GST calculation which requires knowing if transaction is intra-state or inter-state.
 *
 * @param entityId - The ID of the customer or vendor entity
 *
 * @example
 * ```tsx
 * const { companyState, entityState, entityName } = useEntityStateFetch(selectedEntityId);
 *
 * // Use in GST calculation
 * const { gstDetails } = useGSTCalculation({
 *   lineItems,
 *   subtotal,
 *   companyState,
 *   entityState,
 * });
 * ```
 */
export function useEntityStateFetch(entityId: string | null): UseEntityStateFetchReturn {
  const [companyState, setCompanyState] = useState<string>('');
  const [entityState, setEntityState] = useState<string>('');
  const [entityName, setEntityName] = useState<string>('');
  const [isLoadingCompany, setIsLoadingCompany] = useState<boolean>(true);
  const [isLoadingEntity, setIsLoadingEntity] = useState<boolean>(false);
  const [companyError, setCompanyError] = useState<string | null>(null);
  const [entityError, setEntityError] = useState<string | null>(null);

  // Fetch company state on mount (only once)
  useEffect(() => {
    let isMounted = true;

    async function fetchCompanyState() {
      try {
        setIsLoadingCompany(true);
        setCompanyError(null);

        const { db } = getFirebase();
        // Note: Company settings are stored in 'company/settings', not 'companies/settings'
        const companyDoc = await getDoc(doc(db, 'company', 'settings'));

        if (!isMounted) return;

        if (companyDoc.exists()) {
          const data = companyDoc.data();
          setCompanyState(data.address?.state || '');
        } else {
          setCompanyError('Company settings not found');
        }
      } catch (error) {
        if (!isMounted) return;
        console.error('Error fetching company state:', error);
        setCompanyError('Failed to fetch company details');
      } finally {
        if (isMounted) {
          setIsLoadingCompany(false);
        }
      }
    }

    fetchCompanyState();

    return () => {
      isMounted = false;
    };
  }, []);

  // Fetch entity state when entityId changes
  useEffect(() => {
    // Reset entity state when no entity is selected
    if (!entityId) {
      setEntityState('');
      setEntityName('');
      setEntityError(null);
      setIsLoadingEntity(false);
      return;
    }

    let isMounted = true;

    async function fetchEntityState() {
      try {
        setIsLoadingEntity(true);
        setEntityError(null);

        const { db } = getFirebase();
        const entityDoc = await getDoc(doc(db, COLLECTIONS.ENTITIES, entityId!));

        if (!isMounted) return;

        if (entityDoc.exists()) {
          const data = entityDoc.data();
          setEntityName(data.name || '');
          setEntityState(data.billingAddress?.state || '');
        } else {
          setEntityError('Entity not found');
          setEntityName('');
          setEntityState('');
        }
      } catch (error) {
        if (!isMounted) return;
        console.error('Error fetching entity state:', error);
        setEntityError('Failed to fetch entity details');
        setEntityName('');
        setEntityState('');
      } finally {
        if (isMounted) {
          setIsLoadingEntity(false);
        }
      }
    }

    fetchEntityState();

    return () => {
      isMounted = false;
    };
  }, [entityId]);

  return {
    companyState,
    entityState,
    entityName,
    isLoadingCompany,
    isLoadingEntity,
    companyError,
    entityError,
    setEntityName,
  };
}
