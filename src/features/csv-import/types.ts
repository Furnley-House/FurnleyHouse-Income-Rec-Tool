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

// Universal field mapping - each target field can be sourced from CSV, header, or hardcoded
export type FieldSource = 'csv' | 'header' | 'hardcoded';

export interface FieldMappingConfig {
  targetField: string;
  source: FieldSource;
  csvColumn?: string;        // Used when source = 'csv'
  headerField?: keyof PaymentHeaderInputs;  // Used when source = 'header'
  hardcodedValue?: string;   // Used when source = 'hardcoded'
  valueMappings?: Record<string, string>;  // CSV value → enum value mapping for enum fields
}

// Which header fields can be used as sources for each target field
export const HEADER_FIELD_OPTIONS: { value: keyof PaymentHeaderInputs; label: string; type: 'date' | 'text' | 'number' }[] = [
  { value: 'paymentDate', label: 'Payment Date', type: 'date' },
  { value: 'paymentReference', label: 'Payment Reference', type: 'text' },
  { value: 'providerName', label: 'Provider Name', type: 'text' },
  { value: 'paymentAmount', label: 'Payment Amount', type: 'number' },
  { value: 'notes', label: 'Notes', type: 'text' },
];

// Validation rules for each field type
export const FIELD_VALIDATION: Record<string, { type: 'date' | 'number' | 'text' | 'enum'; options?: string[]; format?: string }> = {
  payment_date: { type: 'date', format: 'YYYY-MM-DD' },
  amount: { type: 'number' },
  payment_reference: { type: 'text' },
  client_name: { type: 'text' },
  policy_reference: { type: 'text' },
  description: { type: 'text' },
  transaction_type: { type: 'enum', options: ['credit', 'debit', 'fee', 'commission'] },
  balance: { type: 'number' },
  fee_category: { type: 'enum', options: ['initial', 'ongoing', 'ad-hoc'] },
  adviser_name: { type: 'text' },
  agency_code: { type: 'text' },
};

// Legacy type for backwards compatibility during refactor
export interface DefaultFieldValue {
  targetField: string;
  source: 'header' | 'hardcoded';
  headerField?: keyof PaymentHeaderInputs;
  hardcodedValue?: string;
  enabled: boolean;
}

// Legacy constants - kept for backwards compatibility
export const INHERITABLE_FIELDS: { targetField: string; headerField: keyof PaymentHeaderInputs; label: string }[] = [
  { targetField: 'payment_date', headerField: 'paymentDate', label: 'Payment Date' },
];

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
  fieldConfigs: Record<string, FieldMappingConfig>;  // Full configs including valueMappings
  rowOffset: number;
}

export interface ImportConfig {
  target: ImportTarget;
  mappings: FieldMapping[];
  skipHeaderRow: boolean;
  dateFormat: string;
  rowOffset: number;
}
