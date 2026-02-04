import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, ArrowRight, Database, Table2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { CSVUpload } from './CSVUpload';
import { CSVParseResult } from '../types';

type ImportStep = 'upload' | 'preview' | 'mapping' | 'confirm';

export function CSVMapperPage() {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState<ImportStep>('upload');
  const [csvData, setCsvData] = useState<CSVParseResult | null>(null);

  const handleFileLoaded = (result: CSVParseResult) => {
    setCsvData(result);
    setCurrentStep('preview');
  };

  const handleBack = () => {
    if (currentStep === 'upload') {
      navigate('/');
    } else if (currentStep === 'preview') {
      setCurrentStep('upload');
      setCsvData(null);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={handleBack}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <h1 className="text-xl font-semibold">CSV Import Wizard</h1>
                <p className="text-sm text-muted-foreground">
                  Import bank payment data from CSV files
                </p>
              </div>
            </div>
            
            {/* Step Indicator */}
            <div className="flex items-center gap-2">
              {(['upload', 'preview', 'mapping', 'confirm'] as ImportStep[]).map((step, index) => (
                <div key={step} className="flex items-center">
                  <div 
                    className={`
                      w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium
                      ${currentStep === step 
                        ? 'bg-primary text-primary-foreground' 
                        : index < ['upload', 'preview', 'mapping', 'confirm'].indexOf(currentStep)
                          ? 'bg-primary/20 text-primary'
                          : 'bg-muted text-muted-foreground'
                      }
                    `}
                  >
                    {index + 1}
                  </div>
                  {index < 3 && (
                    <div className={`w-8 h-0.5 ${
                      index < ['upload', 'preview', 'mapping', 'confirm'].indexOf(currentStep)
                        ? 'bg-primary/20'
                        : 'bg-muted'
                    }`} />
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {currentStep === 'upload' && (
          <div className="max-w-2xl mx-auto">
            <CSVUpload onFileLoaded={handleFileLoaded} />
            
            <div className="mt-6 grid grid-cols-2 gap-4">
              <Card className="p-4 bg-muted/50">
                <div className="flex items-start gap-3">
                  <Database className="h-5 w-5 text-primary mt-0.5" />
                  <div>
                    <h3 className="font-medium text-sm">Bank Payments</h3>
                    <p className="text-xs text-muted-foreground mt-1">
                      Import payment headers with provider, amount, and date information
                    </p>
                  </div>
                </div>
              </Card>
              <Card className="p-4 bg-muted/50">
                <div className="flex items-start gap-3">
                  <Table2 className="h-5 w-5 text-primary mt-0.5" />
                  <div>
                    <h3 className="font-medium text-sm">Line Items</h3>
                    <p className="text-xs text-muted-foreground mt-1">
                      Import detailed line items with client and policy references
                    </p>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        )}

        {currentStep === 'preview' && csvData && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Data Preview</span>
                  <span className="text-sm font-normal text-muted-foreground">
                    {csvData.totalRows} rows • {csvData.headers.length} columns
                  </span>
                </CardTitle>
                <CardDescription>
                  Review the first few rows of your imported data
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        {csvData.headers.map((header, i) => (
                          <th key={i} className="px-3 py-2 text-left font-medium text-muted-foreground">
                            {header}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {csvData.rows.slice(0, 5).map((row, rowIndex) => (
                        <tr key={rowIndex} className="border-b">
                          {csvData.headers.map((header, colIndex) => (
                            <td key={colIndex} className="px-3 py-2 text-foreground">
                              {row[header] || '-'}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                
                {csvData.totalRows > 5 && (
                  <p className="text-sm text-muted-foreground mt-4 text-center">
                    Showing 5 of {csvData.totalRows} rows
                  </p>
                )}
              </CardContent>
            </Card>

            <div className="flex justify-between">
              <Button variant="outline" onClick={handleBack}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
              <Button onClick={() => setCurrentStep('mapping')}>
                Continue to Mapping
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </div>
        )}

        {currentStep === 'mapping' && (
          <Card className="max-w-4xl mx-auto">
            <CardHeader>
              <CardTitle>Field Mapping</CardTitle>
              <CardDescription>
                Map your CSV columns to the required Zoho fields
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-center py-12">
                Field mapping interface coming soon...
              </p>
              <div className="flex justify-between mt-6">
                <Button variant="outline" onClick={() => setCurrentStep('preview')}>
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back
                </Button>
                <Button disabled>
                  Continue
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
