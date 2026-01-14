import { useState } from 'react';
import { useReconciliationStore } from '@/store/reconciliationStore';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { 
  Search, 
  CheckCircle2,
  Circle,
  FileText,
  MousePointerClick,
  Link2,
  X,
  AlertCircle,
  Eye,
  EyeOff
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { cn } from '@/lib/utils';

export function StatementItemList() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLineItemId, setSelectedLineItemId] = useState<string | null>(null);
  const [approveUnmatchedDialogOpen, setApproveUnmatchedDialogOpen] = useState(false);
  const [approveUnmatchedNotes, setApproveUnmatchedNotes] = useState('');
  const [lineItemToApprove, setLineItemToApprove] = useState<string | null>(null);
  const [showMatched, setShowMatched] = useState(false);
  
  const { 
    getSelectedPayment, 
    getPendingMatchForLineItem,
    removePendingMatch,
    markLineItemApprovedUnmatched
  } = useReconciliationStore();
  
  const payment = getSelectedPayment();
  
  if (!payment) return null;
  
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  };
  
  // Get all items for counts
  const allItems = payment.lineItems.filter(item => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return item.clientName.toLowerCase().includes(term) ||
           item.planReference.toLowerCase().includes(term);
  });
  
  const matchedCount = allItems.filter(item => item.status === 'matched').length;
  const pendingCount = allItems.filter(item => getPendingMatchForLineItem(item.id)).length;
  const unmatchedCount = allItems.filter(item => item.status === 'unmatched' && !getPendingMatchForLineItem(item.id)).length;
  const approvedUnmatchedCount = allItems.filter(item => item.status === 'approved_unmatched').length;
  
  // Filter out matched/approved items unless showMatched is true
  const filteredItems = allItems.filter(item => {
    if (showMatched) return true;
    return item.status !== 'matched' && item.status !== 'approved_unmatched';
  });
  
  const handleLineItemClick = (itemId: string) => {
    const item = payment.lineItems.find(li => li.id === itemId);
    if (!item || item.status !== 'unmatched') return;
    
    const pendingMatch = getPendingMatchForLineItem(itemId);
    if (pendingMatch) return; // Already pending
    
    if (selectedLineItemId === itemId) {
      setSelectedLineItemId(null);
    } else {
      setSelectedLineItemId(itemId);
    }
  };
  
  const handleRemovePending = (e: React.MouseEvent, lineItemId: string) => {
    e.stopPropagation();
    removePendingMatch(lineItemId);
  };
  
  const handleApproveUnmatched = (e: React.MouseEvent, lineItemId: string) => {
    e.stopPropagation();
    setLineItemToApprove(lineItemId);
    setApproveUnmatchedNotes('');
    setApproveUnmatchedDialogOpen(true);
  };
  
  const handleConfirmApproveUnmatched = () => {
    if (lineItemToApprove && approveUnmatchedNotes.trim()) {
      markLineItemApprovedUnmatched(lineItemToApprove, approveUnmatchedNotes);
      setApproveUnmatchedDialogOpen(false);
      setLineItemToApprove(null);
      setApproveUnmatchedNotes('');
    }
  };
  
  // Expose selected line item ID for ExpectationGrid
  const selectedLineItem = selectedLineItemId 
    ? payment.lineItems.find(li => li.id === selectedLineItemId) 
    : null;
  
  return (
    <>
      <div className="h-full flex flex-col border-r border-border bg-card">
        {/* Compact Header */}
        <div className="px-3 py-2 border-b border-border bg-primary/5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" />
              <span className="font-semibold text-foreground text-sm">Statement Items</span>
              {unmatchedCount > 0 && (
                <Badge variant="outline" className="bg-muted text-xs h-5">
                  {unmatchedCount} unmatched
                </Badge>
              )}
              {pendingCount > 0 && (
                <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30 text-xs h-5">
                  {pendingCount} pending
                </Badge>
              )}
              {matchedCount > 0 && (
                <Badge variant="outline" className="bg-success/10 text-success border-success/30 text-xs h-5">
                  {matchedCount} matched
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-1">
              {matchedCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-xs gap-1"
                  onClick={() => setShowMatched(!showMatched)}
                >
                  {showMatched ? (
                    <>
                      <EyeOff className="h-3 w-3" />
                      Hide matched
                    </>
                  ) : (
                    <>
                      <Eye className="h-3 w-3" />
                      Show matched
                    </>
                  )}
                </Button>
              )}
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                <Input
                  placeholder="Search..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-7 h-6 text-xs w-32"
                />
              </div>
            </div>
          </div>
        </div>
        
        {/* Hint for manual matching */}
        {unmatchedCount > 0 && !selectedLineItemId && (
          <div className="px-3 py-1.5 bg-muted/50 border-b border-border flex items-center gap-2 text-xs text-muted-foreground">
            <MousePointerClick className="h-3 w-3" />
            <span>Click an unmatched item to select for matching</span>
          </div>
        )}
        
        {/* Selected Line Item Info */}
        {selectedLineItem && (
          <div className="px-3 py-2 bg-primary/10 border-b border-primary/20">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                <span className="text-xs font-medium text-primary">
                  Selected: {selectedLineItem.clientName} • {formatCurrency(selectedLineItem.amount)}
                </span>
              </div>
              <button 
                onClick={() => setSelectedLineItemId(null)}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
        
        {/* Compact List */}
        <ScrollArea className="flex-1 scrollbar-thin">
          <div className="divide-y divide-border/50">
            {filteredItems.map((item) => {
              const pendingMatch = getPendingMatchForLineItem(item.id);
              const isPending = !!pendingMatch;
              const isMatched = item.status === 'matched';
              const isApprovedUnmatched = item.status === 'approved_unmatched';
              const isSelected = selectedLineItemId === item.id;
              const isUnmatched = item.status === 'unmatched' && !isPending;
              
              return (
                <div
                  key={item.id}
                  onClick={() => handleLineItemClick(item.id)}
                  className={cn(
                    "px-3 py-1.5 flex items-center gap-2 text-sm transition-colors",
                    isMatched && "bg-success/5 cursor-default",
                    isApprovedUnmatched && "bg-muted/30 cursor-default",
                    isPending && "bg-primary/5 cursor-default",
                    isUnmatched && "bg-background hover:bg-muted/50 cursor-pointer",
                    isSelected && "bg-primary/10 ring-1 ring-primary/30"
                  )}
                >
                  {/* Status Icon */}
                  {isMatched ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-success shrink-0" />
                  ) : isApprovedUnmatched ? (
                    <AlertCircle className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  ) : isPending ? (
                    <Link2 className="h-3.5 w-3.5 text-primary shrink-0" />
                  ) : (
                    <Circle className={cn(
                      "h-3.5 w-3.5 shrink-0 transition-colors",
                      isSelected ? "text-primary fill-primary/20" : "text-muted-foreground/40"
                    )} />
                  )}
                  
                  {/* Client Name */}
                  <span className="font-medium text-foreground truncate w-32" title={item.clientName}>
                    {item.clientName}
                  </span>
                  
                  {/* Plan Reference */}
                  <span className="text-xs text-muted-foreground truncate w-20" title={item.planReference}>
                    {item.planReference}
                  </span>
                  
                  {/* Agency Code */}
                  {item.agencyCode && (
                    <span className="text-xs text-muted-foreground/70 bg-muted/50 px-1.5 py-0.5 rounded shrink-0" title="Agency Code">
                      {item.agencyCode}
                    </span>
                  )}
                  
                  {/* Spacer */}
                  <div className="flex-1" />
                  
                  {/* Amount */}
                  <span className="font-semibold tabular-nums text-right w-20 shrink-0">
                    {formatCurrency(item.amount)}
                  </span>
                  
                  {/* Status/Actions */}
                  {isMatched ? (
                    <Badge variant="outline" className="text-xs h-4 bg-success/10 text-success border-success/30 shrink-0">
                      Matched
                    </Badge>
                  ) : isApprovedUnmatched ? (
                    <Badge variant="outline" className="text-xs h-4 bg-muted text-muted-foreground shrink-0">
                      Approved
                    </Badge>
                  ) : isPending ? (
                    <div className="flex items-center gap-1 shrink-0">
                      <Badge variant="outline" className="text-xs h-4 bg-primary/10 text-primary border-primary/30">
                        Pending
                      </Badge>
                      <button
                        onClick={(e) => handleRemovePending(e, item.id)}
                        className="p-0.5 hover:bg-muted rounded"
                      >
                        <X className="h-3 w-3 text-muted-foreground" />
                      </button>
                    </div>
                  ) : isSelected ? (
                    <Badge variant="outline" className="text-xs h-4 bg-primary/10 text-primary border-primary/30 shrink-0">
                      Selected
                    </Badge>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-5 text-xs px-2 text-muted-foreground hover:text-foreground"
                      onClick={(e) => handleApproveUnmatched(e, item.id)}
                    >
                      Skip
                    </Button>
                  )}
                </div>
              );
            })}
            
            {filteredItems.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <p className="text-sm">No items found</p>
              </div>
            )}
          </div>
        </ScrollArea>
        
        {/* Compact Footer */}
        <div className="px-3 py-1.5 border-t border-border bg-muted/30 flex items-center justify-between text-sm">
          <span className="text-muted-foreground text-xs">Total</span>
          <span className="font-bold tabular-nums">{formatCurrency(payment.amount)}</span>
        </div>
      </div>
      
      {/* Approve Unmatched Dialog */}
      <Dialog open={approveUnmatchedDialogOpen} onOpenChange={setApproveUnmatchedDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-warning" />
              Approve Without Matching
            </DialogTitle>
            <DialogDescription>
              This line item will be marked as "Approved Unmatched" and won't require an expectation match.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {lineItemToApprove && (
              <div className="bg-muted/50 rounded-lg p-3">
                {(() => {
                  const li = payment.lineItems.find(l => l.id === lineItemToApprove);
                  return li ? (
                    <>
                      <p className="font-medium text-sm">{li.clientName}</p>
                      <p className="text-xs text-muted-foreground">{li.planReference}</p>
                      <p className="text-lg font-bold tabular-nums mt-1">{formatCurrency(li.amount)}</p>
                    </>
                  ) : null;
                })()}
              </div>
            )}
            
            <div>
              <p className="text-sm text-muted-foreground mb-2">Approval Notes (required)</p>
              <Textarea
                placeholder="Please explain why this item doesn't need matching..."
                value={approveUnmatchedNotes}
                onChange={(e) => setApproveUnmatchedNotes(e.target.value)}
                className="resize-none"
                rows={3}
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="ghost" onClick={() => setApproveUnmatchedDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleConfirmApproveUnmatched}
              disabled={!approveUnmatchedNotes.trim()}
              className="gap-2"
            >
              <CheckCircle2 className="h-4 w-4" />
              Approve Unmatched
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Export selected line item for ExpectationGrid */}
      {selectedLineItemId && (
        <SelectedLineItemContext 
          lineItemId={selectedLineItemId} 
          onClearSelection={() => setSelectedLineItemId(null)} 
        />
      )}
    </>
  );
}

// Context component to share selected line item with ExpectationGrid
function SelectedLineItemContext({ 
  lineItemId, 
  onClearSelection 
}: { 
  lineItemId: string; 
  onClearSelection: () => void;
}) {
  // This is a workaround - we'll use a custom event to communicate
  // In a real app, you'd lift this state up or use context
  const { getSelectedPayment, addPendingMatch } = useReconciliationStore();
  const payment = getSelectedPayment();
  
  if (!payment) return null;
  
  // Expose the selection via a global window property for ExpectationGrid to read
  (window as any).__selectedLineItemId = lineItemId;
  (window as any).__onLineItemMatched = (expectationId: string) => {
    addPendingMatch(lineItemId, expectationId);
    onClearSelection();
  };
  (window as any).__clearLineItemSelection = onClearSelection;
  
  return null;
}
