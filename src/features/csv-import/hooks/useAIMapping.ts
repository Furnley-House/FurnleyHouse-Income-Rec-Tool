import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { CSVColumn, AIMappingResult } from '../types';
import { toast } from 'sonner';

interface UseAIMappingOptions {
  onSuccess?: (result: AIMappingResult) => void;
  onError?: (error: string) => void;
}

export function useAIMapping(options?: UseAIMappingOptions) {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AIMappingResult | null>(null);

  const analyzeCSV = async (
    columns: CSVColumn[],
    paymentDateColumn: string,
    paymentReferenceColumn: string,
    providerName: string
  ) => {
    setIsAnalyzing(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('csv-mapping-ai', {
        body: {
          columns,
          paymentDateColumn,
          paymentReferenceColumn,
          providerName,
        },
      });

      if (fnError) {
        throw new Error(fnError.message || 'Failed to analyze CSV');
      }

      if (data.error) {
        throw new Error(data.error);
      }

      setResult(data as AIMappingResult);
      options?.onSuccess?.(data as AIMappingResult);
      return data as AIMappingResult;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to analyze CSV';
      setError(message);
      options?.onError?.(message);
      toast.error(message);
      return null;
    } finally {
      setIsAnalyzing(false);
    }
  };

  return {
    analyzeCSV,
    isAnalyzing,
    error,
    result,
    reset: () => {
      setResult(null);
      setError(null);
    },
  };
}
