export interface CSVColumn {
  index: number;
  header: string;
  sampleValues: string[];
}

export interface CSVParseResult {
  headers: string[];
  rows: Record<string, string>[];
  columns: CSVColumn[];
  totalRows: number;
  fileName: string;
}

export interface FieldMapping {
  csvColumn: string;
  targetField: string;
  confidence: 'high' | 'medium' | 'low';
  sampleValues: string[];
  ignored: boolean;
}

// Fields that can inherit from payment header or have hardcoded defaults
export interface DefaultFieldValue {
  targetField: string;
  source: 'header' | 'hardcoded';
  headerField?: keyof PaymentHeaderInputs;
  hardcodedValue?: string;
  enabled: boolean;
}

// Predefined inheritable fields from payment header
export const INHERITABLE_FIELDS: { targetField: string; headerField: keyof PaymentHeaderInputs; label: string }[] = [
  { targetField: 'payment_date', headerField: 'paymentDate', label: 'Payment Date' },
];

// Fields that can have hardcoded default values
export const DEFAULTABLE_FIELDS = [
  { value: 'fee_category', label: 'Fee Category', options: ['initial', 'ongoing', 'ad-hoc'] },
  { value: 'transaction_type', label: 'Transaction Type', options: ['credit', 'debit', 'fee', 'commission'] },
] as const;

export interface ValidationError {
  row: number;
  column: string;
  message: string;
}

export interface CSVValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: string[];
}

export type ImportTarget = 'bank_payments' | 'payment_line_items';

// Internal target fields for bank payment imports
export const INTERNAL_FIELDS = [
  { value: 'payment_date', label: 'Payment Date', required: true },
  { value: 'amount', label: 'Amount', required: true },
  { value: 'payment_reference', label: 'Payment Reference', required: true },
  { value: 'client_name', label: 'Client Name', required: false },
  { value: 'policy_reference', label: 'Policy Reference', required: false },
  { value: 'description', label: 'Description', required: false },
  { value: 'transaction_type', label: 'Transaction Type', required: false },
  { value: 'balance', label: 'Balance', required: false },
  { value: 'fee_category', label: 'Fee Category', required: false },
  { value: 'adviser_name', label: 'Adviser Name', required: false },
  { value: 'agency_code', label: 'Agency Code', required: false },
] as const;

export type InternalFieldValue = typeof INTERNAL_FIELDS[number]['value'];

// Payment header details (collected first)
export interface PaymentHeaderInputs {
  providerName: string;
  providerId?: string;
  paymentDate: string;
  paymentReference: string;
  paymentAmount?: number;
  notes?: string;
}

// Step 2: User inputs from file upload
export interface FileUploadInputs {
  csvData: CSVParseResult;
}

// AI mapping analysis response
export interface AIStructuralIssue {
  type: 'merged_headers' | 'split_headers' | 'unusual_format' | 'missing_headers' | 'row_offset';
  description: string;
  suggestedFix: string;
  affectedColumns?: string[];
}

export interface AIMappingResult {
  mappings: FieldMapping[];
  structuralIssues: AIStructuralIssue[];
  suggestedRowOffset: number;
  overallConfidence: 'high' | 'medium' | 'low';
  analysisNotes: string;
}

// Complete wizard state
export interface WizardState {
  step: 'payment' | 'upload' | 'analyzing' | 'review' | 'validation';
  paymentHeader: PaymentHeaderInputs | null;
  fileInputs: FileUploadInputs | null;
  aiResult: AIMappingResult | null;
  finalMappings: FieldMapping[];
  defaultValues: DefaultFieldValue[];
  rowOffset: number;
}

export interface ImportConfig {
  target: ImportTarget;
  mappings: FieldMapping[];
  skipHeaderRow: boolean;
  dateFormat: string;
  rowOffset: number;
}
