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
  transform?: 'none' | 'currency' | 'date' | 'uppercase' | 'lowercase';
}

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

export interface ImportConfig {
  target: ImportTarget;
  mappings: FieldMapping[];
  skipHeaderRow: boolean;
  dateFormat: string;
}
