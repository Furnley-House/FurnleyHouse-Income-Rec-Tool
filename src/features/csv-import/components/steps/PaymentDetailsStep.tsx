import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { ArrowRight, Building2, Calendar as CalendarIcon, Check, ChevronsUpDown, FileText } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { PaymentHeaderInputs } from '../../types';

interface PaymentDetailsStepProps {
  onComplete: (inputs: PaymentHeaderInputs) => void;
  initialValues?: PaymentHeaderInputs | null;
}

// Common financial providers - can be extended or fetched from Zoho
const PROVIDERS = [
  { id: 'fundment', name: 'Fundment' },
  { id: 'aviva', name: 'Aviva' },
  { id: 'aviva_pensions', name: 'Aviva Pensions' },
  { id: 'standard_life', name: 'Standard Life' },
  { id: 'scottish_widows', name: 'Scottish Widows' },
  { id: 'legal_general', name: 'Legal & General' },
  { id: 'royal_london', name: 'Royal London' },
  { id: 'aegon', name: 'Aegon' },
  { id: 'quilter', name: 'Quilter' },
  { id: 'fidelity', name: 'Fidelity' },
  { id: 'transact', name: 'Transact' },
  { id: 'abrdn', name: 'abrdn' },
  { id: 'nucleus', name: 'Nucleus' },
  { id: 'parmenion', name: 'Parmenion' },
  { id: 'james_hay', name: 'James Hay' },
  { id: 'aj_bell', name: 'AJ Bell' },
  { id: 'other', name: 'Other' },
];

export function PaymentDetailsStep({ onComplete, initialValues }: PaymentDetailsStepProps) {
  const [providerOpen, setProviderOpen] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<string>(initialValues?.providerName || '');
  const [customProvider, setCustomProvider] = useState('');
  const [paymentDate, setPaymentDate] = useState<Date | undefined>(
    initialValues?.paymentDate ? new Date(initialValues.paymentDate) : undefined
  );
  const [paymentReference, setPaymentReference] = useState(initialValues?.paymentReference || '');
  const [paymentAmount, setPaymentAmount] = useState(initialValues?.paymentAmount?.toString() || '');
  const [notes, setNotes] = useState(initialValues?.notes || '');

  const isOtherProvider = selectedProvider === 'Other';
  const effectiveProvider = isOtherProvider ? customProvider : selectedProvider;
  
  const canProceed = effectiveProvider && paymentDate && paymentReference;

  const handleProceed = () => {
    if (!canProceed) return;
    
    onComplete({
      providerName: effectiveProvider,
      providerId: isOtherProvider ? undefined : PROVIDERS.find(p => p.name === selectedProvider)?.id,
      paymentDate: format(paymentDate!, 'yyyy-MM-dd'),
      paymentReference,
      paymentAmount: paymentAmount ? parseFloat(paymentAmount.replace(/,/g, '')) : undefined,
      notes: notes || undefined,
    });
  };

  return (
    <div className="max-w-2xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Payment Details
          </CardTitle>
          <CardDescription>
            Enter the payment header information. This will create the Bank Payment record in Zoho that line items will be attached to.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Provider Selection */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              Financial Provider *
            </Label>
            <Popover open={providerOpen} onOpenChange={setProviderOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={providerOpen}
                  className="w-full justify-between"
                >
                  {selectedProvider || "Select provider..."}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-full p-0 bg-popover border shadow-lg z-50" align="start">
                <Command>
                  <CommandInput placeholder="Search providers..." />
                  <CommandList>
                    <CommandEmpty>No provider found.</CommandEmpty>
                    <CommandGroup>
                      {PROVIDERS.map((provider) => (
                        <CommandItem
                          key={provider.id}
                          value={provider.name}
                          onSelect={(value) => {
                            setSelectedProvider(value);
                            setProviderOpen(false);
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              selectedProvider === provider.name ? "opacity-100" : "opacity-0"
                            )}
                          />
                          {provider.name}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            
            {isOtherProvider && (
              <Input
                placeholder="Enter provider name"
                value={customProvider}
                onChange={(e) => setCustomProvider(e.target.value)}
                className="mt-2"
              />
            )}
          </div>

          {/* Payment Date */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <CalendarIcon className="h-4 w-4" />
              Payment Date *
            </Label>
            <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !paymentDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {paymentDate ? format(paymentDate, "PPP") : "Select date..."}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 bg-popover border shadow-lg z-50" align="start">
                <Calendar
                  mode="single"
                  selected={paymentDate}
                  onSelect={(date) => {
                    setPaymentDate(date);
                    setCalendarOpen(false);
                  }}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Payment Reference */}
          <div className="space-y-2">
            <Label>Payment Reference *</Label>
            <Input
              placeholder="e.g., FEESPAID 20260126 or INV-12345"
              value={paymentReference}
              onChange={(e) => setPaymentReference(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              The unique reference from the bank statement or provider remittance
            </p>
          </div>

          {/* Payment Amount (Optional) */}
          <div className="space-y-2">
            <Label>Total Payment Amount (Optional)</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">£</span>
              <Input
                type="text"
                placeholder="0.00"
                value={paymentAmount}
                onChange={(e) => {
                  // Allow only numbers and decimal point
                  const value = e.target.value.replace(/[^0-9.,]/g, '');
                  setPaymentAmount(value);
                }}
                className="pl-7"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              If known, enter the total payment amount for validation against line items
            </p>
          </div>

          {/* Notes (Optional) */}
          <div className="space-y-2">
            <Label>Notes (Optional)</Label>
            <Input
              placeholder="Any additional notes about this payment"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          <div className="pt-4">
            <Button 
              onClick={handleProceed} 
              disabled={!canProceed} 
              className="w-full"
              size="lg"
            >
              Continue to File Upload
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
