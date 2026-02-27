import { useState, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Upload, FileText, CheckCircle, AlertCircle, X, FileSpreadsheet } from 'lucide-react';
import { CSVParseResult, CSVColumn, CSVValidationResult } from '../types';
import { toast } from 'sonner';

interface CSVUploadProps {
  onFileLoaded: (result: CSVParseResult) => void;
  maxFileSizeMB?: number;
  acceptedExtensions?: string[];
}

export function CSVUpload({ 
  onFileLoaded, 
  maxFileSizeMB = 10,
  acceptedExtensions = ['.csv']
}: CSVUploadProps) {
  const [file, setFile] = useState<File | null>(null);
  const [parsing, setParsing] = useState(false);
  const [validation, setValidation] = useState<CSVValidationResult | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const parseCSVLine = (line: string): string[] => {
    const values: string[] = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        values.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current.trim());
    
    return values;
  };

  const parseCSV = (text: string, fileName: string): CSVParseResult => {
    const lines = text.trim().split(/\r?\n/);
    if (lines.length < 1) {
      throw new Error('CSV file is empty');
    }
    
    const headers = parseCSVLine(lines[0]).map(h => h.replace(/^"|"$/g, '').replace(/\s+/g, ' ').trim());
    const rows: Record<string, string>[] = [];
    
    for (let i = 1; i < lines.length; i++) {
      const values = parseCSVLine(lines[i]);
      if (values.length === headers.length) {
        const row: Record<string, string> = {};
        headers.forEach((header, index) => {
          row[header] = values[index];
        });
        rows.push(row);
      }
    }
    
    // Build column metadata with sample values
    const columns: CSVColumn[] = headers.map((header, index) => ({
      index,
      header,
      sampleValues: rows.slice(0, 5).map(row => row[header] || '').filter(v => v !== '')
    }));
    
    return {
      headers,
      rows,
      columns,
      totalRows: rows.length,
      fileName
    };
  };

  const validateFile = (file: File): CSVValidationResult => {
    const errors: { row: number; column: string; message: string }[] = [];
    const warnings: string[] = [];

    // Check file extension
    const extension = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!acceptedExtensions.includes(extension)) {
      errors.push({
        row: 0,
        column: 'file',
        message: `Invalid file type. Accepted: ${acceptedExtensions.join(', ')}`
      });
    }

    // Check file size
    const sizeMB = file.size / (1024 * 1024);
    if (sizeMB > maxFileSizeMB) {
      errors.push({
        row: 0,
        column: 'file',
        message: `File too large (${sizeMB.toFixed(2)}MB). Maximum: ${maxFileSizeMB}MB`
      });
    }

    if (sizeMB > maxFileSizeMB * 0.8) {
      warnings.push(`File is ${sizeMB.toFixed(2)}MB, approaching the ${maxFileSizeMB}MB limit`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  };

  const handleFile = useCallback(async (selectedFile: File) => {
    const validationResult = validateFile(selectedFile);
    setValidation(validationResult);

    if (!validationResult.isValid) {
      toast.error(validationResult.errors[0]?.message || 'Invalid file');
      return;
    }

    setFile(selectedFile);
    setParsing(true);

    try {
      const text = await selectedFile.text();
      const result = parseCSV(text, selectedFile.name);
      
      if (result.totalRows === 0) {
        toast.error('CSV file contains no data rows');
        setFile(null);
        return;
      }

      toast.success(`Loaded ${result.totalRows} rows from ${result.headers.length} columns`);
      onFileLoaded(result);
    } catch (error) {
      toast.error('Failed to parse CSV: ' + (error instanceof Error ? error.message : 'Unknown error'));
      setFile(null);
    } finally {
      setParsing(false);
    }
  }, [onFileLoaded, maxFileSizeMB, acceptedExtensions]);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  }, [handleFile]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  }, [handleFile]);

  const clearFile = () => {
    setFile(null);
    setValidation(null);
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileSpreadsheet className="h-5 w-5" />
          Upload CSV File
        </CardTitle>
        <CardDescription>
          Upload a CSV file to import bank payment data. Maximum file size: {maxFileSizeMB}MB
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div
          className={`
            relative border-2 border-dashed rounded-lg p-8 text-center transition-all
            ${dragActive ? 'border-primary bg-primary/5 scale-[1.02]' : 'border-muted-foreground/25'}
            ${file ? 'border-primary bg-primary/5' : 'hover:border-primary/50 hover:bg-muted/50'}
          `}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
          {file ? (
            <div className="space-y-4">
              <div className="flex items-center justify-center gap-3">
                <div className="p-3 bg-primary/10 rounded-full">
                  <FileText className="h-8 w-8 text-primary" />
                </div>
                <div className="text-left">
                  <p className="font-medium text-foreground">{file.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {(file.size / 1024).toFixed(1)} KB
                  </p>
                </div>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={clearFile}
                  className="ml-auto"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              
              {parsing && (
                <div className="flex items-center justify-center gap-2 text-muted-foreground">
                  <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full" />
                  <span>Parsing file...</span>
                </div>
              )}
              
              {validation && !parsing && (
                <div className={`flex items-center justify-center gap-2 ${validation.isValid ? 'text-green-600' : 'text-destructive'}`}>
                  {validation.isValid ? (
                    <>
                      <CheckCircle className="h-4 w-4" />
                      <span>File validated successfully</span>
                    </>
                  ) : (
                    <>
                      <AlertCircle className="h-4 w-4" />
                      <span>{validation.errors[0]?.message}</span>
                    </>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div 
              className="cursor-pointer py-6"
              onClick={() => inputRef.current?.click()}
            >
              <div className="mx-auto w-16 h-16 mb-4 rounded-full bg-muted flex items-center justify-center">
                <Upload className="h-8 w-8 text-muted-foreground" />
              </div>
              <p className="text-lg font-medium text-foreground mb-1">
                {dragActive ? 'Drop your file here' : 'Drag & drop your CSV file'}
              </p>
              <p className="text-sm text-muted-foreground mb-4">
                or click to browse
              </p>
              <Button variant="outline" size="sm" type="button">
                Select File
              </Button>
            </div>
          )}
          
          <input
            ref={inputRef}
            type="file"
            accept={acceptedExtensions.join(',')}
            className="hidden"
            onChange={handleChange}
          />
        </div>

        {validation?.warnings && validation.warnings.length > 0 && (
          <div className="mt-4 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
            <p className="text-sm text-yellow-600 dark:text-yellow-500">
              {validation.warnings.join('. ')}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
