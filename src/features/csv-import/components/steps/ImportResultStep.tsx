import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle2, AlertTriangle, XCircle, FileSpreadsheet, ArrowRight, RefreshCw } from 'lucide-react';

interface ImportResult {
  success: boolean;
  successCount: number;
  failedCount: number;
  totalRequested: number;
  paymentReference: string;
  error?: string;
}

interface ImportResultStepProps {
  result: ImportResult;
  onDone: () => void;
}

export function ImportResultStep({ result, onDone }: ImportResultStepProps) {
  const isFullSuccess = result.success && result.failedCount === 0;
  const isPartial = result.success && result.failedCount > 0;
  const isFailed = !result.success;

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <Card className={`border-2 ${
        isFullSuccess ? 'border-primary/30 bg-primary/5' :
        isPartial ? 'border-accent/30 bg-accent/5' :
        'border-destructive/30 bg-destructive/5'
      }`}>
        <CardHeader className="text-center pb-2">
          {isFullSuccess && <CheckCircle2 className="h-16 w-16 text-primary mx-auto mb-3" />}
          {isPartial && <AlertTriangle className="h-16 w-16 text-accent-foreground mx-auto mb-3" />}
          {isFailed && <XCircle className="h-16 w-16 text-destructive mx-auto mb-3" />}
          <CardTitle className="text-2xl">
            {isFullSuccess && 'Import Completed Successfully'}
            {isPartial && 'Import Partially Completed'}
            {isFailed && 'Import Failed'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-center gap-2 text-muted-foreground">
            <FileSpreadsheet className="h-4 w-4" />
            <span>Payment: <strong className="text-foreground">{result.paymentReference}</strong></span>
          </div>

          {result.success && (
            <div className="grid grid-cols-2 gap-4 pt-2">
              <div className="text-center p-4 rounded-lg bg-background border">
                <div className="text-3xl font-bold text-primary">{result.successCount}</div>
                <div className="text-sm text-muted-foreground mt-1">Line items imported</div>
              </div>
              {result.failedCount > 0 ? (
                <div className="text-center p-4 rounded-lg bg-background border">
                  <div className="text-3xl font-bold text-destructive">{result.failedCount}</div>
                  <div className="text-sm text-muted-foreground mt-1">Failed</div>
                </div>
              ) : (
                <div className="text-center p-4 rounded-lg bg-background border">
                  <div className="text-3xl font-bold text-foreground">{result.totalRequested}</div>
                  <div className="text-sm text-muted-foreground mt-1">Total requested</div>
                </div>
              )}
            </div>
          )}

          {result.error && (
            <div className="p-3 rounded-md bg-destructive/10 border border-destructive/20 text-sm text-destructive">
              {result.error}
            </div>
          )}

          {result.success && (
            <div className="flex items-start gap-3 p-3 rounded-md bg-muted/50 border border-border text-sm">
              <RefreshCw className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
              <p className="text-muted-foreground">
                To see these records on the reconciliation page, go to <strong className="text-foreground">Income Reconciliation</strong> and click <strong className="text-foreground">Load Data</strong> to download fresh data.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-center">
        <Button size="lg" onClick={onDone}>
          Done
          <ArrowRight className="h-4 w-4 ml-2" />
        </Button>
      </div>
    </div>
  );
}
