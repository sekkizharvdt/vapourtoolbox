/**
 * Reconciliation Data Hook
 *
 * Manages data loading for reconciliation workspace
 */

import { useState, useEffect } from 'react';
import { getFirebase } from '@/lib/firebase';
import { doc, getDoc, collection, query, where, onSnapshot } from 'firebase/firestore';
import type { BankStatement, BankTransaction, MatchSuggestion } from '@vapour/types';
import {
  getUnmatchedAccountingTransactions,
  getSuggestedMatches,
  getReconciliationStats,
} from '@/lib/accounting/bankReconciliationService';

export interface ReconciliationStats {
  reconciledCount: number;
  totalCount: number;
  percentage: number;
}

export interface ReconciliationData {
  statement: BankStatement | null;
  bankTransactions: BankTransaction[];
  accountingTransactions: unknown[];
  suggestions: MatchSuggestion[];
  stats: ReconciliationStats;
  loading: boolean;
  error: string;
  refreshData: () => void;
}

export function useReconciliationData(statementId: string): ReconciliationData {
  const [statement, setStatement] = useState<BankStatement | null>(null);
  const [bankTransactions, setBankTransactions] = useState<BankTransaction[]>([]);
  const [accountingTransactions, setAccountingTransactions] = useState<unknown[]>([]);
  const [suggestions, setSuggestions] = useState<MatchSuggestion[]>([]);
  const [stats, setStats] = useState<ReconciliationStats>({
    reconciledCount: 0,
    totalCount: 0,
    percentage: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Load statement and transactions
  useEffect(() => {
    let unsubscribe: (() => void) | undefined;

    async function loadData(): Promise<void> {
      try {
        const { db } = getFirebase();

        // Load statement
        const statementDoc = await getDoc(doc(db, 'bankStatements', statementId));
        if (!statementDoc.exists()) {
          setError('Bank statement not found');
          setLoading(false);
          return;
        }
        const statementData = {
          id: statementDoc.id,
          ...statementDoc.data(),
        } as unknown as BankStatement;
        setStatement(statementData);

        // Load bank transactions (real-time)
        const bankTxnRef = collection(db, 'bankTransactions');
        const bankQ = query(bankTxnRef, where('statementId', '==', statementId));
        unsubscribe = onSnapshot(bankQ, (snapshot) => {
          const txns: BankTransaction[] = [];
          snapshot.forEach((doc) => {
            txns.push({ id: doc.id, ...doc.data() } as unknown as BankTransaction);
          });
          setBankTransactions(txns);
        });

        // Load accounting transactions
        const accTxns = await getUnmatchedAccountingTransactions(
          db,
          statementData.accountId,
          statementData.startDate,
          statementData.endDate
        );
        setAccountingTransactions(accTxns);

        // Load suggested matches
        const matchSuggestions = await getSuggestedMatches(db, statementId);
        setSuggestions(matchSuggestions);

        // Load stats
        const reconciliationStats = await getReconciliationStats(db, statementId);
        setStats({
          reconciledCount: reconciliationStats.reconciledBankTransactions,
          totalCount: reconciliationStats.totalBankTransactions,
          percentage: reconciliationStats.percentageComplete,
        });

        setLoading(false);
      } catch (err) {
        console.error('[useReconciliationData] Error loading data:', err);
        setError('Failed to load reconciliation data');
        setLoading(false);
      }
    }

    loadData();

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [statementId]);

  // Refresh stats when transactions change
  useEffect(() => {
    async function refreshStats() {
      if (!statement) return;
      try {
        const { db } = getFirebase();
        const reconciliationStats = await getReconciliationStats(db, statementId);
        setStats({
          reconciledCount: reconciliationStats.reconciledBankTransactions,
          totalCount: reconciliationStats.totalBankTransactions,
          percentage: reconciliationStats.percentageComplete,
        });
      } catch (err) {
        console.error('[useReconciliationData] Error refreshing stats:', err);
      }
    }
    refreshStats();
  }, [bankTransactions, statementId, statement]);

  const refreshData = () => {
    setLoading(true);
    // Trigger reload by clearing and letting useEffect re-run
    setStatement(null);
  };

  return {
    statement,
    bankTransactions,
    accountingTransactions,
    suggestions,
    stats,
    loading,
    error,
    refreshData,
  };
}
