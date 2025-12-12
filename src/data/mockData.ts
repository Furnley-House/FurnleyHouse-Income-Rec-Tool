import { Payment, Expectation, Match } from '@/types/reconciliation';

// Generate a unique ID
const generateId = () => Math.random().toString(36).substring(2, 11);

// Provider names
const providers = ['Aegon', 'Aviva', 'Legal & General', 'Standard Life', 'Scottish Widows'];

// Client names
const clientNames = [
  'Harrison Wealth Solutions', 'Cambridge Pensions Ltd', 'Norfolk Investment Trust',
  'Brighton Capital Partners', 'Yorkshire Fund Managers', 'Thames Valley Investments',
  'Edinburgh Financial Services', 'Manchester Wealth Advisory', 'Bristol Asset Management',
  'Leeds Investment Group', 'Southampton Capital', 'Birmingham Pension Trustees',
  'Nottingham Financial Planning', 'Liverpool Wealth Management', 'Cardiff Investment Services',
  'Glasgow Portfolio Advisors', 'Oxford Retirement Solutions', 'Plymouth Asset Trustees',
  'Derby Investment Partners', 'Sheffield Pension Services', 'Coventry Capital Group',
  'Leicester Fund Management', 'Stoke Financial Advisory', 'Wolverhampton Investments',
  'Hull Pension Trustees', 'Reading Wealth Solutions', 'Preston Asset Services'
];

// Fee types
const feeTypes: Array<'management' | 'performance' | 'advisory' | 'custody'> = [
  'management', 'performance', 'advisory', 'custody'
];

// Generate random amount between min and max
const randomAmount = (min: number, max: number) => 
  Math.round((Math.random() * (max - min) + min) * 100) / 100;

// Generate random date within current month
const randomDate = () => {
  const now = new Date();
  const day = Math.floor(Math.random() * 28) + 1;
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
};

// Generate expectations for a provider
const generateExpectations = (provider: string, count: number): Expectation[] => {
  const expectations: Expectation[] = [];
  const usedClients = new Set<string>();
  
  for (let i = 0; i < count; i++) {
    let clientName = clientNames[Math.floor(Math.random() * clientNames.length)];
    // Ensure unique clients per batch
    while (usedClients.has(clientName) && usedClients.size < clientNames.length) {
      clientName = clientNames[Math.floor(Math.random() * clientNames.length)];
    }
    usedClients.add(clientName);
    
    const expectedAmount = randomAmount(500, 15000);
    
    expectations.push({
      id: generateId(),
      clientName,
      planReference: `PL-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
      expectedAmount,
      calculationDate: randomDate(),
      fundReference: `FND-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
      feeType: feeTypes[Math.floor(Math.random() * feeTypes.length)],
      description: `${feeTypes[Math.floor(Math.random() * feeTypes.length)]} fee for Q4 2024`,
      providerName: provider,
      status: 'unmatched',
      allocatedAmount: 0,
      remainingAmount: expectedAmount,
      matchedToPayments: []
    });
  }
  
  return expectations;
};

// Generate payments with related expectations
export const generateMockData = (): { payments: Payment[], expectations: Expectation[], matches: Match[] } => {
  const payments: Payment[] = [];
  const allExpectations: Expectation[] = [];
  const matches: Match[] = [];
  
  // Provider A: Aegon - 3 payments
  const aegonExpectations1 = generateExpectations('Aegon', 20);
  const aegonSum1 = aegonExpectations1.reduce((sum, e) => sum + e.expectedAmount, 0);
  payments.push({
    id: generateId(),
    providerName: 'Aegon',
    paymentReference: 'AEG-2024-12-001',
    amount: Math.round(aegonSum1 * (1 + (Math.random() - 0.5) * 0.02) * 100) / 100,
    paymentDate: '2024-12-05',
    bankReference: 'BACS-4521789',
    statementItemCount: 20,
    status: 'unreconciled',
    reconciledAmount: 0,
    remainingAmount: Math.round(aegonSum1 * (1 + (Math.random() - 0.5) * 0.02) * 100) / 100,
    matchedExpectationIds: [],
    notes: ''
  });
  allExpectations.push(...aegonExpectations1);
  
  const aegonExpectations2 = generateExpectations('Aegon', 15);
  const aegonSum2 = aegonExpectations2.reduce((sum, e) => sum + e.expectedAmount, 0);
  payments.push({
    id: generateId(),
    providerName: 'Aegon',
    paymentReference: 'AEG-2024-12-002',
    amount: Math.round(aegonSum2 * (1 + (Math.random() - 0.5) * 0.03) * 100) / 100,
    paymentDate: '2024-12-12',
    bankReference: 'BACS-4521956',
    statementItemCount: 15,
    status: 'unreconciled',
    reconciledAmount: 0,
    remainingAmount: Math.round(aegonSum2 * (1 + (Math.random() - 0.5) * 0.03) * 100) / 100,
    matchedExpectationIds: [],
    notes: ''
  });
  allExpectations.push(...aegonExpectations2);
  
  const aegonExpectations3 = generateExpectations('Aegon', 8);
  const aegonSum3 = aegonExpectations3.reduce((sum, e) => sum + e.expectedAmount, 0);
  // Mark as reconciled
  aegonExpectations3.forEach(e => {
    e.status = 'matched';
    e.allocatedAmount = e.expectedAmount;
    e.remainingAmount = 0;
  });
  payments.push({
    id: generateId(),
    providerName: 'Aegon',
    paymentReference: 'AEG-2024-12-003',
    amount: Math.round(aegonSum3 * 100) / 100,
    paymentDate: '2024-12-01',
    bankReference: 'BACS-4521456',
    statementItemCount: 8,
    status: 'reconciled',
    reconciledAmount: Math.round(aegonSum3 * 100) / 100,
    remainingAmount: 0,
    matchedExpectationIds: aegonExpectations3.map(e => e.id),
    notes: 'Monthly charges reconciled',
    reconciledAt: '2024-12-02T10:30:00Z',
    reconciledBy: 'John Smith'
  });
  allExpectations.push(...aegonExpectations3);
  
  // Provider B: Aviva - 4 payments
  const avivaExpectations1 = generateExpectations('Aviva', 35);
  const avivaSum1 = avivaExpectations1.reduce((sum, e) => sum + e.expectedAmount, 0);
  // Mark some as matched for in_progress
  const matchedCount = 17;
  let matchedAmount = 0;
  for (let i = 0; i < matchedCount; i++) {
    avivaExpectations1[i].status = 'matched';
    avivaExpectations1[i].allocatedAmount = avivaExpectations1[i].expectedAmount;
    avivaExpectations1[i].remainingAmount = 0;
    matchedAmount += avivaExpectations1[i].expectedAmount;
  }
  const avivaPayment1Id = generateId();
  payments.push({
    id: avivaPayment1Id,
    providerName: 'Aviva',
    paymentReference: 'AVV-2024-12-001',
    amount: Math.round(avivaSum1 * (1 + (Math.random() - 0.5) * 0.02) * 100) / 100,
    paymentDate: '2024-12-08',
    bankReference: 'BACS-4522134',
    statementItemCount: 35,
    status: 'in_progress',
    reconciledAmount: Math.round(matchedAmount * 100) / 100,
    remainingAmount: Math.round((avivaSum1 - matchedAmount) * (1 + (Math.random() - 0.5) * 0.02) * 100) / 100,
    matchedExpectationIds: avivaExpectations1.slice(0, matchedCount).map(e => e.id),
    notes: 'In progress - some items matched'
  });
  allExpectations.push(...avivaExpectations1);
  
  const avivaExpectations2 = generateExpectations('Aviva', 25);
  const avivaSum2 = avivaExpectations2.reduce((sum, e) => sum + e.expectedAmount, 0);
  payments.push({
    id: generateId(),
    providerName: 'Aviva',
    paymentReference: 'AVV-2024-12-002',
    amount: Math.round(avivaSum2 * (1 + (Math.random() - 0.5) * 0.025) * 100) / 100,
    paymentDate: '2024-12-10',
    bankReference: 'BACS-4522345',
    statementItemCount: 25,
    status: 'unreconciled',
    reconciledAmount: 0,
    remainingAmount: Math.round(avivaSum2 * (1 + (Math.random() - 0.5) * 0.025) * 100) / 100,
    matchedExpectationIds: [],
    notes: ''
  });
  allExpectations.push(...avivaExpectations2);
  
  const avivaExpectations3 = generateExpectations('Aviva', 18);
  const avivaSum3 = avivaExpectations3.reduce((sum, e) => sum + e.expectedAmount, 0);
  payments.push({
    id: generateId(),
    providerName: 'Aviva',
    paymentReference: 'AVV-2024-12-003',
    amount: Math.round(avivaSum3 * (1 + (Math.random() - 0.5) * 0.02) * 100) / 100,
    paymentDate: '2024-12-06',
    bankReference: 'BACS-4522012',
    statementItemCount: 18,
    status: 'unreconciled',
    reconciledAmount: 0,
    remainingAmount: Math.round(avivaSum3 * (1 + (Math.random() - 0.5) * 0.02) * 100) / 100,
    matchedExpectationIds: [],
    notes: ''
  });
  allExpectations.push(...avivaExpectations3);
  
  const avivaExpectations4 = generateExpectations('Aviva', 12);
  const avivaSum4 = avivaExpectations4.reduce((sum, e) => sum + e.expectedAmount, 0);
  avivaExpectations4.forEach(e => {
    e.status = 'matched';
    e.allocatedAmount = e.expectedAmount;
    e.remainingAmount = 0;
  });
  payments.push({
    id: generateId(),
    providerName: 'Aviva',
    paymentReference: 'AVV-2024-12-004',
    amount: Math.round(avivaSum4 * 100) / 100,
    paymentDate: '2024-12-03',
    bankReference: 'BACS-4521678',
    statementItemCount: 12,
    status: 'reconciled',
    reconciledAmount: Math.round(avivaSum4 * 100) / 100,
    remainingAmount: 0,
    matchedExpectationIds: avivaExpectations4.map(e => e.id),
    notes: 'Fully reconciled',
    reconciledAt: '2024-12-04T14:20:00Z',
    reconciledBy: 'Sarah Johnson'
  });
  allExpectations.push(...avivaExpectations4);
  
  // Provider C: Legal & General - 2 large payments
  const lgExpectations1 = generateExpectations('Legal & General', 45);
  const lgSum1 = lgExpectations1.reduce((sum, e) => sum + e.expectedAmount, 0);
  payments.push({
    id: generateId(),
    providerName: 'Legal & General',
    paymentReference: 'LG-2024-12-001',
    amount: Math.round(lgSum1 * (1 + (Math.random() - 0.5) * 0.015) * 100) / 100,
    paymentDate: '2024-12-09',
    bankReference: 'CHAPS-8891234',
    statementItemCount: 45,
    status: 'unreconciled',
    reconciledAmount: 0,
    remainingAmount: Math.round(lgSum1 * (1 + (Math.random() - 0.5) * 0.015) * 100) / 100,
    matchedExpectationIds: [],
    notes: ''
  });
  allExpectations.push(...lgExpectations1);
  
  const lgExpectations2 = generateExpectations('Legal & General', 38);
  const lgSum2 = lgExpectations2.reduce((sum, e) => sum + e.expectedAmount, 0);
  const lgMatchedCount = 12;
  let lgMatchedAmount = 0;
  for (let i = 0; i < lgMatchedCount; i++) {
    lgExpectations2[i].status = 'matched';
    lgExpectations2[i].allocatedAmount = lgExpectations2[i].expectedAmount;
    lgExpectations2[i].remainingAmount = 0;
    lgMatchedAmount += lgExpectations2[i].expectedAmount;
  }
  payments.push({
    id: generateId(),
    providerName: 'Legal & General',
    paymentReference: 'LG-2024-12-002',
    amount: Math.round(lgSum2 * (1 + (Math.random() - 0.5) * 0.02) * 100) / 100,
    paymentDate: '2024-12-07',
    bankReference: 'CHAPS-8890987',
    statementItemCount: 38,
    status: 'in_progress',
    reconciledAmount: Math.round(lgMatchedAmount * 100) / 100,
    remainingAmount: Math.round((lgSum2 - lgMatchedAmount) * (1 + (Math.random() - 0.5) * 0.02) * 100) / 100,
    matchedExpectationIds: lgExpectations2.slice(0, lgMatchedCount).map(e => e.id),
    notes: 'Partially matched'
  });
  allExpectations.push(...lgExpectations2);
  
  // Smaller providers
  ['Standard Life', 'Scottish Widows'].forEach(provider => {
    const expectations = generateExpectations(provider, Math.floor(Math.random() * 10) + 8);
    const sum = expectations.reduce((s, e) => s + e.expectedAmount, 0);
    payments.push({
      id: generateId(),
      providerName: provider,
      paymentReference: `${provider.substring(0, 2).toUpperCase()}-2024-12-001`,
      amount: Math.round(sum * (1 + (Math.random() - 0.5) * 0.02) * 100) / 100,
      paymentDate: randomDate(),
      bankReference: `BACS-${Math.floor(Math.random() * 9000000) + 1000000}`,
      statementItemCount: expectations.length,
      status: 'unreconciled',
      reconciledAmount: 0,
      remainingAmount: Math.round(sum * (1 + (Math.random() - 0.5) * 0.02) * 100) / 100,
      matchedExpectationIds: [],
      notes: ''
    });
    allExpectations.push(...expectations);
  });
  
  // Sort payments by date (newest first)
  payments.sort((a, b) => new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime());
  
  return { payments, expectations: allExpectations, matches };
};

export const { payments: mockPayments, expectations: mockExpectations, matches: mockMatches } = generateMockData();
