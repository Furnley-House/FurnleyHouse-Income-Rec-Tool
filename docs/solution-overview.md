# Payment Reconciliation Solution Overview

**Document Purpose:** Team presentation brief  
**Last Updated:** February 2026

---

## 1. What the Solution Does

The Payment Reconciliation Tool automates the matching of **bulk provider payments** (e.g., from Aegon, Aviva) against **expected fee calculations** held in Zoho CRM. It replaces a manual, spreadsheet-based process with an interactive workspace that supports auto-matching, manual matching, and batch synchronisation back to the CRM.

---

## 2. Solution Architecture

```
┌─────────────────────────────────────────────────────┐
│                   User's Browser                    │
│              (React / TypeScript App)               │
│                                                     │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────┐ │
│  │ Payment     │  │ Reconciliation│  │ CSV Import │ │
│  │ List        │  │ Workspace     │  │ Tool       │ │
│  └─────────────┘  └──────────────┘  └────────────┘ │
└──────────────────────┬──────────────────────────────┘
                       │ HTTPS
                       ▼
┌─────────────────────────────────────────────────────┐
│              Lovable Cloud (Backend)                │
│                                                     │
│  ┌──────────────────┐  ┌─────────────────────────┐ │
│  │ Edge Functions    │  │ Database (PostgreSQL)   │ │
│  │ • zoho-crm       │  │ • cached_payments       │ │
│  │ • zoho-token-     │  │ • cached_line_items     │ │
│  │   exchange        │  │ • cached_expectations   │ │
│  │ • csv-mapping-ai  │  │ • pending_matches       │ │
│  └────────┬─────────┘  │ • sync_status           │ │
│           │             │ • zoho_token_cache       │ │
│           │             └─────────────────────────┘ │
└───────────┼─────────────────────────────────────────┘
            │ OAuth 2.0
            ▼
┌─────────────────────────────────────────────────────┐
│                    Zoho CRM                         │
│                                                     │
│  Bank_Payments  ──1:many──  Bank_Payment_Lines      │
│  Expectations                                       │
│  Payment_Matches                                    │
│  Providers                                          │
└─────────────────────────────────────────────────────┘
```

---

## 3. Zoho CRM Datasets

| Dataset | Purpose | Key Fields |
|---------|---------|------------|
| **Bank_Payments** | Bulk payments received from providers | Payment Reference, Amount, Provider, Status, Date Range |
| **Bank_Payment_Lines** | Individual line items within a payment | Client Name, Plan Reference, Amount, Fee Category, Status |
| **Expectations** | Calculated fee expectations from client plans | Client Name, Plan Reference, Expected Amount, Provider, Adviser, Superbia Company |
| **Payment_Matches** | Confirmed matches between line items and expectations | Matched Amount, Variance, Match Type, Match Quality |
| **Providers** | Reference data for payment providers (supports parent/child hierarchy) | Provider Name, Provider Code, Parent Provider |

---

## 4. End-to-End Workflow

### Phase 1: Data Loading (CSV Import)

1. User receives a **bulk payment statement** from a provider (e.g., CSV file)
2. The **CSV Import Tool** allows the user to upload and map statement columns to system fields
3. AI-assisted column mapping suggests the best field assignments
4. Validated line items are loaded into Zoho CRM as **Bank_Payment_Lines** under a parent **Bank_Payment** record

### Phase 2: Data Download (Zoho → Local Cache)

1. User clicks **"Load Data"** in the reconciliation workspace
2. The system fetches from Zoho CRM in sequence (with rate-limit management):
   - **Providers** → **Bank_Payments** → **Bank_Payment_Lines** → **Expectations**
3. Records are stored in a **local database cache** (PostgreSQL) to ensure:
   - Fast in-browser performance with 3,000+ records
   - No data loss on page refresh or view switching
   - Independence from Zoho API availability during a work session

### Phase 3: Reconciliation (Matching)

1. User selects a payment from the **Payment List** (left panel)
2. The workspace displays:
   - **Statement Line Items** (left side) — what was actually paid
   - **Outstanding Expectations** (right side) — what was expected
3. **Prescreening Mode** runs automatic matching:
   - Matches on **Plan/Policy Reference** as the primary identifier
   - Applies progressive variance tolerance: Exact → 1% → 5% → 10% → 25%
   - Excludes zero/negative expectations automatically
4. User reviews suggested matches and can:
   - **Accept** auto-matches
   - **Manually match** remaining items via drag-and-drop or selection
   - **Invalidate** expectations that are no longer valid
5. Confirmed matches are saved to the local **pending_matches** table

### Phase 4: Synchronisation (Local Cache → Zoho)

1. User clicks **"Sync to Zoho"** when ready to commit matches
2. The system performs a **three-phase batch sync**:

| Phase | Action | Zoho Module |
|-------|--------|-------------|
| 1 | Create match records (up to 100 per API call) | Payment_Matches |
| 2 | Update line item statuses to "matched" | Bank_Payment_Lines |
| 3 | Update expectation statuses to "matched" | Expectations |

3. Rate limiting is managed with automatic cooldown timers and retry logic
4. The local cache is updated to reflect synced status

---

## 5. Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| **Local caching layer** | Zoho API rate limits (and 200-record query limits) make real-time interaction impractical for 3,000+ record datasets |
| **Fetch-Work-Sync cycle** | Prevents data conflicts — only one download session active at a time; sync must complete before new data can be loaded |
| **Batch API operations** | Reduces API calls from potentially thousands (one per record) to tens (100 records per call) |
| **Database-backed token cache** | All backend instances share a single OAuth token, preventing token refresh flooding |
| **Progressive variance matching** | Allows exact matches to be confirmed first, then progressively relaxes tolerance for remaining items |
| **No status filtering on fetch** | Zoho data quality issues (blank status fields) caused records to be silently missed — fetching all records and filtering locally is more reliable |

---

## 6. Superbia Companies

The system supports three operating companies under the Superbia group:

- **Furnley House**
- **Headleys**
- **Anchor Wealth**

Payments can span multiple companies. Expectations are tagged to a specific company, allowing filtered views during reconciliation.

---

## 7. Match Quality Classification

| Quality | Definition |
|---------|------------|
| **Perfect** | Exact amount match (< £0.005 difference) |
| **Good** | Within 1% variance |
| **Acceptable** | Within configured tolerance |
| **Warning** | Outside tolerance — requires manual review and approval notes |

---

## 8. Rate Limit & Error Management

- Zoho imposes API call limits per minute/day
- The system detects rate limits and displays a **countdown timer** to the user
- Batch sync **halts immediately** on rate limit detection to prevent wasted calls
- Users can resume sync after the cooldown period (typically 60 seconds)

---

## 9. User Entry Points

| Feature | Description |
|---------|-------------|
| **Income Reconciliation** | Main workspace for matching payments against expectations |
| **Payment Loading (CSV)** | Import tool for loading new payment statements from provider CSVs |

---

## 10. Data Security

- All Zoho API credentials are stored as encrypted backend secrets
- OAuth tokens are managed server-side only (never exposed to the browser)
- The local cache uses Row Level Security policies
- No sensitive data is stored in client-side code
