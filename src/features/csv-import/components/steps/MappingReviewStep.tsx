import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectGroup,
  SelectLabel,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@/components/ui/alert';
import { 
  ArrowLeft, 
  ArrowRight, 
  AlertTriangle, 
  CheckCircle2, 
  HelpCircle,
  Eye,
  EyeOff,
  Sparkles,
  Link2,
  Settings2
} from 'lucide-react';
import { 
  FieldMapping, 
  AIMappingResult, 
  INTERNAL_FIELDS, 
  FileUploadInputs, 
  PaymentHeaderInputs,
  DefaultFieldValue,
  INHERITABLE_FIELDS,
  DEFAULTABLE_FIELDS
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

const confidenceIcons = {
  high: CheckCircle2,
  medium: HelpCircle,
  low: AlertTriangle,
};

export function MappingReviewStep({ 
  fileInputs, 
  paymentHeader, 
  aiResult, 
  initialDefaults = [],
  onBack, 
  onComplete 
}: MappingReviewStepProps) {
  const [mappings, setMappings] = useState<FieldMapping[]>(aiResult.mappings);
  const [rowOffset, setRowOffset] = useState(aiResult.suggestedRowOffset);
  
  // Initialize default values - auto-enable date inheritance
  const [defaultValues, setDefaultValues] = useState<DefaultFieldValue[]>(() => {
    if (initialDefaults.length > 0) return initialDefaults;
    
    // Check if payment_date is already mapped from CSV
    const dateIsMapped = aiResult.mappings.some(m => m.targetField === 'payment_date' && !m.ignored);
    
    return [
      // Auto-enable date inheritance if not mapped from CSV
      {
        targetField: 'payment_date',
        source: 'header' as const,
        headerField: 'paymentDate' as const,
        enabled: !dateIsMapped,
      },
      // Initialize other defaultable fields as disabled
      ...DEFAULTABLE_FIELDS.map(field => ({
        targetField: field.value,
        source: 'hardcoded' as const,
        hardcodedValue: '',
        enabled: false,
      })),
    ];
  });

  const updateMapping = (csvColumn: string, targetField: string) => {
    setMappings(prev => prev.map(m => 
      m.csvColumn === csvColumn 
        ? { ...m, targetField, ignored: targetField === '', confidence: 'high' as const }
        : m
    ));
    
    // If mapping a field that has a default, disable the default
    if (targetField) {
      setDefaultValues(prev => prev.map(d => 
        d.targetField === targetField ? { ...d, enabled: false } : d
      ));
    }
  };

  const toggleIgnore = (csvColumn: string) => {
    setMappings(prev => prev.map(m => 
      m.csvColumn === csvColumn 
        ? { ...m, ignored: !m.ignored, targetField: !m.ignored ? '' : m.targetField }
        : m
    ));
  };

  const toggleDefault = (targetField: string, enabled: boolean) => {
    setDefaultValues(prev => prev.map(d => 
      d.targetField === targetField ? { ...d, enabled } : d
    ));
    
    // If enabling a default, remove any CSV mapping for that field
    if (enabled) {
      setMappings(prev => prev.map(m => 
        m.targetField === targetField ? { ...m, targetField: '', ignored: true } : m
      ));
    }
  };

  const updateHardcodedValue = (targetField: string, value: string) => {
    setDefaultValues(prev => prev.map(d => 
      d.targetField === targetField ? { ...d, hardcodedValue: value } : d
    ));
  };

  const handleProceed = () => {
    onComplete(mappings, rowOffset, defaultValues.filter(d => d.enabled));
  };

  // Get the display value for an inherited field
  const getHeaderDisplayValue = (headerField: keyof PaymentHeaderInputs) => {
    const value = paymentHeader[headerField];
    return value?.toString() || '(not set)';
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
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

      {/* Default/Inherited Values */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Settings2 className="h-4 w-4" />
            Default Values
          </CardTitle>
          <CardDescription>
            Set values that apply to all line items, either inherited from the payment header or hardcoded
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Inherited from Header */}
          <div className="space-y-3">
            <Label className="text-sm font-medium flex items-center gap-2">
              <Link2 className="h-4 w-4" />
              Inherit from Payment Header
            </Label>
            {INHERITABLE_FIELDS.map(field => {
              const defaultVal = defaultValues.find(d => d.targetField === field.targetField);
              const isMappedFromCSV = mappings.some(m => m.targetField === field.targetField && !m.ignored);
              
              return (
                <div key={field.targetField} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                  <div className="flex items-center gap-3">
                    <Switch 
                      checked={defaultVal?.enabled || false}
                      onCheckedChange={(checked) => toggleDefault(field.targetField, checked)}
                      disabled={isMappedFromCSV}
                    />
                    <div>
                      <span className="font-medium">{field.label}</span>
                      {isMappedFromCSV && (
                        <span className="text-xs text-muted-foreground ml-2">(mapped from CSV)</span>
                      )}
                    </div>
                  </div>
                  <div className="text-sm">
                    <span className="text-muted-foreground">Value: </span>
                    <span className="font-medium">{getHeaderDisplayValue(field.headerField)}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Hardcoded Defaults */}
          <div className="space-y-3 pt-2">
            <Label className="text-sm font-medium">Hardcoded Defaults (Optional)</Label>
            {DEFAULTABLE_FIELDS.map(field => {
              const defaultVal = defaultValues.find(d => d.targetField === field.value);
              const isMappedFromCSV = mappings.some(m => m.targetField === field.value && !m.ignored);
              
              return (
                <div key={field.value} className="flex items-center gap-4 p-3 bg-muted/30 rounded-lg">
                  <Switch 
                    checked={defaultVal?.enabled || false}
                    onCheckedChange={(checked) => toggleDefault(field.value, checked)}
                    disabled={isMappedFromCSV}
                  />
                  <div className="flex-1">
                    <span className="font-medium">{field.label}</span>
                    {isMappedFromCSV && (
                      <span className="text-xs text-muted-foreground ml-2">(mapped from CSV)</span>
                    )}
                  </div>
                  {defaultVal?.enabled && (
                    <Select 
                      value={defaultVal?.hardcodedValue || ''} 
                      onValueChange={(v) => updateHardcodedValue(field.value, v)}
                    >
                      <SelectTrigger className="w-[150px]">
                        <SelectValue placeholder="Select..." />
                      </SelectTrigger>
                      <SelectContent className="bg-popover border shadow-lg z-50">
                        {field.options.map(opt => (
                          <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              );
            })}
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

      {/* Mapping Table */}
      <Card>
        <CardHeader>
          <CardTitle>CSV Column Mappings</CardTitle>
          <CardDescription>
            Review and adjust the AI-suggested mappings. Fields with defaults above don't need CSV mapping.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <table className="w-full">
              <thead>
                <tr className="bg-muted/50 text-left">
                  <th className="px-4 py-3 font-medium text-muted-foreground">CSV Column</th>
                  <th className="px-4 py-3 font-medium text-muted-foreground">Mapped To</th>
                  <th className="px-4 py-3 font-medium text-muted-foreground text-center">Confidence</th>
                  <th className="px-4 py-3 font-medium text-muted-foreground text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {mappings.map((mapping) => {
                  const ConfidenceIcon = confidenceIcons[mapping.confidence];
                  const hasDefault = defaultValues.some(d => d.targetField === mapping.targetField && d.enabled);
                  
                  return (
                    <tr 
                      key={mapping.csvColumn} 
                      className={`border-t ${mapping.ignored ? 'bg-muted/30 opacity-60' : ''}`}
                    >
                      <td className="px-4 py-3">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="cursor-help">
                              <div className="font-medium">{mapping.csvColumn}</div>
                              <div className="text-xs text-muted-foreground truncate max-w-[200px]">
                                {mapping.sampleValues.slice(0, 2).join(', ')}
                              </div>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent side="right" className="max-w-xs">
                            <p className="font-medium mb-1">Sample Values:</p>
                            <ul className="text-xs space-y-0.5">
                              {mapping.sampleValues.map((v, i) => (
                                <li key={i}>• {v || '(empty)'}</li>
                              ))}
                            </ul>
                          </TooltipContent>
                        </Tooltip>
                      </td>
                      <td className="px-4 py-3">
                        <Select 
                          value={mapping.targetField || '_ignore'} 
                          onValueChange={(v) => updateMapping(mapping.csvColumn, v === '_ignore' ? '' : v)}
                          disabled={mapping.ignored}
                        >
                          <SelectTrigger className="w-[200px]">
                            <SelectValue placeholder="Select field..." />
                          </SelectTrigger>
                          <SelectContent className="bg-popover border shadow-lg z-50 max-h-[300px]">
                            <SelectItem value="_ignore">
                              <span className="text-muted-foreground">— Skip this column —</span>
                            </SelectItem>
                            
                            {/* CSV Mappable Fields */}
                            <SelectGroup>
                              <SelectLabel className="text-xs font-semibold text-muted-foreground px-2 py-1.5">
                                Map from CSV Column
                              </SelectLabel>
                              {INTERNAL_FIELDS.filter(field => {
                                const fieldHasDefault = defaultValues.some(d => d.targetField === field.value && d.enabled);
                                return !fieldHasDefault;
                              }).map((field) => (
                                <SelectItem 
                                  key={field.value} 
                                  value={field.value}
                                >
                                  {field.label}
                                  {field.required && <span className="text-destructive ml-1">*</span>}
                                </SelectItem>
                              ))}
                            </SelectGroup>
                            
                            {/* Fields with Header Defaults */}
                            {defaultValues.some(d => d.enabled) && (
                              <SelectGroup>
                                <SelectLabel className="text-xs font-semibold text-muted-foreground px-2 py-1.5 border-t mt-1 pt-2">
                                  Using Default Value (from header)
                                </SelectLabel>
                                {INTERNAL_FIELDS.filter(field => {
                                  const fieldHasDefault = defaultValues.some(d => d.targetField === field.value && d.enabled);
                                  return fieldHasDefault;
                                }).map((field) => (
                                  <SelectItem 
                                    key={field.value} 
                                    value={field.value}
                                    disabled
                                    className="opacity-50"
                                  >
                                    {field.label}
                                    <span className="text-muted-foreground ml-1 text-xs">(inherited)</span>
                                  </SelectItem>
                                ))}
                              </SelectGroup>
                            )}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {!mapping.ignored && (
                          <Badge variant="outline" className={confidenceColors[mapping.confidence]}>
                            <ConfidenceIcon className="h-3 w-3 mr-1" />
                            {mapping.confidence}
                          </Badge>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleIgnore(mapping.csvColumn)}
                          className={mapping.ignored ? 'text-muted-foreground' : ''}
                        >
                          {mapping.ignored ? (
                            <>
                              <EyeOff className="h-4 w-4 mr-1" />
                              Ignored
                            </>
                          ) : (
                            <>
                              <Eye className="h-4 w-4 mr-1" />
                              Active
                            </>
                          )}
                        </Button>
                      </td>
                    </tr>
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
        <Button onClick={handleProceed} size="lg">
          Continue to Validation
          <ArrowRight className="h-4 w-4 ml-2" />
        </Button>
      </div>
    </div>
  );
}
