import { Payment, Expectation, Match, PaymentLineItem } from '@/types/reconciliation';

// Generate a unique ID
const generateId = () => Math.random().toString(36).substring(2, 11);

// Provider names
const providers = ['Aegon', 'Aviva', 'Legal & General', 'Standard Life', 'Scottish Widows'];

// Client names (individual people, not companies)
const clientNames = [
  'Mr J Harrison', 'Mrs S Cambridge', 'Mr & Mrs R Norfolk',
  'Mr P Brighton', 'Ms K Yorkshire', 'Mr & Mrs D Thames',
  'Mr I Derbyshire', 'Mr E Smith and Mrs T Smith', 'Mrs L Bristol',
  'Mr A Leeds', 'Ms R Southampton', 'Mr & Mrs W Birmingham',
  'Mr N Nottingham', 'Mrs J Liverpool', 'Mr C Cardiff',
  'Ms F Glasgow', 'Mr & Mrs H Oxford', 'Mr P Plymouth',
  'Mrs M Derby', 'Mr S Sheffield', 'Ms A Coventry',
  'Mr & Mrs B Leicester', 'Mr T Stoke', 'Mrs K Wolverhampton',
  'Mr G Hull', 'Ms D Reading', 'Mr & Mrs L Preston',
  'Mr R Henderson', 'Mrs V Mitchell', 'Mr & Mrs J Thompson',
  'Ms C Anderson', 'Mr D Walker', 'Mrs P Robinson'
];

// Superbia company names
const superbiaCompanies = ['Furnley House', 'Headleys', 'Anchor Wealth'];

// Adviser names
const adviserNames = [
  'James Mitchell', 'Sarah Thompson', 'Michael Carter', 
  'Emma Williams', 'David Brown', 'Rachel Green',
  'Andrew Taylor', 'Lisa Anderson', 'Robert Wilson'
];

// Agency codes (used on statements)
const agencyCodes = ['AG001', 'AG002', 'AG003', 'FH001', 'FH002', 'HL001', 'HL002', 'AW001', 'AW002'];

// Fee types
const feeTypes: Array<'management' | 'performance' | 'advisory' | 'custody'> = [
  'management', 'performance', 'advisory', 'custody'
];

// Fee categories
const feeCategories: Array<'initial' | 'ongoing'> = ['initial', 'ongoing'];

// Generate random amount between min and max
const randomAmount = (min: number, max: number) => 
  Math.round((Math.random() * (max - min) + min) * 100) / 100;

// Generate random date within current month
const randomDate = () => {
  const now = new Date();
  const day = Math.floor(Math.random() * 28) + 1;
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
};

// Generate expectations for a provider (and corresponding line items)
const generateExpectationsAndLineItems = (provider: string, count: number): { expectations: Expectation[], lineItems: PaymentLineItem[] } => {
  const expectations: Expectation[] = [];
  const lineItems: PaymentLineItem[] = [];
  const usedClients = new Set<string>();
  
  for (let i = 0; i < count; i++) {
    let clientName = clientNames[Math.floor(Math.random() * clientNames.length)];
    // Ensure unique clients per batch
    while (usedClients.has(clientName) && usedClients.size < clientNames.length) {
      clientName = clientNames[Math.floor(Math.random() * clientNames.length)];
    }
    usedClients.add(clientName);
    
    const expectedAmount = randomAmount(500, 15000);
    const planReference = `PL-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    const feeCategory = feeCategories[Math.floor(Math.random() * feeCategories.length)];
    const feeType = feeTypes[Math.floor(Math.random() * feeTypes.length)];
    const superbiaCompany = superbiaCompanies[Math.floor(Math.random() * superbiaCompanies.length)];
    const adviserName = adviserNames[Math.floor(Math.random() * adviserNames.length)];
    const agencyCode = agencyCodes[Math.floor(Math.random() * agencyCodes.length)];
    
    // Generate line item with slight variance from expected (simulating provider paying slightly different)
    const varianceFactor = 1 + (Math.random() - 0.5) * 0.04; // ±2% variance
    const lineItemAmount = Math.round(expectedAmount * varianceFactor * 100) / 100;
    
    const expectationId = generateId();
    
    expectations.push({
      id: expectationId,
      clientName,
      planReference,
      expectedAmount,
      calculationDate: randomDate(),
      fundReference: `FND-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
      feeCategory,
      feeType,
      description: `${feeCategory === 'initial' ? 'Initial' : 'Ongoing'} ${feeType} fee for Q4 2024`,
      providerName: provider,
      adviserName,
      superbiaCompany,
      status: 'unmatched',
      allocatedAmount: 0,
      remainingAmount: expectedAmount,
      matchedToPayments: []
    });
    
    lineItems.push({
      id: generateId(),
      clientName,
      planReference,
      agencyCode,
      amount: lineItemAmount,
      description: `${feeCategory === 'initial' ? 'Initial' : 'Ongoing'} ${feeType} fee`,
      status: 'unmatched'
    });
  }
  
  return { expectations, lineItems };
};

// Generate payments with related expectations
export const generateMockData = (): { payments: Payment[], expectations: Expectation[], matches: Match[] } => {
  const payments: Payment[] = [];
  const allExpectations: Expectation[] = [];
  const matches: Match[] = [];
  
  // Provider A: Aegon - 3 payments
  const aegon1 = generateExpectationsAndLineItems('Aegon', 20);
  const aegonSum1 = aegon1.lineItems.reduce((sum, e) => sum + e.amount, 0);
  payments.push({
    id: generateId(),
    providerName: 'Aegon',
    paymentReference: 'AEG-2024-12-001',
    amount: Math.round(aegonSum1 * 100) / 100,
    paymentDate: '2024-12-05',
    bankReference: 'BACS-4521789',
    statementItemCount: 20,
    status: 'unreconciled',
    reconciledAmount: 0,
    remainingAmount: Math.round(aegonSum1 * 100) / 100,
    matchedExpectationIds: [],
    notes: '',
    lineItems: aegon1.lineItems
  });
  allExpectations.push(...aegon1.expectations);
  
  const aegon2 = generateExpectationsAndLineItems('Aegon', 15);
  const aegonSum2 = aegon2.lineItems.reduce((sum, e) => sum + e.amount, 0);
  payments.push({
    id: generateId(),
    providerName: 'Aegon',
    paymentReference: 'AEG-2024-12-002',
    amount: Math.round(aegonSum2 * 100) / 100,
    paymentDate: '2024-12-12',
    bankReference: 'BACS-4521956',
    statementItemCount: 15,
    status: 'unreconciled',
    reconciledAmount: 0,
    remainingAmount: Math.round(aegonSum2 * 100) / 100,
    matchedExpectationIds: [],
    notes: '',
    lineItems: aegon2.lineItems
  });
  allExpectations.push(...aegon2.expectations);
  
  const aegon3 = generateExpectationsAndLineItems('Aegon', 8);
  const aegonSum3 = aegon3.lineItems.reduce((sum, e) => sum + e.amount, 0);
  // Mark as reconciled
  aegon3.expectations.forEach((e, idx) => {
    e.status = 'matched';
    e.allocatedAmount = aegon3.lineItems[idx].amount;
    e.remainingAmount = 0;
    aegon3.lineItems[idx].status = 'matched';
    aegon3.lineItems[idx].matchedExpectationId = e.id;
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
    matchedExpectationIds: aegon3.expectations.map(e => e.id),
    notes: 'Monthly charges reconciled',
    reconciledAt: '2024-12-02T10:30:00Z',
    reconciledBy: 'John Smith',
    lineItems: aegon3.lineItems
  });
  allExpectations.push(...aegon3.expectations);
  
  // Provider B: Aviva - 4 payments
  const aviva1 = generateExpectationsAndLineItems('Aviva', 35);
  const avivaSum1 = aviva1.lineItems.reduce((sum, e) => sum + e.amount, 0);
  // Mark some as matched for in_progress
  const matchedCount = 17;
  let matchedAmount = 0;
  for (let i = 0; i < matchedCount; i++) {
    aviva1.expectations[i].status = 'matched';
    aviva1.expectations[i].allocatedAmount = aviva1.lineItems[i].amount;
    aviva1.expectations[i].remainingAmount = 0;
    aviva1.lineItems[i].status = 'matched';
    aviva1.lineItems[i].matchedExpectationId = aviva1.expectations[i].id;
    matchedAmount += aviva1.lineItems[i].amount;
  }
  payments.push({
    id: generateId(),
    providerName: 'Aviva',
    paymentReference: 'AVV-2024-12-001',
    amount: Math.round(avivaSum1 * 100) / 100,
    paymentDate: '2024-12-08',
    bankReference: 'BACS-4522134',
    statementItemCount: 35,
    status: 'in_progress',
    reconciledAmount: Math.round(matchedAmount * 100) / 100,
    remainingAmount: Math.round((avivaSum1 - matchedAmount) * 100) / 100,
    matchedExpectationIds: aviva1.expectations.slice(0, matchedCount).map(e => e.id),
    notes: 'In progress - some items matched',
    lineItems: aviva1.lineItems
  });
  allExpectations.push(...aviva1.expectations);
  
  const aviva2 = generateExpectationsAndLineItems('Aviva', 25);
  const avivaSum2 = aviva2.lineItems.reduce((sum, e) => sum + e.amount, 0);
  payments.push({
    id: generateId(),
    providerName: 'Aviva',
    paymentReference: 'AVV-2024-12-002',
    amount: Math.round(avivaSum2 * 100) / 100,
    paymentDate: '2024-12-10',
    bankReference: 'BACS-4522345',
    statementItemCount: 25,
    status: 'unreconciled',
    reconciledAmount: 0,
    remainingAmount: Math.round(avivaSum2 * 100) / 100,
    matchedExpectationIds: [],
    notes: '',
    lineItems: aviva2.lineItems
  });
  allExpectations.push(...aviva2.expectations);
  
  const aviva3 = generateExpectationsAndLineItems('Aviva', 18);
  const avivaSum3 = aviva3.lineItems.reduce((sum, e) => sum + e.amount, 0);
  payments.push({
    id: generateId(),
    providerName: 'Aviva',
    paymentReference: 'AVV-2024-12-003',
    amount: Math.round(avivaSum3 * 100) / 100,
    paymentDate: '2024-12-06',
    bankReference: 'BACS-4522012',
    statementItemCount: 18,
    status: 'unreconciled',
    reconciledAmount: 0,
    remainingAmount: Math.round(avivaSum3 * 100) / 100,
    matchedExpectationIds: [],
    notes: '',
    lineItems: aviva3.lineItems
  });
  allExpectations.push(...aviva3.expectations);
  
  const aviva4 = generateExpectationsAndLineItems('Aviva', 12);
  const avivaSum4 = aviva4.lineItems.reduce((sum, e) => sum + e.amount, 0);
  aviva4.expectations.forEach((e, idx) => {
    e.status = 'matched';
    e.allocatedAmount = aviva4.lineItems[idx].amount;
    e.remainingAmount = 0;
    aviva4.lineItems[idx].status = 'matched';
    aviva4.lineItems[idx].matchedExpectationId = e.id;
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
    matchedExpectationIds: aviva4.expectations.map(e => e.id),
    notes: 'Fully reconciled',
    reconciledAt: '2024-12-04T14:20:00Z',
    reconciledBy: 'Sarah Johnson',
    lineItems: aviva4.lineItems
  });
  allExpectations.push(...aviva4.expectations);
  
  // Provider C: Legal & General - 2 large payments
  const lg1 = generateExpectationsAndLineItems('Legal & General', 45);
  const lgSum1 = lg1.lineItems.reduce((sum, e) => sum + e.amount, 0);
  payments.push({
    id: generateId(),
    providerName: 'Legal & General',
    paymentReference: 'LG-2024-12-001',
    amount: Math.round(lgSum1 * 100) / 100,
    paymentDate: '2024-12-09',
    bankReference: 'CHAPS-8891234',
    statementItemCount: 45,
    status: 'unreconciled',
    reconciledAmount: 0,
    remainingAmount: Math.round(lgSum1 * 100) / 100,
    matchedExpectationIds: [],
    notes: '',
    lineItems: lg1.lineItems
  });
  allExpectations.push(...lg1.expectations);
  
  const lg2 = generateExpectationsAndLineItems('Legal & General', 38);
  const lgSum2 = lg2.lineItems.reduce((sum, e) => sum + e.amount, 0);
  const lgMatchedCount = 12;
  let lgMatchedAmount = 0;
  for (let i = 0; i < lgMatchedCount; i++) {
    lg2.expectations[i].status = 'matched';
    lg2.expectations[i].allocatedAmount = lg2.lineItems[i].amount;
    lg2.expectations[i].remainingAmount = 0;
    lg2.lineItems[i].status = 'matched';
    lg2.lineItems[i].matchedExpectationId = lg2.expectations[i].id;
    lgMatchedAmount += lg2.lineItems[i].amount;
  }
  payments.push({
    id: generateId(),
    providerName: 'Legal & General',
    paymentReference: 'LG-2024-12-002',
    amount: Math.round(lgSum2 * 100) / 100,
    paymentDate: '2024-12-07',
    bankReference: 'CHAPS-8890987',
    statementItemCount: 38,
    status: 'in_progress',
    reconciledAmount: Math.round(lgMatchedAmount * 100) / 100,
    remainingAmount: Math.round((lgSum2 - lgMatchedAmount) * 100) / 100,
    matchedExpectationIds: lg2.expectations.slice(0, lgMatchedCount).map(e => e.id),
    notes: 'Partially matched',
    lineItems: lg2.lineItems
  });
  allExpectations.push(...lg2.expectations);
  
  // Smaller providers
  ['Standard Life', 'Scottish Widows'].forEach(provider => {
    const data = generateExpectationsAndLineItems(provider, Math.floor(Math.random() * 10) + 8);
    const sum = data.lineItems.reduce((s, e) => s + e.amount, 0);
    payments.push({
      id: generateId(),
      providerName: provider,
      paymentReference: `${provider.substring(0, 2).toUpperCase()}-2024-12-001`,
      amount: Math.round(sum * 100) / 100,
      paymentDate: randomDate(),
      bankReference: `BACS-${Math.floor(Math.random() * 9000000) + 1000000}`,
      statementItemCount: data.expectations.length,
      status: 'unreconciled',
      reconciledAmount: 0,
      remainingAmount: Math.round(sum * 100) / 100,
      matchedExpectationIds: [],
      notes: '',
      lineItems: data.lineItems
    });
    allExpectations.push(...data.expectations);
  });
  
  // Sort payments by date (newest first)
  payments.sort((a, b) => new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime());
  
  return { payments, expectations: allExpectations, matches };
};

export const { payments: mockPayments, expectations: mockExpectations, matches: mockMatches } = generateMockData();
