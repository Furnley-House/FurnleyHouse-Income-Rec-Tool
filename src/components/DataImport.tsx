import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Upload, FileText, CheckCircle, AlertCircle, X, Download } from 'lucide-react';
import { useReconciliationStore } from '@/store/reconciliationStore';
import { Payment, Expectation, PaymentLineItem } from '@/types/reconciliation';
import { toast } from 'sonner';
import { 
  samplePaymentsCSV, 
  sampleLineItemsCSV, 
  sampleExpectationsCSV, 
  downloadCSV 
} from '@/data/sampleTemplates';

interface ImportResult {
  success: boolean;
  count: number;
  errors: string[];
}

export function DataImport() {
  const [open, setOpen] = useState(false);
  const [paymentsFile, setPaymentsFile] = useState<File | null>(null);
  const [lineItemsFile, setLineItemsFile] = useState<File | null>(null);
  const [expectationsFile, setExpectationsFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [results, setResults] = useState<{
    payments?: ImportResult;
    lineItems?: ImportResult;
    expectations?: ImportResult;
  }>({});

  const paymentsInputRef = useRef<HTMLInputElement>(null);
  const lineItemsInputRef = useRef<HTMLInputElement>(null);
  const expectationsInputRef = useRef<HTMLInputElement>(null);

  const { importData } = useReconciliationStore();

  const parseCSV = (text: string): Record<string, string>[] => {
    const lines = text.trim().split('\n');
    if (lines.length < 2) return [];
    
    const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
    const rows: Record<string, string>[] = [];
    
    for (let i = 1; i < lines.length; i++) {
      const values = parseCSVLine(lines[i]);
      if (values.length === headers.length) {
        const row: Record<string, string> = {};
        headers.forEach((header, index) => {
          row[header] = values[index];
        });
        rows.push(row);
      }
    }
    
    return rows;
  };

  const parseCSVLine = (line: string): string[] => {
    const values: string[] = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        values.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current.trim());
    
    return values;
  };

  const parseJSON = (text: string): Record<string, unknown>[] => {
    try {
      const data = JSON.parse(text);
      return Array.isArray(data) ? data : [data];
    } catch {
      return [];
    }
  };

  const parseFile = async (file: File): Promise<Record<string, unknown>[]> => {
    const text = await file.text();
    if (file.name.endsWith('.json')) {
      return parseJSON(text);
    } else if (file.name.endsWith('.csv')) {
      return parseCSV(text);
    }
    return [];
  };

  const mapToPayment = (row: Record<string, unknown>, index: number): Payment | null => {
    try {
      const id = String(row['Payment_ID'] || row['id'] || `PAY-${String(index + 1).padStart(4, '0')}`);
      const providerName = String(row['Provider_Name'] || row['providerName'] || '');
      const amount = parseFloat(String(row['Amount'] || row['amount'] || 0));
      
      if (!providerName || isNaN(amount)) {
        return null;
      }

      return {
        id,
        providerName,
        paymentReference: String(row['Payment_Reference'] || row['paymentReference'] || ''),
        amount,
        paymentDate: String(row['Payment_Date'] || row['paymentDate'] || new Date().toISOString().split('T')[0]),
        bankReference: String(row['Bank_Reference'] || row['bankReference'] || ''),
        statementItemCount: 0,
        status: (row['Status'] || row['status'] || 'unreconciled') as Payment['status'],
        reconciledAmount: parseFloat(String(row['Reconciled_Amount'] || row['reconciledAmount'] || 0)),
        remainingAmount: amount - parseFloat(String(row['Reconciled_Amount'] || row['reconciledAmount'] || 0)),
        matchedExpectationIds: [],
        notes: String(row['Notes'] || row['notes'] || ''),
        lineItems: [],
        includedSuperbiaCompanies: row['Included_Superbia_Companies'] 
          ? String(row['Included_Superbia_Companies']).split(';').map(s => s.trim())
          : undefined,
        dateRangeStart: row['Date_Range_Start'] ? String(row['Date_Range_Start']) : undefined,
        dateRangeEnd: row['Date_Range_End'] ? String(row['Date_Range_End']) : undefined,
      };
    } catch {
      return null;
    }
  };

  const mapToLineItem = (row: Record<string, unknown>, index: number): { paymentId: string; lineItem: PaymentLineItem } | null => {
    try {
      const paymentId = String(row['Payment'] || row['Payment_ID'] || row['paymentId'] || '');
      const amount = parseFloat(String(row['Amount'] || row['amount'] || 0));
      
      if (!paymentId || isNaN(amount)) {
        return null;
      }

      return {
        paymentId,
        lineItem: {
          id: String(row['Line_Item_ID'] || row['id'] || `LI-${String(index + 1).padStart(5, '0')}`),
          clientName: String(row['Client_Name'] || row['clientName'] || ''),
          planReference: String(row['Plan_Reference'] || row['planReference'] || ''),
          agencyCode: row['Agency_Code'] || row['agencyCode'] ? String(row['Agency_Code'] || row['agencyCode']) : undefined,
          feeCategory: (row['Fee_Category'] || row['feeCategory']) as PaymentLineItem['feeCategory'],
          amount,
          description: String(row['Description'] || row['description'] || ''),
          status: (row['Status'] || row['status'] || 'unmatched') as PaymentLineItem['status'],
          matchedExpectationId: row['Matched_Expectation'] ? String(row['Matched_Expectation']) : undefined,
          matchNotes: row['Match_Notes'] ? String(row['Match_Notes']) : undefined,
        }
      };
    } catch {
      return null;
    }
  };

  const mapToExpectation = (row: Record<string, unknown>, index: number): Expectation | null => {
    try {
      const expectedAmount = parseFloat(String(row['Expected_Amount'] || row['expectedAmount'] || 0));
      const clientName = String(row['Client_Name'] || row['clientName'] || '');
      
      if (!clientName || isNaN(expectedAmount)) {
        return null;
      }

      return {
        id: String(row['Expectation_ID'] || row['id'] || `EXP-${String(index + 1).padStart(4, '0')}`),
        clientName,
        planReference: String(row['Plan_Reference'] || row['planReference'] || ''),
        expectedAmount,
        calculationDate: String(row['Calculation_Date'] || row['calculationDate'] || new Date().toISOString().split('T')[0]),
        fundReference: String(row['Fund_Reference'] || row['fundReference'] || ''),
        feeCategory: (row['Fee_Category'] || row['feeCategory'] || 'ongoing') as Expectation['feeCategory'],
        feeType: (row['Fee_Type'] || row['feeType'] || 'management') as Expectation['feeType'],
        description: String(row['Description'] || row['description'] || ''),
        providerName: String(row['Provider_Name'] || row['providerName'] || ''),
        adviserName: String(row['Adviser_Name'] || row['adviserName'] || ''),
        superbiaCompany: String(row['Superbia_Company'] || row['superbiaCompany'] || ''),
        status: (row['Status'] || row['status'] || 'unmatched') as Expectation['status'],
        allocatedAmount: parseFloat(String(row['Allocated_Amount'] || row['allocatedAmount'] || 0)),
        remainingAmount: expectedAmount - parseFloat(String(row['Allocated_Amount'] || row['allocatedAmount'] || 0)),
        matchedToPayments: [],
      };
    } catch {
      return null;
    }
  };

  const handleImport = async () => {
    setImporting(true);
    const newResults: typeof results = {};
    
    try {
      let payments: Payment[] = [];
      let expectations: Expectation[] = [];

      // Parse payments file
      if (paymentsFile) {
        const rows = await parseFile(paymentsFile);
        const errors: string[] = [];
        
        rows.forEach((row, index) => {
          const payment = mapToPayment(row, index);
          if (payment) {
            payments.push(payment);
          } else {
            errors.push(`Row ${index + 2}: Invalid payment data`);
          }
        });

        newResults.payments = {
          success: payments.length > 0,
          count: payments.length,
          errors,
        };
      }

      // Parse line items and attach to payments
      if (lineItemsFile) {
        const rows = await parseFile(lineItemsFile);
        const errors: string[] = [];
        let count = 0;

        rows.forEach((row, index) => {
          const result = mapToLineItem(row, index);
          if (result) {
            const payment = payments.find(p => p.id === result.paymentId);
            if (payment) {
              payment.lineItems.push(result.lineItem);
              payment.statementItemCount = payment.lineItems.length;
              count++;
            } else {
              errors.push(`Row ${index + 2}: Payment ${result.paymentId} not found`);
            }
          } else {
            errors.push(`Row ${index + 2}: Invalid line item data`);
          }
        });

        newResults.lineItems = {
          success: count > 0,
          count,
          errors,
        };
      }

      // Parse expectations file
      if (expectationsFile) {
        const rows = await parseFile(expectationsFile);
        const errors: string[] = [];

        rows.forEach((row, index) => {
          const expectation = mapToExpectation(row, index);
          if (expectation) {
            expectations.push(expectation);
          } else {
            errors.push(`Row ${index + 2}: Invalid expectation data`);
          }
        });

        newResults.expectations = {
          success: expectations.length > 0,
          count: expectations.length,
          errors,
        };
      }

      setResults(newResults);

      // Import data if we have any
      if (payments.length > 0 || expectations.length > 0) {
        importData(payments, expectations);
        toast.success(`Imported ${payments.length} payments and ${expectations.length} expectations`);
      }

    } catch (error) {
      toast.error('Import failed: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setImporting(false);
    }
  };

  const clearFile = (type: 'payments' | 'lineItems' | 'expectations') => {
    if (type === 'payments') {
      setPaymentsFile(null);
      if (paymentsInputRef.current) paymentsInputRef.current.value = '';
    } else if (type === 'lineItems') {
      setLineItemsFile(null);
      if (lineItemsInputRef.current) lineItemsInputRef.current.value = '';
    } else {
      setExpectationsFile(null);
      if (expectationsInputRef.current) expectationsInputRef.current.value = '';
    }
  };

  const FileUploadArea = ({ 
    label, 
    file, 
    inputRef, 
    onChange, 
    onClear,
    result 
  }: { 
    label: string;
    file: File | null;
    inputRef: React.RefObject<HTMLInputElement>;
    onChange: (file: File | null) => void;
    onClear: () => void;
    result?: ImportResult;
  }) => (
    <div className="space-y-2">
      <label className="text-sm font-medium">{label}</label>
      <div 
        className={`border-2 border-dashed rounded-lg p-4 text-center transition-colors ${
          file ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50'
        }`}
      >
        {file ? (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              <span className="text-sm font-medium">{file.name}</span>
            </div>
            <Button variant="ghost" size="sm" onClick={onClear}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <div 
            className="cursor-pointer py-4"
            onClick={() => inputRef.current?.click()}
          >
            <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">
              Click to upload CSV or JSON
            </p>
          </div>
        )}
        <input
          ref={inputRef}
          type="file"
          accept=".csv,.json"
          className="hidden"
          onChange={(e) => onChange(e.target.files?.[0] || null)}
        />
      </div>
      {result && (
        <div className={`flex items-center gap-2 text-sm ${result.success ? 'text-green-600' : 'text-destructive'}`}>
          {result.success ? <CheckCircle className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
          <span>{result.count} records imported</span>
          {result.errors.length > 0 && (
            <span className="text-muted-foreground">({result.errors.length} errors)</span>
          )}
        </div>
      )}
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Upload className="h-4 w-4 mr-2" />
          Import Data
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Import Reconciliation Data</DialogTitle>
          <DialogDescription>
            Upload CSV or JSON files exported from Zoho. Files should match the dataset specification format.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="files" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="files">Upload Files</TabsTrigger>
            <TabsTrigger value="format">Format Guide</TabsTrigger>
          </TabsList>

          <TabsContent value="files" className="space-y-4 mt-4">
            <FileUploadArea
              label="Payments File"
              file={paymentsFile}
              inputRef={paymentsInputRef}
              onChange={setPaymentsFile}
              onClear={() => clearFile('payments')}
              result={results.payments}
            />

            <FileUploadArea
              label="Payment Line Items File"
              file={lineItemsFile}
              inputRef={lineItemsInputRef}
              onChange={setLineItemsFile}
              onClear={() => clearFile('lineItems')}
              result={results.lineItems}
            />

            <FileUploadArea
              label="Expectations File"
              file={expectationsFile}
              inputRef={expectationsInputRef}
              onChange={setExpectationsFile}
              onClear={() => clearFile('expectations')}
              result={results.expectations}
            />

            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handleImport} 
                disabled={importing || (!paymentsFile && !expectationsFile)}
              >
                {importing ? 'Importing...' : 'Import Data'}
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="format" className="mt-4">
            <div className="space-y-4 text-sm">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-semibold mb-1">Payments CSV</h4>
                  <code className="block bg-muted p-2 rounded text-xs overflow-x-auto max-w-md">
                    Payment_ID, Provider_Name, Payment_Reference, Amount, Payment_Date, Bank_Reference, Status, Notes
                  </code>
                </div>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => downloadCSV(samplePaymentsCSV, 'sample_payments.csv')}
                >
                  <Download className="h-4 w-4 mr-1" />
                  Sample
                </Button>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-semibold mb-1">Payment Line Items CSV</h4>
                  <code className="block bg-muted p-2 rounded text-xs overflow-x-auto max-w-md">
                    Line_Item_ID, Payment, Client_Name, Plan_Reference, Agency_Code, Fee_Category, Amount, Status
                  </code>
                </div>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => downloadCSV(sampleLineItemsCSV, 'sample_line_items.csv')}
                >
                  <Download className="h-4 w-4 mr-1" />
                  Sample
                </Button>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-semibold mb-1">Expectations CSV</h4>
                  <code className="block bg-muted p-2 rounded text-xs overflow-x-auto max-w-md">
                    Expectation_ID, Client_Name, Plan_Reference, Expected_Amount, Fee_Category, Provider_Name, Adviser_Name, Superbia_Company, Status
                  </code>
                </div>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => downloadCSV(sampleExpectationsCSV, 'sample_expectations.csv')}
                >
                  <Download className="h-4 w-4 mr-1" />
                  Sample
                </Button>
              </div>

              <div className="bg-muted/50 p-3 rounded-lg mt-4">
                <p className="text-muted-foreground text-xs">
                  <strong>Tip:</strong> Download the sample files above, open them in Excel, and use them as templates. 
                  Both Zoho API field names (e.g., Payment_ID) and camelCase alternatives (e.g., paymentId) are supported.
                </p>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
