import { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@/components/ui/alert';
import { 
  ArrowLeft, 
  CheckCircle2, 
  AlertCircle, 
  Upload, 
  FileSpreadsheet,
  ArrowRight,
  Building2,
  Calendar,
  Hash
} from 'lucide-react';
import { FieldMapping, DefaultFieldValue, FileUploadInputs, PaymentHeaderInputs, INTERNAL_FIELDS } from '../../types';

interface ValidationStepProps {
  fileInputs: FileUploadInputs;
  paymentHeader: PaymentHeaderInputs;
  mappings: FieldMapping[];
  defaultValues?: DefaultFieldValue[];
  rowOffset: number;
  onBack: () => void;
  onConfirm: () => void;
  isSubmitting?: boolean;
}

export function ValidationStep({ 
  fileInputs, 
  paymentHeader,
  mappings, 
  rowOffset, 
  onBack, 
  onConfirm,
  isSubmitting = false 
}: ValidationStepProps) {
  const validation = useMemo(() => {
    const requiredFields = INTERNAL_FIELDS.filter(f => f.required);
    const mappedFields = mappings.filter(m => !m.ignored && m.targetField).map(m => m.targetField);
    
    const missingRequired = requiredFields.filter(f => !mappedFields.includes(f.value));
    const duplicateMappings = mappedFields.filter((f, i) => mappedFields.indexOf(f) !== i);
    
    const errors: string[] = [];
    const warnings: string[] = [];

    if (missingRequired.length > 0) {
      errors.push(`Missing required fields: ${missingRequired.map(f => f.label).join(', ')}`);
    }

    if (duplicateMappings.length > 0) {
      const dupeLabels = [...new Set(duplicateMappings)].map(d => 
        INTERNAL_FIELDS.find(f => f.value === d)?.label || d
      );
      errors.push(`Duplicate mappings: ${dupeLabels.join(', ')}`);
    }

    const activeMappings = mappings.filter(m => !m.ignored && m.targetField);
    if (activeMappings.length === 0) {
      errors.push('No columns are mapped. At least one column must be mapped.');
    }

    const lowConfidenceCount = activeMappings.filter(m => m.confidence === 'low').length;
    if (lowConfidenceCount > 0) {
      warnings.push(`${lowConfidenceCount} mapping(s) have low confidence and may need verification`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      activeMappings,
      ignoredCount: mappings.filter(m => m.ignored).length,
    };
  }, [mappings]);

  const effectiveRowCount = fileInputs.csvData.totalRows - rowOffset;

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* Validation Status */}
      {!validation.isValid ? (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Validation Failed</AlertTitle>
          <AlertDescription>
            <ul className="list-disc list-inside mt-2 space-y-1">
              {validation.errors.map((error, i) => (
                <li key={i}>{error}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      ) : (
        <Alert className="border-green-500/50 bg-green-500/10">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <AlertTitle className="text-green-600">Ready to Import</AlertTitle>
          <AlertDescription className="text-green-600/80">
            All required fields are mapped. Review the summary below and confirm to proceed.
          </AlertDescription>
        </Alert>
      )}

      {validation.warnings.length > 0 && (
        <Alert className="border-yellow-500/50 bg-yellow-500/10">
          <AlertCircle className="h-4 w-4 text-yellow-600" />
          <AlertTitle className="text-yellow-600">Warnings</AlertTitle>
          <AlertDescription className="text-yellow-600/80">
            <ul className="list-disc list-inside mt-1">
              {validation.warnings.map((warning, i) => (
                <li key={i}>{warning}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {/* Payment Header Summary */}
      <Card className="border-primary/20 bg-primary/5">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            Bank Payment Header
          </CardTitle>
          <CardDescription>
            This record will be created in Zoho first
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Provider:</span>
              <span className="text-sm font-medium">{paymentHeader.providerName}</span>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Date:</span>
              <span className="text-sm font-medium">{paymentHeader.paymentDate}</span>
            </div>
            <div className="flex items-center gap-2">
              <Hash className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Reference:</span>
              <span className="text-sm font-medium">{paymentHeader.paymentReference}</span>
            </div>
            {paymentHeader.paymentAmount && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Amount:</span>
                <span className="text-sm font-medium">£{paymentHeader.paymentAmount.toLocaleString()}</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Import Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Line Items Summary
          </CardTitle>
          <CardDescription>
            These records will be attached to the payment header
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* File Info */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-muted/50 rounded-lg p-4">
              <div className="text-sm text-muted-foreground mb-1">Source File</div>
              <div className="font-medium">{fileInputs.csvData.fileName}</div>
            </div>
            <div className="bg-muted/50 rounded-lg p-4">
              <div className="text-sm text-muted-foreground mb-1">Rows to Import</div>
              <div className="font-medium">{effectiveRowCount.toLocaleString()}</div>
            </div>
            <div className="bg-muted/50 rounded-lg p-4">
              <div className="text-sm text-muted-foreground mb-1">Columns Mapped</div>
              <div className="font-medium">
                {validation.activeMappings.length} of {mappings.length}
                {validation.ignoredCount > 0 && (
                  <span className="text-muted-foreground font-normal"> ({validation.ignoredCount} ignored)</span>
                )}
              </div>
            </div>
            {rowOffset > 0 && (
              <div className="bg-muted/50 rounded-lg p-4">
                <div className="text-sm text-muted-foreground mb-1">Row Offset</div>
                <div className="font-medium">Starting from row {rowOffset + 1}</div>
              </div>
            )}
          </div>

          {/* Mapping Summary */}
          <div>
            <h4 className="font-medium mb-3">Field Mappings</h4>
            <div className="space-y-2">
              {validation.activeMappings.map((mapping) => {
                const field = INTERNAL_FIELDS.find(f => f.value === mapping.targetField);
                return (
                  <div 
                    key={mapping.csvColumn}
                    className="flex items-center justify-between py-2 px-3 bg-muted/30 rounded-lg"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">{mapping.csvColumn}</span>
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{field?.label || mapping.targetField}</span>
                      {field?.required && (
                        <Badge variant="outline" className="text-xs">Required</Badge>
                      )}
                    </div>
                    <Badge 
                      variant="outline" 
                      className={
                        mapping.confidence === 'high' ? 'bg-green-500/10 text-green-600' :
                        mapping.confidence === 'medium' ? 'bg-yellow-500/10 text-yellow-600' :
                        'bg-red-500/10 text-red-600'
                      }
                    >
                      {mapping.confidence}
                    </Badge>
                  </div>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack} disabled={isSubmitting}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Mappings
        </Button>
        <Button 
          onClick={onConfirm} 
          disabled={!validation.isValid || isSubmitting}
          size="lg"
          className="min-w-[200px]"
        >
          {isSubmitting ? (
            <>
              <div className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full mr-2" />
              Importing...
            </>
          ) : (
            <>
              <Upload className="h-4 w-4 mr-2" />
              Confirm & Import
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
