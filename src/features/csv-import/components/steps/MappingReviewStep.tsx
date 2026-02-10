import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@/components/ui/alert';
import { 
  ArrowLeft, 
  ArrowRight, 
  AlertTriangle, 
  Sparkles,
} from 'lucide-react';
import { FieldMappingRow } from '../FieldMappingRow';
import { autoSuggestValueMappings } from '../ValueMappingPanel';
import { 
  FieldMapping, 
  FieldMappingConfig,
  AIMappingResult, 
  INTERNAL_FIELDS, 
  FIELD_VALIDATION,
  FileUploadInputs, 
  PaymentHeaderInputs,
  DefaultFieldValue,
} from '../../types';

interface MappingReviewStepProps {
  fileInputs: FileUploadInputs;
  paymentHeader: PaymentHeaderInputs;
  aiResult: AIMappingResult;
  initialDefaults?: DefaultFieldValue[];
  onBack: () => void;
  onComplete: (mappings: FieldMapping[], rowOffset: number, defaults: DefaultFieldValue[]) => void;
}

const confidenceColors = {
  high: 'bg-green-500/10 text-green-600 border-green-500/20',
  medium: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20',
  low: 'bg-red-500/10 text-red-600 border-red-500/20',
};

export function MappingReviewStep({ 
  fileInputs, 
  paymentHeader, 
  aiResult, 
  initialDefaults = [],
  onBack, 
  onComplete 
}: MappingReviewStepProps) {
  const [rowOffset, setRowOffset] = useState(aiResult.suggestedRowOffset);
  
  // Initialize field configs from AI suggestions
  const [fieldConfigs, setFieldConfigs] = useState<Record<string, FieldMappingConfig>>(() => {
    const configs: Record<string, FieldMappingConfig> = {};
    
    INTERNAL_FIELDS.forEach(field => {
      // Check if AI mapped this field
      const aiMapping = aiResult.mappings.find(m => m.targetField === field.value && !m.ignored);
      
      // Check if there's an initial default for this field
      const initialDefault = initialDefaults.find(d => d.targetField === field.value && d.enabled);
      
      if (initialDefault) {
        // Use existing default
        configs[field.value] = {
          targetField: field.value,
          source: initialDefault.source,
          headerField: initialDefault.headerField,
          hardcodedValue: initialDefault.hardcodedValue,
        };
      } else if (aiMapping) {
        // Use AI suggestion
        configs[field.value] = {
          targetField: field.value,
          source: 'csv',
          csvColumn: aiMapping.csvColumn,
        };
      } else if (field.value === 'payment_date') {
        // Default payment_date to header inheritance
        configs[field.value] = {
          targetField: field.value,
          source: 'header',
          headerField: 'paymentDate',
        };
      } else {
        // Default to CSV with no column selected
        configs[field.value] = {
          targetField: field.value,
          source: 'csv',
          csvColumn: undefined,
        };
      }
    });
    
    return configs;
  });

  // Get AI mapping info for a field
  const getAIMapping = (targetField: string) => {
    return aiResult.mappings.find(m => m.targetField === targetField && !m.ignored);
  };

  const updateFieldConfig = (targetField: string, config: FieldMappingConfig) => {
    setFieldConfigs(prev => ({
      ...prev,
      [targetField]: config,
    }));
  };

  // Convert current configs back to the legacy format for onComplete
  const handleProceed = () => {
    const mappings: FieldMapping[] = [];
    const defaults: DefaultFieldValue[] = [];

    Object.values(fieldConfigs).forEach(config => {
      if (config.source === 'csv' && config.csvColumn) {
        // Find the original AI mapping for sample values
        const aiMapping = aiResult.mappings.find(m => m.csvColumn === config.csvColumn);
        mappings.push({
          csvColumn: config.csvColumn,
          targetField: config.targetField,
          confidence: aiMapping?.confidence || 'high',
          sampleValues: aiMapping?.sampleValues || [],
          ignored: false,
        });
      } else if (config.source === 'header' || config.source === 'hardcoded') {
        defaults.push({
          targetField: config.targetField,
          source: config.source,
          headerField: config.headerField,
          hardcodedValue: config.hardcodedValue,
          enabled: true,
        });
      }
    });

    // Add any ignored CSV columns from AI analysis
    aiResult.mappings.forEach(m => {
      const isUsed = mappings.some(mapping => mapping.csvColumn === m.csvColumn);
      if (!isUsed) {
        mappings.push({
          ...m,
          ignored: true,
          targetField: '',
        });
      }
    });

    onComplete(mappings, rowOffset, defaults);
  };

  // Count how many required fields are configured
  const requiredFieldsCount = useMemo(() => {
    const required = INTERNAL_FIELDS.filter(f => f.required);
    const configured = required.filter(f => {
      const config = fieldConfigs[f.value];
      if (!config) return false;
      if (config.source === 'csv') return !!config.csvColumn;
      if (config.source === 'header') return !!config.headerField;
      if (config.source === 'hardcoded') return !!config.hardcodedValue;
      return false;
    });
    return { total: required.length, configured: configured.length };
  }, [fieldConfigs]);

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Structural Issues Warning */}
      {aiResult.structuralIssues.length > 0 && (
        <Alert variant="destructive" className="border-yellow-500/50 bg-yellow-500/10">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Structural Issues Detected</AlertTitle>
          <AlertDescription className="mt-2 space-y-2">
            {aiResult.structuralIssues.map((issue, i) => (
              <div key={i} className="text-sm">
                <strong>{issue.description}</strong>
                <p className="text-muted-foreground">{issue.suggestedFix}</p>
              </div>
            ))}
          </AlertDescription>
        </Alert>
      )}

      {/* AI Analysis Summary */}
      <Card className="bg-primary/5 border-primary/20">
        <CardContent className="pt-4">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Sparkles className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-medium">AI Analysis Complete</h3>
                <Badge className={confidenceColors[aiResult.overallConfidence]}>
                  {aiResult.overallConfidence} confidence
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                Mapping for <strong>{paymentHeader.providerName}</strong> • {fileInputs.csvData.totalRows} line items
              </p>
              {aiResult.analysisNotes && (
                <p className="text-sm text-muted-foreground mt-1">{aiResult.analysisNotes}</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Row Offset Setting */}
      {aiResult.suggestedRowOffset > 0 && (
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium">Row Offset</h4>
                <p className="text-sm text-muted-foreground">
                  Data appears to start on row {aiResult.suggestedRowOffset + 1}
                </p>
              </div>
              <Select value={String(rowOffset)} onValueChange={(v) => setRowOffset(Number(v))}>
                <SelectTrigger className="w-24">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-popover border shadow-lg z-50">
                  {[0, 1, 2, 3, 4, 5].map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      Row {n + 1}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Field Mappings Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Field Mappings</span>
            <Badge variant="outline">
              {requiredFieldsCount.configured}/{requiredFieldsCount.total} required fields
            </Badge>
          </CardTitle>
          <CardDescription>
            For each field, choose whether to map from a CSV column, inherit from the payment header, or set a fixed value.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-muted/50 text-left">
                  <th className="px-4 py-3 font-medium text-muted-foreground">Target Field</th>
                  <th className="px-4 py-3 font-medium text-muted-foreground">Source</th>
                  <th className="px-4 py-3 font-medium text-muted-foreground">Value</th>
                  <th className="px-4 py-3 font-medium text-muted-foreground text-center">AI</th>
                </tr>
              </thead>
              <tbody>
                {INTERNAL_FIELDS.map((field) => {
                  const aiMapping = getAIMapping(field.value);
                  return (
                    <FieldMappingRow
                      key={field.value}
                      targetField={field.value}
                      label={field.label}
                      required={field.required}
                      config={fieldConfigs[field.value]}
                      csvColumns={fileInputs.csvData.columns}
                      paymentHeader={paymentHeader}
                      aiSuggestedColumn={aiMapping?.csvColumn}
                      aiConfidence={aiMapping?.confidence}
                      onChange={(config) => updateFieldConfig(field.value, config)}
                    />
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <Button 
          onClick={handleProceed} 
          size="lg"
          disabled={requiredFieldsCount.configured < requiredFieldsCount.total}
        >
          Continue to Validation
          <ArrowRight className="h-4 w-4 ml-2" />
        </Button>
      </div>
    </div>
  );
}
