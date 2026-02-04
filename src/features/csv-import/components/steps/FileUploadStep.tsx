import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowRight, ArrowLeft, FileSpreadsheet, Building2, Calendar, Hash } from 'lucide-react';
import { CSVUpload } from '../CSVUpload';
import { CSVParseResult, FileUploadInputs, PaymentHeaderInputs } from '../../types';

interface FileUploadStepProps {
  paymentHeader: PaymentHeaderInputs;
  onComplete: (inputs: FileUploadInputs) => void;
  onBack: () => void;
}

export function FileUploadStep({ paymentHeader, onComplete, onBack }: FileUploadStepProps) {
  const [csvData, setCsvData] = useState<CSVParseResult | null>(null);

  const handleFileLoaded = useCallback((result: CSVParseResult) => {
    setCsvData(result);
  }, []);

  const handleProceed = () => {
    if (!csvData) return;
    onComplete({ csvData });
  };

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* Payment Header Summary */}
      <Card className="bg-muted/30 border-muted">
        <CardContent className="pt-4">
          <div className="flex items-center gap-2 mb-3">
            <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
              Payment Header
            </Badge>
          </div>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Provider:</span>
              <span className="font-medium">{paymentHeader.providerName}</span>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Date:</span>
              <span className="font-medium">{paymentHeader.paymentDate}</span>
            </div>
            <div className="flex items-center gap-2">
              <Hash className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Ref:</span>
              <span className="font-medium truncate">{paymentHeader.paymentReference}</span>
            </div>
          </div>
        </CardContent>
      </Card>

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
                First {Math.min(5, csvData.totalRows)} of {csvData.totalRows} line items
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

          <div className="flex justify-between">
            <Button variant="outline" onClick={onBack}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <Button onClick={handleProceed} disabled={!csvData} size="lg">
              Analyze with AI
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        </>
      )}

      {!csvData && (
        <div className="flex justify-start">
          <Button variant="outline" onClick={onBack}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        </div>
      )}
    </div>
  );
}
