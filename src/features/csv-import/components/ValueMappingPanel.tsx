import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ArrowRight, Sparkles } from 'lucide-react';

interface ValueMappingPanelProps {
  uniqueValues: string[];
  enumOptions: string[];
  valueMappings: Record<string, string>;
  onChange: (mappings: Record<string, string>) => void;
}

/**
 * Fuzzy match a CSV value to enum options.
 * Returns the best match or null.
 */
function fuzzyMatchEnum(csvValue: string, options: string[]): string | null {
  const normalized = csvValue.toLowerCase().trim().replace(/[_\-\s]+/g, '');

  // Exact match after normalisation
  for (const opt of options) {
    if (opt.toLowerCase().replace(/[_\-\s]+/g, '') === normalized) return opt;
  }

  // Check if the CSV value contains the option or vice versa
  for (const opt of options) {
    const normOpt = opt.toLowerCase().replace(/[_\-\s]+/g, '');
    if (normalized.includes(normOpt) || normOpt.includes(normalized)) return opt;
  }

  // Word-level matching: check if any word in the CSV value matches an option
  const words = csvValue.toLowerCase().split(/[\s_\-,]+/).filter(Boolean);
  for (const opt of options) {
    const normOpt = opt.toLowerCase();
    if (words.includes(normOpt)) return opt;
  }

  return null;
}

/**
 * Auto-suggest value mappings for a set of unique CSV values against enum options.
 */
export function autoSuggestValueMappings(
  uniqueValues: string[],
  enumOptions: string[]
): Record<string, string> {
  const mappings: Record<string, string> = {};
  for (const val of uniqueValues) {
    if (!val || !val.trim()) continue;
    const match = fuzzyMatchEnum(val, enumOptions);
    if (match) {
      mappings[val] = match;
    }
  }
  return mappings;
}

export function ValueMappingPanel({
  uniqueValues,
  enumOptions,
  valueMappings,
  onChange,
}: ValueMappingPanelProps) {
  const nonEmptyValues = uniqueValues.filter(v => v && v.trim());

  if (nonEmptyValues.length === 0) return null;

  const handleChange = (csvValue: string, enumValue: string) => {
    onChange({
      ...valueMappings,
      [csvValue]: enumValue === '__unmapped__' ? '' : enumValue,
    });
  };

  const mappedCount = nonEmptyValues.filter(v => valueMappings[v]).length;

  return (
    <tr>
      <td colSpan={4} className="px-4 pb-3 pt-0">
        <div className="ml-4 border-l-2 border-primary/20 pl-4 py-2 space-y-2">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Sparkles className="h-3 w-3 text-primary" />
            <span>
              Map CSV values to options ({mappedCount}/{nonEmptyValues.length} mapped)
            </span>
          </div>
          <div className="space-y-1.5">
            {nonEmptyValues.map((csvValue) => {
              const mapped = valueMappings[csvValue];
              return (
                <div key={csvValue} className="flex items-center gap-2 text-sm">
                  <Badge variant="outline" className="font-mono text-xs min-w-[100px] justify-center">
                    {csvValue}
                  </Badge>
                  <ArrowRight className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                  <Select
                    value={mapped || '__unmapped__'}
                    onValueChange={(v) => handleChange(csvValue, v)}
                  >
                    <SelectTrigger className="w-[160px] h-8 text-xs">
                      <SelectValue placeholder="Select..." />
                    </SelectTrigger>
                    <SelectContent className="bg-popover border shadow-lg z-50">
                      <SelectItem value="__unmapped__">
                        <span className="text-muted-foreground">— Skip —</span>
                      </SelectItem>
                      {enumOptions.map((opt) => (
                        <SelectItem key={opt} value={opt}>
                          {opt}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {mapped && (
                    <span className="text-xs text-green-600">✓</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </td>
    </tr>
  );
}
