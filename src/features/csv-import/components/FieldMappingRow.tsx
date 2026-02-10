import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
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
  FileSpreadsheet, 
  Link2, 
  Edit3, 
  CheckCircle2, 
  AlertTriangle,
  HelpCircle 
} from 'lucide-react';
import { 
  FieldSource, 
  FieldMappingConfig, 
  PaymentHeaderInputs,
  HEADER_FIELD_OPTIONS,
  FIELD_VALIDATION,
  CSVColumn,
} from '../types';
import { ValueMappingPanel } from './ValueMappingPanel';

interface FieldMappingRowProps {
  targetField: string;
  label: string;
  required: boolean;
  config: FieldMappingConfig;
  csvColumns: CSVColumn[];
  paymentHeader: PaymentHeaderInputs;
  aiSuggestedColumn?: string;
  aiConfidence?: 'high' | 'medium' | 'low';
  uniqueCsvValues?: string[];  // Unique values from the mapped CSV column
  onChange: (config: FieldMappingConfig) => void;
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

export function FieldMappingRow({
  targetField,
  label,
  required,
  config,
  csvColumns,
  paymentHeader,
  aiSuggestedColumn,
  aiConfidence,
  uniqueCsvValues,
  onChange,
}: FieldMappingRowProps) {
  const [validationError, setValidationError] = useState<string | null>(null);

  const validation = FIELD_VALIDATION[targetField];

  const validateHardcodedValue = (value: string): string | null => {
    if (!value && required) return 'This field is required';
    if (!value) return null;
    
    if (!validation) return null;

    switch (validation.type) {
      case 'date':
        // Check YYYY-MM-DD format
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!dateRegex.test(value)) {
          return `Must be in ${validation.format || 'YYYY-MM-DD'} format`;
        }
        // Validate it's a real date
        const parsed = new Date(value);
        if (isNaN(parsed.getTime())) {
          return 'Invalid date';
        }
        break;
      case 'number':
        const num = parseFloat(value.replace(/[,£$]/g, ''));
        if (isNaN(num)) {
          return 'Must be a valid number';
        }
        break;
      case 'enum':
        if (validation.options && !validation.options.includes(value)) {
          return `Must be one of: ${validation.options.join(', ')}`;
        }
        break;
    }
    return null;
  };

  const handleSourceChange = (source: FieldSource) => {
    setValidationError(null);
    onChange({
      ...config,
      source,
      csvColumn: source === 'csv' ? (aiSuggestedColumn || config.csvColumn) : undefined,
      headerField: source === 'header' ? getDefaultHeaderField() : undefined,
      hardcodedValue: source === 'hardcoded' ? '' : undefined,
    });
  };

  const handleCsvColumnChange = (column: string) => {
    onChange({ ...config, csvColumn: column === '__none__' ? undefined : column });
  };

  const handleHeaderFieldChange = (field: keyof PaymentHeaderInputs) => {
    onChange({ ...config, headerField: field });
  };

  const handleHardcodedChange = (value: string) => {
    const error = validateHardcodedValue(value);
    setValidationError(error);
    onChange({ ...config, hardcodedValue: value });
  };

  // Get a sensible default header field based on target field
  const getDefaultHeaderField = (): keyof PaymentHeaderInputs => {
    if (targetField === 'payment_date') return 'paymentDate';
    if (targetField === 'payment_reference') return 'paymentReference';
    if (targetField === 'amount') return 'paymentAmount';
    return 'providerName';
  };

  // Get display value for selected header field
  const getHeaderValue = (field: keyof PaymentHeaderInputs): string => {
    const val = paymentHeader[field];
    return val?.toString() || '(not set)';
  };

  const ConfidenceIcon = aiConfidence ? confidenceIcons[aiConfidence] : null;

  return (
    <tr className="border-t">
      {/* Field Name */}
      <td className="px-4 py-3">
        <div className="font-medium">
          {label}
          {required && <span className="text-destructive ml-1">*</span>}
        </div>
      </td>

      {/* Source Selection */}
      <td className="px-4 py-3">
        <Select value={config.source} onValueChange={(v) => handleSourceChange(v as FieldSource)}>
          <SelectTrigger className="w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-popover border shadow-lg z-50">
            <SelectItem value="csv">
              <span className="flex items-center gap-2">
                <FileSpreadsheet className="h-3 w-3" />
                CSV Column
              </span>
            </SelectItem>
            <SelectItem value="header">
              <span className="flex items-center gap-2">
                <Link2 className="h-3 w-3" />
                From Header
              </span>
            </SelectItem>
            <SelectItem value="hardcoded">
              <span className="flex items-center gap-2">
                <Edit3 className="h-3 w-3" />
                Fixed Value
              </span>
            </SelectItem>
          </SelectContent>
        </Select>
      </td>

      {/* Value Configuration */}
      <td className="px-4 py-3">
        {config.source === 'csv' && (
          <div className="flex items-center gap-2">
            <Select 
              value={config.csvColumn || '__none__'} 
              onValueChange={handleCsvColumnChange}
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Select column..." />
              </SelectTrigger>
              <SelectContent className="bg-popover border shadow-lg z-50 max-h-[300px]">
                <SelectItem value="__none__">
                  <span className="text-muted-foreground">— Not mapped —</span>
                </SelectItem>
                {csvColumns.filter(col => col.header && col.header.trim() !== '').map((col) => (
                  <SelectItem key={col.header} value={col.header}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span>{col.header}</span>
                      </TooltipTrigger>
                      <TooltipContent side="right" className="max-w-xs">
                        <p className="font-medium mb-1">Sample values:</p>
                        <ul className="text-xs">
                          {col.sampleValues.slice(0, 3).map((v, i) => (
                            <li key={i}>• {v || '(empty)'}</li>
                          ))}
                        </ul>
                      </TooltipContent>
                    </Tooltip>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {aiSuggestedColumn === config.csvColumn && aiConfidence && ConfidenceIcon && (
              <Badge variant="outline" className={confidenceColors[aiConfidence]}>
                <ConfidenceIcon className="h-3 w-3 mr-1" />
                AI
              </Badge>
            )}
          </div>
        )}

        {config.source === 'header' && (
          <div className="flex items-center gap-2">
            <Select 
              value={config.headerField || ''} 
              onValueChange={(v) => handleHeaderFieldChange(v as keyof PaymentHeaderInputs)}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Select field..." />
              </SelectTrigger>
              <SelectContent className="bg-popover border shadow-lg z-50">
                {HEADER_FIELD_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {config.headerField && (
              <span className="text-sm text-muted-foreground">
                = <span className="font-medium">{getHeaderValue(config.headerField)}</span>
              </span>
            )}
          </div>
        )}

        {config.source === 'hardcoded' && (
          <div className="space-y-1">
            {validation?.type === 'enum' && validation.options ? (
              <Select 
                value={config.hardcodedValue || ''} 
                onValueChange={handleHardcodedChange}
              >
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Select value..." />
                </SelectTrigger>
                <SelectContent className="bg-popover border shadow-lg z-50">
                  {validation.options.map((opt) => (
                    <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input
                value={config.hardcodedValue || ''}
                onChange={(e) => handleHardcodedChange(e.target.value)}
                placeholder={validation?.format || 'Enter value...'}
                className={`w-[200px] ${validationError ? 'border-destructive' : ''}`}
              />
            )}
            {validationError && (
              <p className="text-xs text-destructive">{validationError}</p>
            )}
          </div>
        )}
      </td>

      {/* AI Confidence (only for CSV mappings) */}
      <td className="px-4 py-3 text-center">
        {config.source === 'csv' && aiSuggestedColumn && config.csvColumn === aiSuggestedColumn && aiConfidence && ConfidenceIcon && (
          <Badge variant="outline" className={confidenceColors[aiConfidence]}>
            <ConfidenceIcon className="h-3 w-3 mr-1" />
            {aiConfidence}
          </Badge>
        )}
      </td>
    </tr>
  );
}
