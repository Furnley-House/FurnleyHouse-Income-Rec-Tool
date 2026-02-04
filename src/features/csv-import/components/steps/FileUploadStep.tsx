import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ArrowRight, FileSpreadsheet, Building2 } from 'lucide-react';
import { CSVUpload } from '../CSVUpload';
import { CSVParseResult, FileUploadInputs } from '../../types';

interface FileUploadStepProps {
  onComplete: (inputs: FileUploadInputs) => void;
}

export function FileUploadStep({ onComplete }: FileUploadStepProps) {
  const [csvData, setCsvData] = useState<CSVParseResult | null>(null);
  const [paymentDateColumn, setPaymentDateColumn] = useState<string>('');
  const [paymentReferenceColumn, setPaymentReferenceColumn] = useState<string>('');
  const [providerName, setProviderName] = useState<string>('');

  const handleFileLoaded = useCallback((result: CSVParseResult) => {
    setCsvData(result);
    // Try to auto-detect date and reference columns
    const headers = result.headers.map(h => h.toLowerCase());
    
    // Auto-detect date column
    const dateKeywords = ['date', 'payment_date', 'transaction_date', 'value_date'];
    const detectedDate = result.headers.find((h, i) => 
      dateKeywords.some(k => headers[i].includes(k))
    );
    if (detectedDate) setPaymentDateColumn(detectedDate);

    // Auto-detect reference column
    const refKeywords = ['reference', 'ref', 'payment_ref', 'transaction_id', 'id'];
    const detectedRef = result.headers.find((h, i) => 
      refKeywords.some(k => headers[i].includes(k))
    );
    if (detectedRef) setPaymentReferenceColumn(detectedRef);
  }, []);

  const canProceed = csvData && paymentDateColumn && paymentReferenceColumn && providerName;

  const handleProceed = () => {
    if (!csvData || !paymentDateColumn || !paymentReferenceColumn || !providerName) return;
    
    onComplete({
      csvData,
      paymentDateColumn,
      paymentReferenceColumn,
      providerName,
    });
  };

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <CSVUpload onFileLoaded={handleFileLoaded} />

      {csvData && (
        <>
          {/* Preview Table */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <FileSpreadsheet className="h-4 w-4" />
                Data Preview
              </CardTitle>
              <CardDescription>
                First {Math.min(5, csvData.totalRows)} of {csvData.totalRows} rows
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto rounded-md border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/50">
                      {csvData.headers.map((header, i) => (
                        <th key={i} className="px-3 py-2 text-left font-medium text-muted-foreground whitespace-nowrap">
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {csvData.rows.slice(0, 5).map((row, rowIndex) => (
                      <tr key={rowIndex} className="border-t">
                        {csvData.headers.map((header, colIndex) => (
                          <td key={colIndex} className="px-3 py-2 text-foreground whitespace-nowrap">
                            {row[header] || <span className="text-muted-foreground">-</span>}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Column Selection */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Identify Key Columns</CardTitle>
              <CardDescription>
                Help us understand your CSV structure by identifying these key columns
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="dateColumn">Payment Date Column *</Label>
                  <Select value={paymentDateColumn} onValueChange={setPaymentDateColumn}>
                    <SelectTrigger id="dateColumn">
                      <SelectValue placeholder="Select date column" />
                    </SelectTrigger>
                    <SelectContent>
                      {csvData.headers.map((header) => (
                        <SelectItem key={header} value={header}>
                          {header}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="refColumn">Payment Reference Column *</Label>
                  <Select value={paymentReferenceColumn} onValueChange={setPaymentReferenceColumn}>
                    <SelectTrigger id="refColumn">
                      <SelectValue placeholder="Select reference column" />
                    </SelectTrigger>
                    <SelectContent>
                      {csvData.headers.map((header) => (
                        <SelectItem key={header} value={header}>
                          {header}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="provider" className="flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  Financial Provider / Bank Name *
                </Label>
                <Input
                  id="provider"
                  placeholder="e.g., Fundment, Aviva, Standard Life"
                  value={providerName}
                  onChange={(e) => setProviderName(e.target.value)}
                />
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button onClick={handleProceed} disabled={!canProceed} size="lg">
              Analyze with AI
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
