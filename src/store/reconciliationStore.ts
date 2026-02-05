import { create } from 'zustand';
import { Payment, PaymentLineItem, Expectation, Match, PendingMatch, ReconciliationStatistics, PaymentFilters, ExpectationFilters } from '@/types/reconciliation';

interface ReconciliationStore {
  isLoadingData: boolean;
  dataError: string | null;
  
  // Data
  payments: Payment[];
  expectations: Expectation[];
  matches: Match[];
  
  // Selection state
  selectedPaymentId: string | null;
  pendingMatches: PendingMatch[];
  
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
  addPendingMatch: (lineItemId: string, expectationId: string) => void;
  removePendingMatch: (lineItemId: string) => void;
  clearPendingMatches: () => void;
  confirmPendingMatches: (notes: string) => void;
  autoMatchCurrentPayment: () => void;
  markLineItemApprovedUnmatched: (lineItemId: string, notes: string) => void;
  markPaymentFullyReconciled: (notes: string) => void;
  invalidateExpectation: (expectationId: string, reason: string) => void;
  setTolerance: (tolerance: number) => void;
  setPaymentFilters: (filters: Partial<PaymentFilters>) => void;
  setExpectationFilters: (filters: Partial<ExpectationFilters>) => void;
  importData: (payments: Payment[], expectations: Expectation[]) => void;
  setZohoData: (payments: Payment[], expectations: Expectation[]) => void;
  setLoadingState: (isLoading: boolean, error?: string | null) => void;
  
  // Derived getters
  getSelectedPayment: () => Payment | null;
  getRelevantExpectations: () => Expectation[];
  getPendingMatchForLineItem: (lineItemId: string) => PendingMatch | undefined;
  getPendingMatchForExpectation: (expectationId: string) => PendingMatch | undefined;
  getPendingMatchSummary: () => { 
    totalLineItemAmount: number; 
    totalExpectedAmount: number; 
    variance: number; 
    variancePercentage: number;
    allWithinTolerance: boolean;
  };
  calculateVariance: (lineItemId: string, expectationId: string) => { 
    amount: number; 
    percentage: number; 
    isWithinTolerance: boolean;
  } | null;
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
  isLoadingData: false,
  dataError: null,
  
  // Initialize empty - will be populated from Zoho
  payments: [],
  expectations: [],
  matches: [],
  
  selectedPaymentId: null,
  pendingMatches: [],
  
  paymentFilters: {
    searchTerm: '',
    status: 'all',
    provider: null
  },
  
  expectationFilters: {
    searchTerm: '',
    status: 'all',
    monthRange: 'all' // Default to show all expectations (no date filtering)
  },
  
  tolerance: 5, // 5% default tolerance
  autoAdvanceToNext: true,
  
  statistics: calculateStatistics([], [], []),
  
  selectPayment: (paymentId) => {
    set({ selectedPaymentId: paymentId, pendingMatches: [] });
  },
  
  addPendingMatch: (lineItemId: string, expectationId: string) => {
    const { selectedPaymentId, payments, expectations, pendingMatches, tolerance } = get();
    if (!selectedPaymentId) return;
    
    const payment = payments.find(p => p.id === selectedPaymentId);
    if (!payment) return;
    
    const lineItem = payment.lineItems.find(li => li.id === lineItemId);
    const expectation = expectations.find(e => e.id === expectationId);
    if (!lineItem || !expectation) return;
    
    // Check if already pending
    if (pendingMatches.some(pm => pm.lineItemId === lineItemId)) return;
    if (pendingMatches.some(pm => pm.expectationId === expectationId)) return;
    
    const variance = lineItem.amount - expectation.expectedAmount;
    const variancePercentage = expectation.expectedAmount > 0 
      ? (variance / expectation.expectedAmount) * 100 
      : 0;
    const isWithinTolerance = Math.abs(variancePercentage) <= tolerance;
    
    const newPendingMatch: PendingMatch = {
      lineItemId,
      expectationId,
      lineItemAmount: lineItem.amount,
      expectedAmount: expectation.expectedAmount,
      variance,
      variancePercentage,
      isWithinTolerance
    };
    
    set({ pendingMatches: [...pendingMatches, newPendingMatch] });
  },
  
  removePendingMatch: (lineItemId: string) => {
    const { pendingMatches } = get();
    set({ pendingMatches: pendingMatches.filter(pm => pm.lineItemId !== lineItemId) });
  },
  
  clearPendingMatches: () => {
    set({ pendingMatches: [] });
  },
  
  confirmPendingMatches: (notes: string) => {
    const { selectedPaymentId, pendingMatches, payments, expectations, matches, tolerance } = get();
    
    if (!selectedPaymentId || pendingMatches.length === 0) return;
    
    const payment = payments.find(p => p.id === selectedPaymentId);
    if (!payment) return;
    
    // Calculate totals
    const totalLineItemAmount = pendingMatches.reduce((sum, pm) => sum + pm.lineItemAmount, 0);
    const totalExpectedAmount = pendingMatches.reduce((sum, pm) => sum + pm.expectedAmount, 0);
    const totalVariance = totalLineItemAmount - totalExpectedAmount;
    const overallVariancePercentage = totalExpectedAmount > 0 
      ? (totalVariance / totalExpectedAmount) * 100 
      : 0;
    
    // Determine match quality
    let quality: 'perfect' | 'good' | 'acceptable' | 'warning' = 'warning';
    const absVariance = Math.abs(overallVariancePercentage);
    if (absVariance === 0) quality = 'perfect';
    else if (absVariance <= 2) quality = 'good';
    else if (absVariance <= tolerance) quality = 'acceptable';
    
    // Create match record
    const newMatch: Match = {
      id: Math.random().toString(36).substring(2, 11),
      paymentId: selectedPaymentId,
      expectationIds: pendingMatches.map(pm => pm.expectationId),
      matchedAmount: totalLineItemAmount,
      variance: totalVariance,
      variancePercentage: overallVariancePercentage,
      matchType: pendingMatches.length > 1 ? 'multi' : 'full',
      matchMethod: 'manual',
      matchQuality: quality,
      notes,
      matchedBy: 'Current User',
      matchedAt: new Date().toISOString(),
      confirmed: true,
      details: pendingMatches.map(pm => ({
        expectationId: pm.expectationId,
        amountAllocated: pm.lineItemAmount
      }))
    };
    
    // Update expectations
    const updatedExpectations = expectations.map(e => {
      const pendingMatch = pendingMatches.find(pm => pm.expectationId === e.id);
      if (pendingMatch) {
        return {
          ...e,
          status: 'matched' as const,
          allocatedAmount: pendingMatch.lineItemAmount,
          remainingAmount: 0,
          matchedToPayments: [...e.matchedToPayments, {
            paymentId: selectedPaymentId,
            amount: pendingMatch.lineItemAmount,
            matchId: newMatch.id
          }]
        };
      }
      return e;
    });
    
    // Update payment line items
    const updatedLineItems = payment.lineItems.map(li => {
      const pendingMatch = pendingMatches.find(pm => pm.lineItemId === li.id);
      if (pendingMatch) {
        return {
          ...li,
          status: 'matched' as const,
          matchedExpectationId: pendingMatch.expectationId,
          matchNotes: notes
        };
      }
      return li;
    });
    
    // Update payment
    const newReconciledAmount = payment.reconciledAmount + totalLineItemAmount;
    const newRemainingAmount = payment.amount - newReconciledAmount;
    const allLineItemsProcessed = updatedLineItems.every(li => li.status !== 'unmatched');
    const newStatus = allLineItemsProcessed ? 'reconciled' : 'in_progress';
    
    const updatedPayments = payments.map(p => {
      if (p.id === selectedPaymentId) {
        return {
          ...p,
          lineItems: updatedLineItems,
          reconciledAmount: newReconciledAmount,
          remainingAmount: newRemainingAmount,
          status: newStatus as Payment['status'],
          matchedExpectationIds: [...p.matchedExpectationIds, ...pendingMatches.map(pm => pm.expectationId)]
        };
      }
      return p;
    });
    
    const updatedMatches = [...matches, newMatch];
    
    set({
      payments: updatedPayments,
      expectations: updatedExpectations,
      matches: updatedMatches,
      pendingMatches: [],
      statistics: calculateStatistics(updatedPayments, updatedExpectations, updatedMatches)
    });
  },
  
  autoMatchCurrentPayment: () => {
    const { selectedPaymentId, payments, expectations, tolerance, pendingMatches } = get();
    if (!selectedPaymentId) return;
    
    const payment = payments.find(p => p.id === selectedPaymentId);
    if (!payment) return;
    
    // Get unmatched line items (not already matched or pending)
    const pendingLineItemIds = pendingMatches.map(pm => pm.lineItemId);
    const pendingExpectationIds = pendingMatches.map(pm => pm.expectationId);
    
    const unmatchedLineItems = payment.lineItems.filter(li => 
      li.status === 'unmatched' && !pendingLineItemIds.includes(li.id)
    );
    
    // Get unmatched expectations for this provider (not already matched or pending)
    const relevantExpectations = expectations.filter(e => 
      e.providerName === payment.providerName && 
      e.status === 'unmatched' &&
      !pendingExpectationIds.includes(e.id)
    );
    
    const newPendingMatches: PendingMatch[] = [...pendingMatches];
    
    // Match each line item to an expectation by plan reference
    for (const lineItem of unmatchedLineItems) {
      // Skip if already added in this loop
      if (newPendingMatches.some(pm => pm.lineItemId === lineItem.id)) continue;
      
      // Skip if line item has no plan reference - can't auto-match without it
      if (!lineItem.planReference || lineItem.planReference.trim() === '') continue;
      
      const matchingExpectation = relevantExpectations.find(e => 
        e.planReference && 
        e.planReference.trim() !== '' &&
        e.planReference === lineItem.planReference &&
        !newPendingMatches.some(pm => pm.expectationId === e.id)
      );
      
      if (matchingExpectation) {
        const variance = lineItem.amount - matchingExpectation.expectedAmount;
        const variancePercentage = matchingExpectation.expectedAmount > 0 
          ? (variance / matchingExpectation.expectedAmount) * 100 
          : 0;
        const isWithinTolerance = Math.abs(variancePercentage) <= tolerance;
        
        // Only auto-match if within tolerance
        if (isWithinTolerance) {
          newPendingMatches.push({
            lineItemId: lineItem.id,
            expectationId: matchingExpectation.id,
            lineItemAmount: lineItem.amount,
            expectedAmount: matchingExpectation.expectedAmount,
            variance,
            variancePercentage,
            isWithinTolerance
          });
        }
      }
    }
    
    if (newPendingMatches.length > pendingMatches.length) {
      set({ pendingMatches: newPendingMatches });
    }
  },
  
  markLineItemApprovedUnmatched: (lineItemId: string, notes: string) => {
    const { selectedPaymentId, payments, expectations, matches } = get();
    if (!selectedPaymentId) return;
    
    const updatedPayments = payments.map(p => {
      if (p.id === selectedPaymentId) {
        const updatedLineItems = p.lineItems.map(li => {
          if (li.id === lineItemId) {
            return {
              ...li,
              status: 'approved_unmatched' as const,
              matchNotes: notes
            };
          }
          return li;
        });
        
        return {
          ...p,
          lineItems: updatedLineItems
        };
      }
      return p;
    });
    
    set({
      payments: updatedPayments,
      statistics: calculateStatistics(updatedPayments, expectations, matches)
    });
  },
  
  markPaymentFullyReconciled: (notes: string) => {
    const { selectedPaymentId, payments, expectations, matches } = get();
    if (!selectedPaymentId) return;
    
    const updatedPayments = payments.map(p => {
      if (p.id === selectedPaymentId) {
        // Mark all unmatched line items as approved_unmatched
        const updatedLineItems = p.lineItems.map(li => {
          if (li.status === 'unmatched') {
            return {
              ...li,
              status: 'approved_unmatched' as const,
              matchNotes: notes
            };
          }
          return li;
        });
        
        return {
          ...p,
          lineItems: updatedLineItems,
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
      pendingMatches: [],
      statistics: calculateStatistics(updatedPayments, expectations, matches)
    });
  },
  
  invalidateExpectation: (expectationId: string, reason: string) => {
    const { expectations, payments, matches } = get();
    
    const updatedExpectations = expectations.map(e => {
      if (e.id === expectationId) {
        return {
          ...e,
          status: 'invalidated' as const,
          invalidatedAt: new Date().toISOString(),
          invalidatedBy: 'Current User',
          invalidationReason: reason
        };
      }
      return e;
    });
    
    set({
      expectations: updatedExpectations,
      statistics: calculateStatistics(payments, updatedExpectations, matches)
    });
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
  
  importData: (newPayments, newExpectations) => {
    // Merge or replace data based on whether we have new data
    const payments = newPayments.length > 0 ? newPayments : get().payments;
    const expectations = newExpectations.length > 0 ? newExpectations : get().expectations;
    
    set({
      payments,
      expectations,
      matches: [],
      selectedPaymentId: null,
      pendingMatches: [],
      statistics: calculateStatistics(payments, expectations, [])
    });
  },
  
  setZohoData: (payments, expectations) => {
    set({
      payments,
      expectations,
      matches: [],
      selectedPaymentId: null,
      pendingMatches: [],
      isLoadingData: false,
      dataError: null,
      statistics: calculateStatistics(payments, expectations, [])
    });
  },
  
  setLoadingState: (isLoading, error = null) => {
    set({ isLoadingData: isLoading, dataError: error });
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
    
    // Apply month-based filtering based on payment date
    if (expectationFilters.monthRange !== 'all' && payment.paymentDate) {
      const paymentDate = new Date(payment.paymentDate);
      const paymentYear = paymentDate.getFullYear();
      const paymentMonth = paymentDate.getMonth();
      
      filtered = filtered.filter(e => {
        if (!e.calculationDate) return true; // Include if no calculation date
        
        const calcDate = new Date(e.calculationDate);
        const calcYear = calcDate.getFullYear();
        const calcMonth = calcDate.getMonth();
        
        if (expectationFilters.monthRange === 'payment') {
          // Exact month match
          return calcYear === paymentYear && calcMonth === paymentMonth;
        } else if (expectationFilters.monthRange === 'extended') {
          // +/- 1 month range
          const monthDiff = (paymentYear - calcYear) * 12 + (paymentMonth - calcMonth);
          return Math.abs(monthDiff) <= 1;
        }
        return true;
      });
    }
    
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
  
  getPendingMatchForLineItem: (lineItemId: string) => {
    const { pendingMatches } = get();
    return pendingMatches.find(pm => pm.lineItemId === lineItemId);
  },
  
  getPendingMatchForExpectation: (expectationId: string) => {
    const { pendingMatches } = get();
    return pendingMatches.find(pm => pm.expectationId === expectationId);
  },
  
  getPendingMatchSummary: () => {
    const { pendingMatches, tolerance } = get();
    
    if (pendingMatches.length === 0) {
      return { 
        totalLineItemAmount: 0, 
        totalExpectedAmount: 0, 
        variance: 0, 
        variancePercentage: 0,
        allWithinTolerance: true
      };
    }
    
    const totalLineItemAmount = pendingMatches.reduce((sum, pm) => sum + pm.lineItemAmount, 0);
    const totalExpectedAmount = pendingMatches.reduce((sum, pm) => sum + pm.expectedAmount, 0);
    const variance = totalLineItemAmount - totalExpectedAmount;
    const variancePercentage = totalExpectedAmount > 0 
      ? (variance / totalExpectedAmount) * 100 
      : 0;
    const allWithinTolerance = pendingMatches.every(pm => pm.isWithinTolerance);
    
    return { totalLineItemAmount, totalExpectedAmount, variance, variancePercentage, allWithinTolerance };
  },
  
  calculateVariance: (lineItemId: string, expectationId: string) => {
    const { selectedPaymentId, payments, expectations, tolerance } = get();
    const payment = payments.find(p => p.id === selectedPaymentId);
    if (!payment) return null;
    
    const lineItem = payment.lineItems.find(li => li.id === lineItemId);
    const expectation = expectations.find(e => e.id === expectationId);
    if (!lineItem || !expectation) return null;
    
    const amount = lineItem.amount - expectation.expectedAmount;
    const percentage = expectation.expectedAmount > 0 
      ? (amount / expectation.expectedAmount) * 100 
      : 0;
    const isWithinTolerance = Math.abs(percentage) <= tolerance;
    
    return { amount, percentage, isWithinTolerance };
  }
}));
