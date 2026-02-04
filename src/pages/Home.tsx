import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Upload, ArrowRightLeft, FileSpreadsheet, CheckCircle2 } from 'lucide-react';

export default function Home() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-6">
          <h1 className="text-2xl font-bold text-foreground">Superbia Payment Tools</h1>
          <p className="text-muted-foreground mt-1">
            Manage payment imports and income reconciliation
          </p>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-12">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-xl font-semibold mb-6">Select a Tool</h2>
          
          <div className="grid md:grid-cols-2 gap-6">
            {/* Payment Loading Card */}
            <Card className="group hover:shadow-lg transition-all hover:border-primary/50 cursor-pointer">
              <CardHeader>
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                  <Upload className="h-6 w-6 text-primary" />
                </div>
                <CardTitle className="flex items-center gap-2">
                  Payment Loading
                  <FileSpreadsheet className="h-4 w-4 text-muted-foreground" />
                </CardTitle>
                <CardDescription>
                  Import bank payment data from CSV files into Zoho CRM
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-muted-foreground mb-6">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                    Upload CSV files with drag & drop
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                    Map columns to Zoho fields
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                    Validate data before import
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                    Import payments and line items
                  </li>
                </ul>
                <Button 
                  className="w-full" 
                  onClick={() => navigate('/import/csv-mapper')}
                >
                  Start Import
                </Button>
              </CardContent>
            </Card>

            {/* Income Reconciliation Card */}
            <Card className="group hover:shadow-lg transition-all hover:border-primary/50 cursor-pointer">
              <CardHeader>
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                  <ArrowRightLeft className="h-6 w-6 text-primary" />
                </div>
                <CardTitle className="flex items-center gap-2">
                  Income Reconciliation
                </CardTitle>
                <CardDescription>
                  Match payments against expected fees and reconcile income
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-muted-foreground mb-6">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                    Load payments from Zoho CRM
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                    Match line items to expectations
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                    Review and confirm matches
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                    Sync reconciliation to CRM
                  </li>
                </ul>
                <Button 
                  className="w-full" 
                  onClick={() => navigate('/reconciliation')}
                >
                  Start Reconciliation
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t mt-auto">
        <div className="container mx-auto px-4 py-4">
          <p className="text-sm text-muted-foreground text-center">
            Superbia Payment Tools • Integrated with Zoho CRM
          </p>
        </div>
      </footer>
    </div>
  );
}
