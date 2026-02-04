import { useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Brain, Loader2, Sparkles } from 'lucide-react';
import { FileUploadInputs, AIMappingResult } from '../../types';
import { useAIMapping } from '../../hooks/useAIMapping';

interface MappingAnalysisStepProps {
  fileInputs: FileUploadInputs;
  onComplete: (result: AIMappingResult) => void;
  onError: () => void;
}

export function MappingAnalysisStep({ fileInputs, onComplete, onError }: MappingAnalysisStepProps) {
  const { analyzeCSV, isAnalyzing, error } = useAIMapping({
    onSuccess: onComplete,
    onError: () => onError(),
  });

  useEffect(() => {
    // Start analysis when component mounts
    analyzeCSV(
      fileInputs.csvData.columns,
      fileInputs.paymentDateColumn,
      fileInputs.paymentReferenceColumn,
      fileInputs.providerName
    );
  }, []); // Run once on mount

  return (
    <div className="max-w-2xl mx-auto">
      <Card>
        <CardHeader className="text-center pb-2">
          <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
            {error ? (
              <Brain className="h-8 w-8 text-destructive" />
            ) : (
              <Brain className="h-8 w-8 text-primary animate-pulse" />
            )}
          </div>
          <CardTitle className="flex items-center justify-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            AI Column Mapping
          </CardTitle>
          <CardDescription>
            {error 
              ? 'Analysis failed. Please try again.'
              : 'Analyzing your CSV structure and suggesting field mappings...'
            }
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          {error ? (
            <div className="text-center">
              <p className="text-destructive mb-4">{error}</p>
              <p className="text-sm text-muted-foreground">
                You can go back and try uploading again, or contact support if the issue persists.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-center gap-3 py-8">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                <span className="text-muted-foreground">Processing {fileInputs.csvData.headers.length} columns...</span>
              </div>
              
              <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">File</span>
                  <span className="font-medium">{fileInputs.csvData.fileName}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Provider</span>
                  <span className="font-medium">{fileInputs.providerName}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Rows</span>
                  <span className="font-medium">{fileInputs.csvData.totalRows}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Columns</span>
                  <span className="font-medium">{fileInputs.csvData.headers.length}</span>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
