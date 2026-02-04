import { useState } from 'react';
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
  Sparkles
} from 'lucide-react';
import { FieldMapping, AIMappingResult, INTERNAL_FIELDS, FileUploadInputs } from '../../types';

interface MappingReviewStepProps {
  fileInputs: FileUploadInputs;
  aiResult: AIMappingResult;
  onBack: () => void;
  onComplete: (mappings: FieldMapping[], rowOffset: number) => void;
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

export function MappingReviewStep({ fileInputs, aiResult, onBack, onComplete }: MappingReviewStepProps) {
  const [mappings, setMappings] = useState<FieldMapping[]>(aiResult.mappings);
  const [rowOffset, setRowOffset] = useState(aiResult.suggestedRowOffset);

  const updateMapping = (csvColumn: string, targetField: string) => {
    setMappings(prev => prev.map(m => 
      m.csvColumn === csvColumn 
        ? { ...m, targetField, ignored: targetField === '', confidence: 'high' as const }
        : m
    ));
  };

  const toggleIgnore = (csvColumn: string) => {
    setMappings(prev => prev.map(m => 
      m.csvColumn === csvColumn 
        ? { ...m, ignored: !m.ignored, targetField: !m.ignored ? '' : m.targetField }
        : m
    ));
  };

  const handleProceed = () => {
    onComplete(mappings, rowOffset);
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
              {aiResult.analysisNotes && (
                <p className="text-sm text-muted-foreground">{aiResult.analysisNotes}</p>
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
                <SelectContent>
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
          <CardTitle>Field Mappings</CardTitle>
          <CardDescription>
            Review and adjust the AI-suggested mappings. Click on any mapping to change it.
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
                          <SelectContent>
                            <SelectItem value="_ignore">
                              <span className="text-muted-foreground">— Skip this column —</span>
                            </SelectItem>
                            {INTERNAL_FIELDS.map((field) => (
                              <SelectItem key={field.value} value={field.value}>
                                {field.label}
                                {field.required && <span className="text-destructive ml-1">*</span>}
                              </SelectItem>
                            ))}
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
