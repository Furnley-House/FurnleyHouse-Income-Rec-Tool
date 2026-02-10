import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { PaymentDetailsStep } from './steps/PaymentDetailsStep';
import { FileUploadStep } from './steps/FileUploadStep';
import { MappingAnalysisStep } from './steps/MappingAnalysisStep';
import { MappingReviewStep } from './steps/MappingReviewStep';
import { ValidationStep } from './steps/ValidationStep';
import { WizardState, PaymentHeaderInputs, FileUploadInputs, AIMappingResult, FieldMapping, DefaultFieldValue } from '../types';

type WizardStep = 'payment' | 'upload' | 'analyzing' | 'review' | 'validation';

const STEP_LABELS: Record<WizardStep, string> = {
  payment: 'Payment',
  upload: 'Upload',
  analyzing: 'Analyzing',
  review: 'Review',
  validation: 'Confirm',
};

const STEP_ORDER: WizardStep[] = ['payment', 'upload', 'analyzing', 'review', 'validation'];

export function CSVMapperPage() {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState<WizardStep>('payment');
  const [wizardState, setWizardState] = useState<WizardState>({
    step: 'payment',
    paymentHeader: null,
    fileInputs: null,
    aiResult: null,
    finalMappings: [],
    defaultValues: [],
    rowOffset: 0,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleBack = () => {
    if (currentStep === 'payment') {
      navigate('/');
    } else if (currentStep === 'upload') {
      setCurrentStep('payment');
    } else if (currentStep === 'analyzing') {
      setCurrentStep('upload');
    } else if (currentStep === 'review') {
      setCurrentStep('upload');
    } else if (currentStep === 'validation') {
      setCurrentStep('review');
    }
  };

  const handlePaymentDetailsComplete = (inputs: PaymentHeaderInputs) => {
    setWizardState(prev => ({ ...prev, paymentHeader: inputs }));
    setCurrentStep('upload');
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

  const handleReviewComplete = (mappings: FieldMapping[], rowOffset: number, defaults: DefaultFieldValue[]) => {
    setWizardState(prev => ({ 
      ...prev, 
      finalMappings: mappings,
      defaultValues: defaults,
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
        description: `Imported ${wizardState.fileInputs?.csvData.totalRows} line items for ${wizardState.paymentHeader?.providerName}`,
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
        {currentStep === 'payment' && (
          <PaymentDetailsStep 
            onComplete={handlePaymentDetailsComplete}
            initialValues={wizardState.paymentHeader}
          />
        )}

        {currentStep === 'upload' && wizardState.paymentHeader && (
          <FileUploadStep 
            paymentHeader={wizardState.paymentHeader}
            onComplete={handleFileUploadComplete}
            onBack={handleBack}
          />
        )}

        {currentStep === 'analyzing' && wizardState.paymentHeader && wizardState.fileInputs && (
          <MappingAnalysisStep 
            fileInputs={wizardState.fileInputs}
            paymentHeader={wizardState.paymentHeader}
            onComplete={handleAnalysisComplete}
            onError={handleAnalysisError}
          />
        )}

        {currentStep === 'review' && wizardState.paymentHeader && wizardState.fileInputs && wizardState.aiResult && (
          <MappingReviewStep
            fileInputs={wizardState.fileInputs}
            paymentHeader={wizardState.paymentHeader}
            aiResult={wizardState.aiResult}
            onBack={handleBack}
            onComplete={handleReviewComplete}
          />
        )}

        {currentStep === 'validation' && wizardState.paymentHeader && wizardState.fileInputs && (
          <ValidationStep
            fileInputs={wizardState.fileInputs}
            paymentHeader={wizardState.paymentHeader}
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
