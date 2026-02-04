import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { FileUploadStep } from './steps/FileUploadStep';
import { MappingAnalysisStep } from './steps/MappingAnalysisStep';
import { MappingReviewStep } from './steps/MappingReviewStep';
import { ValidationStep } from './steps/ValidationStep';
import { WizardState, FileUploadInputs, AIMappingResult, FieldMapping } from '../types';

type WizardStep = 'upload' | 'analyzing' | 'review' | 'validation';

const STEP_LABELS: Record<WizardStep, string> = {
  upload: 'Upload',
  analyzing: 'Analyzing',
  review: 'Review',
  validation: 'Confirm',
};

const STEP_ORDER: WizardStep[] = ['upload', 'analyzing', 'review', 'validation'];

export function CSVMapperPage() {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState<WizardStep>('upload');
  const [wizardState, setWizardState] = useState<WizardState>({
    step: 'upload',
    fileInputs: null,
    aiResult: null,
    finalMappings: [],
    rowOffset: 0,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleBack = () => {
    if (currentStep === 'upload') {
      navigate('/');
    } else if (currentStep === 'analyzing') {
      setCurrentStep('upload');
    } else if (currentStep === 'review') {
      setCurrentStep('upload');
    } else if (currentStep === 'validation') {
      setCurrentStep('review');
    }
  };

  const handleFileUploadComplete = (inputs: FileUploadInputs) => {
    setWizardState(prev => ({ ...prev, fileInputs: inputs }));
    setCurrentStep('analyzing');
  };

  const handleAnalysisComplete = (result: AIMappingResult) => {
    setWizardState(prev => ({ 
      ...prev, 
      aiResult: result,
      finalMappings: result.mappings,
      rowOffset: result.suggestedRowOffset,
    }));
    setCurrentStep('review');
  };

  const handleAnalysisError = () => {
    // Go back to upload on error
    setCurrentStep('upload');
  };

  const handleReviewComplete = (mappings: FieldMapping[], rowOffset: number) => {
    setWizardState(prev => ({ 
      ...prev, 
      finalMappings: mappings,
      rowOffset,
    }));
    setCurrentStep('validation');
  };

  const handleConfirmImport = async () => {
    setIsSubmitting(true);
    try {
      // TODO: Implement actual import to Zoho
      // For now, simulate a delay and show success
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      toast.success('Import completed successfully!', {
        description: `Imported ${wizardState.fileInputs?.csvData.totalRows} rows from ${wizardState.fileInputs?.providerName}`,
      });
      
      // Navigate back to home or to reconciliation
      navigate('/');
    } catch (error) {
      toast.error('Import failed', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const currentStepIndex = STEP_ORDER.indexOf(currentStep);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={handleBack}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <h1 className="text-xl font-semibold">CSV Import Wizard</h1>
                <p className="text-sm text-muted-foreground">
                  AI-powered bank statement mapping
                </p>
              </div>
            </div>
            
            {/* Step Indicator */}
            <div className="hidden md:flex items-center gap-1">
              {STEP_ORDER.map((step, index) => (
                <div key={step} className="flex items-center">
                  <div className="flex items-center gap-2">
                    <div 
                      className={`
                        w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors
                        ${currentStep === step 
                          ? 'bg-primary text-primary-foreground' 
                          : index < currentStepIndex
                            ? 'bg-primary/20 text-primary'
                            : 'bg-muted text-muted-foreground'
                        }
                      `}
                    >
                      {index + 1}
                    </div>
                    <span className={`text-sm hidden lg:block ${
                      currentStep === step ? 'text-foreground font-medium' : 'text-muted-foreground'
                    }`}>
                      {STEP_LABELS[step]}
                    </span>
                  </div>
                  {index < STEP_ORDER.length - 1 && (
                    <div className={`w-8 lg:w-12 h-0.5 mx-2 ${
                      index < currentStepIndex
                        ? 'bg-primary/40'
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
          <FileUploadStep onComplete={handleFileUploadComplete} />
        )}

        {currentStep === 'analyzing' && wizardState.fileInputs && (
          <MappingAnalysisStep 
            fileInputs={wizardState.fileInputs}
            onComplete={handleAnalysisComplete}
            onError={handleAnalysisError}
          />
        )}

        {currentStep === 'review' && wizardState.fileInputs && wizardState.aiResult && (
          <MappingReviewStep
            fileInputs={wizardState.fileInputs}
            aiResult={wizardState.aiResult}
            onBack={handleBack}
            onComplete={handleReviewComplete}
          />
        )}

        {currentStep === 'validation' && wizardState.fileInputs && (
          <ValidationStep
            fileInputs={wizardState.fileInputs}
            mappings={wizardState.finalMappings}
            rowOffset={wizardState.rowOffset}
            onBack={handleBack}
            onConfirm={handleConfirmImport}
            isSubmitting={isSubmitting}
          />
        )}
      </main>
    </div>
  );
}
