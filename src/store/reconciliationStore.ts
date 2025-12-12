import { create } from 'zustand';
import { Payment, Expectation, Match, ReconciliationStatistics, PaymentFilters, ExpectationFilters } from '@/types/reconciliation';
import { mockPayments, mockExpectations, mockMatches } from '@/data/mockData';

interface ReconciliationStore {
  // Data
  payments: Payment[];
  expectations: Expectation[];
  matches: Match[];
  
  // Selection state
  selectedPaymentId: string | null;
  pendingMatchExpectationIds: string[];
  
  // Filters
  paymentFilters: PaymentFilters;
  expectationFilters: ExpectationFilters;
  
  // Settings
  tolerance: number;
  autoAdvanceToNext: boolean;
  
  // Statistics
  statistics: ReconciliationStatistics;
  
  // Actions
  selectPayment: (paymentId: string | null) => void;
  toggleExpectationSelection: (expectationId: string) => void;
  clearPendingSelections: () => void;
  confirmMatch: (notes?: string) => void;
  autoMatchCurrentPayment: () => void;
  setTolerance: (tolerance: number) => void;
  setPaymentFilters: (filters: Partial<PaymentFilters>) => void;
  setExpectationFilters: (filters: Partial<ExpectationFilters>) => void;
  markPaymentReconciled: (paymentId: string, notes?: string) => void;
  
  // Derived getters
  getSelectedPayment: () => Payment | null;
  getRelevantExpectations: () => Expectation[];
  getPendingMatchTotal: () => number;
  getVariance: () => { amount: number; percentage: number; quality: 'perfect' | 'good' | 'acceptable' | 'warning' };
}

const calculateStatistics = (payments: Payment[], expectations: Expectation[], matches: Match[]): ReconciliationStatistics => {
  const totalPayments = payments.length;
  const reconciledPayments = payments.filter(p => p.status === 'reconciled').length;
  const inProgressPayments = payments.filter(p => p.status === 'in_progress').length;
  const unreconciledPayments = payments.filter(p => p.status === 'unreconciled').length;
  const totalPaymentAmount = payments.reduce((sum, p) => sum + p.amount, 0);
  const totalReconciledAmount = payments.reduce((sum, p) => sum + p.reconciledAmount, 0);
  
  const totalExpectations = expectations.length;
  const matchedExpectations = expectations.filter(e => e.status === 'matched').length;
  const partialExpectations = expectations.filter(e => e.status === 'partial').length;
  const unmatchedExpectations = expectations.filter(e => e.status === 'unmatched').length;
  const totalExpectedAmount = expectations.reduce((sum, e) => sum + e.expectedAmount, 0);
  
  const overallMatchPercentage = totalPaymentAmount > 0 ? (totalReconciledAmount / totalPaymentAmount) * 100 : 0;
  
  const confirmedMatches = matches.filter(m => m.confirmed);
  const averageVariancePercentage = confirmedMatches.length > 0
    ? confirmedMatches.reduce((sum, m) => sum + Math.abs(m.variancePercentage), 0) / confirmedMatches.length
    : 0;
  
  return {
    totalPayments,
    reconciledPayments,
    inProgressPayments,
    unreconciledPayments,
    totalPaymentAmount,
    totalReconciledAmount,
    totalExpectations,
    matchedExpectations,
    partialExpectations,
    unmatchedExpectations,
    totalExpectedAmount,
    overallMatchPercentage,
    averageVariancePercentage
  };
};

export const useReconciliationStore = create<ReconciliationStore>((set, get) => ({
  // Initialize with mock data
  payments: mockPayments,
  expectations: mockExpectations,
  matches: mockMatches,
  
  selectedPaymentId: null,
  pendingMatchExpectationIds: [],
  
  paymentFilters: {
    searchTerm: '',
    status: 'all',
    provider: null
  },
  
  expectationFilters: {
    searchTerm: '',
    status: 'all'
  },
  
  tolerance: 5, // 5% default tolerance
  autoAdvanceToNext: true,
  
  statistics: calculateStatistics(mockPayments, mockExpectations, mockMatches),
  
  selectPayment: (paymentId) => {
    set({ selectedPaymentId: paymentId, pendingMatchExpectationIds: [] });
  },
  
  toggleExpectationSelection: (expectationId) => {
    const { pendingMatchExpectationIds } = get();
    if (pendingMatchExpectationIds.includes(expectationId)) {
      set({ pendingMatchExpectationIds: pendingMatchExpectationIds.filter(id => id !== expectationId) });
    } else {
      set({ pendingMatchExpectationIds: [...pendingMatchExpectationIds, expectationId] });
    }
  },
  
  clearPendingSelections: () => {
    set({ pendingMatchExpectationIds: [] });
  },
  
  confirmMatch: (notes = '') => {
    const { selectedPaymentId, pendingMatchExpectationIds, payments, expectations, matches, tolerance } = get();
    
    if (!selectedPaymentId || pendingMatchExpectationIds.length === 0) return;
    
    const payment = payments.find(p => p.id === selectedPaymentId);
    if (!payment) return;
    
    const selectedExpectations = expectations.filter(e => pendingMatchExpectationIds.includes(e.id));
    const matchedAmount = selectedExpectations.reduce((sum, e) => sum + e.expectedAmount, 0);
    const variance = matchedAmount - (payment.remainingAmount || payment.amount);
    const variancePercentage = (variance / (payment.remainingAmount || payment.amount)) * 100;
    
    // Determine match quality
    let quality: 'perfect' | 'good' | 'acceptable' | 'warning' = 'warning';
    const absVariance = Math.abs(variancePercentage);
    if (absVariance === 0) quality = 'perfect';
    else if (absVariance <= 2) quality = 'good';
    else if (absVariance <= tolerance) quality = 'acceptable';
    
    // Create match record
    const newMatch: Match = {
      id: Math.random().toString(36).substring(2, 11),
      paymentId: selectedPaymentId,
      expectationIds: pendingMatchExpectationIds,
      matchedAmount,
      variance,
      variancePercentage,
      matchType: pendingMatchExpectationIds.length > 1 ? 'multi' : 'full',
      matchMethod: 'manual',
      matchQuality: quality,
      notes,
      matchedBy: 'Current User',
      matchedAt: new Date().toISOString(),
      confirmed: true,
      details: selectedExpectations.map(e => ({
        expectationId: e.id,
        amountAllocated: e.expectedAmount
      }))
    };
    
    // Update expectations
    const updatedExpectations = expectations.map(e => {
      if (pendingMatchExpectationIds.includes(e.id)) {
        return {
          ...e,
          status: 'matched' as const,
          allocatedAmount: e.expectedAmount,
          remainingAmount: 0,
          matchedToPayments: [...e.matchedToPayments, {
            paymentId: selectedPaymentId,
            amount: e.expectedAmount,
            matchId: newMatch.id
          }]
        };
      }
      return e;
    });
    
    // Update payment
    const newReconciledAmount = payment.reconciledAmount + matchedAmount;
    const newRemainingAmount = payment.amount - newReconciledAmount;
    const newStatus = Math.abs(newRemainingAmount) < 1 ? 'reconciled' : 'in_progress';
    
    const updatedPayments = payments.map(p => {
      if (p.id === selectedPaymentId) {
        return {
          ...p,
          reconciledAmount: newReconciledAmount,
          remainingAmount: newRemainingAmount,
          status: newStatus as Payment['status'],
          matchedExpectationIds: [...p.matchedExpectationIds, ...pendingMatchExpectationIds]
        };
      }
      return p;
    });
    
    const updatedMatches = [...matches, newMatch];
    
    set({
      payments: updatedPayments,
      expectations: updatedExpectations,
      matches: updatedMatches,
      pendingMatchExpectationIds: [],
      statistics: calculateStatistics(updatedPayments, updatedExpectations, updatedMatches)
    });
  },
  
  autoMatchCurrentPayment: () => {
    const { selectedPaymentId, payments, expectations, tolerance } = get();
    if (!selectedPaymentId) return;
    
    const payment = payments.find(p => p.id === selectedPaymentId);
    if (!payment) return;
    
    // Find unmatched expectations for this provider within tolerance
    const relevantExpectations = expectations.filter(e => 
      e.providerName === payment.providerName && 
      e.status === 'unmatched'
    );
    
    // Simple auto-match: find expectations that sum close to remaining amount
    let remaining = payment.remainingAmount;
    const toMatch: string[] = [];
    
    // Sort by expected amount descending for greedy matching
    const sorted = [...relevantExpectations].sort((a, b) => b.expectedAmount - a.expectedAmount);
    
    for (const exp of sorted) {
      if (exp.expectedAmount <= remaining * (1 + tolerance / 100)) {
        toMatch.push(exp.id);
        remaining -= exp.expectedAmount;
        if (remaining <= 0) break;
      }
    }
    
    if (toMatch.length > 0) {
      set({ pendingMatchExpectationIds: toMatch });
    }
  },
  
  setTolerance: (tolerance) => {
    set({ tolerance });
  },
  
  setPaymentFilters: (filters) => {
    set(state => ({ paymentFilters: { ...state.paymentFilters, ...filters } }));
  },
  
  setExpectationFilters: (filters) => {
    set(state => ({ expectationFilters: { ...state.expectationFilters, ...filters } }));
  },
  
  markPaymentReconciled: (paymentId, notes = '') => {
    const { payments, expectations, matches } = get();
    
    const updatedPayments = payments.map(p => {
      if (p.id === paymentId) {
        return {
          ...p,
          status: 'reconciled' as const,
          notes: notes || p.notes,
          reconciledAt: new Date().toISOString(),
          reconciledBy: 'Current User'
        };
      }
      return p;
    });
    
    set({
      payments: updatedPayments,
      statistics: calculateStatistics(updatedPayments, expectations, matches)
    });
  },
  
  getSelectedPayment: () => {
    const { payments, selectedPaymentId } = get();
    return payments.find(p => p.id === selectedPaymentId) || null;
  },
  
  getRelevantExpectations: () => {
    const { expectations, payments, selectedPaymentId, expectationFilters } = get();
    const payment = payments.find(p => p.id === selectedPaymentId);
    
    if (!payment) return [];
    
    let filtered = expectations.filter(e => e.providerName === payment.providerName);
    
    if (expectationFilters.searchTerm) {
      const term = expectationFilters.searchTerm.toLowerCase();
      filtered = filtered.filter(e => 
        e.clientName.toLowerCase().includes(term) ||
        e.planReference.toLowerCase().includes(term)
      );
    }
    
    if (expectationFilters.status !== 'all') {
      filtered = filtered.filter(e => e.status === expectationFilters.status);
    }
    
    return filtered;
  },
  
  getPendingMatchTotal: () => {
    const { expectations, pendingMatchExpectationIds } = get();
    return expectations
      .filter(e => pendingMatchExpectationIds.includes(e.id))
      .reduce((sum, e) => sum + e.expectedAmount, 0);
  },
  
  getVariance: () => {
    const { selectedPaymentId, payments, pendingMatchExpectationIds, expectations, tolerance } = get();
    const payment = payments.find(p => p.id === selectedPaymentId);
    
    if (!payment || pendingMatchExpectationIds.length === 0) {
      return { amount: 0, percentage: 0, quality: 'warning' as const };
    }
    
    const selectedTotal = expectations
      .filter(e => pendingMatchExpectationIds.includes(e.id))
      .reduce((sum, e) => sum + e.expectedAmount, 0);
    
    const target = payment.remainingAmount > 0 ? payment.remainingAmount : payment.amount;
    const variance = selectedTotal - target;
    const percentage = (variance / target) * 100;
    
    let quality: 'perfect' | 'good' | 'acceptable' | 'warning' = 'warning';
    const absPercentage = Math.abs(percentage);
    if (absPercentage < 0.1) quality = 'perfect';
    else if (absPercentage <= 2) quality = 'good';
    else if (absPercentage <= tolerance) quality = 'acceptable';
    
    return { amount: variance, percentage, quality };
  }
}));
