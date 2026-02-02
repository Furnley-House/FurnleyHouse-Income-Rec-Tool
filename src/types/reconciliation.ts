// Payment Reconciliation System Types

export interface PaymentLineItem {
  id: string;
  clientName: string;
  planReference: string;
  agencyCode?: string;
  adviserName?: string;
  feeType?: string;
  feeCategory?: 'initial' | 'ongoing';
  amount: number;
  description: string;
  status: 'unmatched' | 'matched' | 'approved_unmatched';
  matchedExpectationId?: string;
  matchNotes?: string;
}

export interface PendingMatch {
  lineItemId: string;
  expectationId: string;
  lineItemAmount: number;
  expectedAmount: number;
  variance: number;
  variancePercentage: number;
  isWithinTolerance: boolean;
}

export interface Payment {
  id: string;
  providerName: string;
  paymentReference: string;
  amount: number;
  paymentDate: string;
  bankReference: string;
  statementItemCount: number;
  status: 'unreconciled' | 'in_progress' | 'reconciled';
  reconciledAmount: number;
  remainingAmount: number;
  matchedExpectationIds: string[];
  notes: string;
  reconciledAt?: string;
  reconciledBy?: string;
  lineItems: PaymentLineItem[];
  // Context for expectation filtering
  includedSuperbiaCompanies?: string[];
  dateRangeStart?: string;
  dateRangeEnd?: string;
}

export interface Expectation {
  id: string;
  clientName: string;
  planReference: string;
  expectedAmount: number;
  calculationDate: string;
  fundReference: string;
  feeCategory: 'initial' | 'ongoing';
  feeType: 'management' | 'performance' | 'advisory' | 'custody';
  description: string;
  providerName: string;
  adviserName: string;
  superbiaCompany: string;
  status: 'unmatched' | 'partial' | 'matched' | 'invalidated';
  allocatedAmount: number;
  remainingAmount: number;
  matchedToPayments: Array<{
    paymentId: string;
    amount: number;
    matchId: string;
  }>;
  // Invalidation fields
  invalidatedAt?: string;
  invalidatedBy?: string;
  invalidationReason?: string;
}

export interface Match {
  id: string;
  paymentId: string;
  expectationIds: string[];
  matchedAmount: number;
  variance: number;
  variancePercentage: number;
  matchType: 'full' | 'partial' | 'multi';
  matchMethod: 'auto' | 'manual' | 'ai-suggested';
  matchQuality: 'perfect' | 'good' | 'acceptable' | 'warning';
  notes: string;
  matchedBy: string;
  matchedAt: string;
  confirmed: boolean;
  details: Array<{
    expectationId: string;
    amountAllocated: number;
  }>;
}

export interface ReconciliationStatistics {
  totalPayments: number;
  reconciledPayments: number;
  inProgressPayments: number;
  unreconciledPayments: number;
  totalPaymentAmount: number;
  totalReconciledAmount: number;
  totalExpectations: number;
  matchedExpectations: number;
  partialExpectations: number;
  unmatchedExpectations: number;
  totalExpectedAmount: number;
  overallMatchPercentage: number;
  averageVariancePercentage: number;
}

export interface PaymentFilters {
  searchTerm: string;
  status: 'all' | 'unreconciled' | 'in_progress' | 'reconciled';
  provider: string | null;
}

export interface ExpectationFilters {
  searchTerm: string;
  status: 'all' | 'unmatched' | 'partial' | 'matched';
  monthRange: 'payment' | 'extended' | 'all'; // payment = payment month only, extended = +/- 1 month, all = no date filter
}

export interface ReconciliationSession {
  id: string;
  period: string;
  startedAt: string;
  payments: Payment[];
  expectations: Expectation[];
  matches: Match[];
  selectedPaymentId: string | null;
  pendingMatchExpectationIds: string[];
  paymentFilters: PaymentFilters;
  expectationFilters: ExpectationFilters;
  tolerance: number;
  autoAdvanceToNext: boolean;
  statistics: ReconciliationStatistics;
}
