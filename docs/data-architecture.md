# Data Architecture & Flow

**Document Purpose:** Technical reference for data structures, relationships, and data flow  
**Last Updated:** February 2026

---

## 1. Overview

The system operates across two data layers:

- **Zoho CRM** — The system of record for payments, expectations, matches, and providers
- **Local Cache (PostgreSQL)** — A transient working copy used during reconciliation sessions

Data flows in a controlled cycle: **Download → Work → Sync**. Only one session is active at a time, and pending matches must be synchronised before new data can be downloaded.

---

## 2. Zoho CRM Data Model

### 2.1 Entity Relationship Diagram

```
┌─────────────────┐
│    Providers     │
│  (Reference)     │
└────────┬────────┘
         │
         │ Lookup (Payment_Provider)
         ▼
┌─────────────────┐                    ┌─────────────────┐
│  Bank_Payments   │                    │  Expectations    │
│  (Payment Header)│                    │  (Expected Fees) │
└────────┬────────┘                    └────────┬────────┘
         │                                      │
         │ Lookup (Bank_Payment)                │
         ▼                                      │
┌─────────────────┐                             │
│ Bank_Payment_    │                             │
│   Lines          │                             │
│ (Statement Items)│                             │
└────────┬────────┘                             │
         │              ┌───────────────────────┘
         │              │
         ▼              ▼
    ┌─────────────────────────┐
    │    Payment_Matches      │
    │  (Confirmed Matches)    │
    └─────────────────────────┘
```

### 2.2 Zoho Modules

#### Providers

Reference data for payment sources. Supports a parent/child hierarchy via `Provider_Group`.

| Field | API Name | Type | Notes |
|-------|----------|------|-------|
| Provider ID | `Provider_ID` | Auto Number | Unique identifier |
| Name | `Name` | Single Line | Provider name or brand |
| Provider Code | `Provider_Code` | Single Line | Short code used in statements |
| Provider Group | `Provider_Group` | Picklist | Parent company grouping (e.g. "Aviva") |
| Is Payment Source | `Is_Payment_Source` | Checkbox | True if this provider makes bulk payments |
| Active | `Active` | Checkbox | Whether provider is active |

**Hierarchy Example:**
```
Aviva (Provider_Group: "Aviva", Is_Payment_Source: Yes)
├── Aviva Pensions   (Provider_Group: "Aviva")
├── Aviva Group      (Provider_Group: "Aviva")
└── Aviva Investments (Provider_Group: "Aviva")
```

#### Bank_Payments

Bulk payments received from providers.

| Field | API Name | Type | Notes |
|-------|----------|------|-------|
| Payment ID | Auto Number | Auto Number | Unique identifier |
| Name | `Name` | Single Line | Populated from Payment Reference |
| Payment Reference | `Payment_Reference` | Single Line | Provider's reference |
| Payment Provider | `Payment_Provider` | Lookup (Providers) | Must be a numeric Zoho record ID |
| Amount | `Amount` | Currency | Total payment amount |
| Payment Date | `Payment_Date` | Date | YYYY-MM-DD format |
| Status | `Status` | Picklist | `unreconciled` / `in_progress` / `reconciled` |
| Reconciled Amount | `Reconciled_Amount` | Currency | Amount successfully matched |
| Remaining Amount | `Remaining_Amount` | Currency | Amount still to match |
| Reconciled By | `Reconciled_By` | Single Line | Hardcoded as "Reconciliation Tool" |

#### Bank_Payment_Lines

Individual line items within a bulk payment.

| Field | API Name | Type | Notes |
|-------|----------|------|-------|
| Line Item ID | `Line_Item_ID` | Auto Number | Unique identifier |
| Name | `Name` | Single Line | Client Name or Plan Reference (mandatory) |
| Bank Payment | `Bank_Payment` | Lookup (Bank_Payments) | Parent payment record |
| Client Name | `Client_Name` | Single Line | Client name from statement |
| Plan Reference | `Plan_Reference` | Single Line | Policy/plan reference (primary match key) |
| Adviser Name | `Adviser_Name` | Single Line | Adviser for matching metadata |
| Amount | `Amount` | Currency | Line item amount |
| Fee Category | `Fee_Category` | Picklist | `initial` / `ongoing` |
| Status | `Status` | Picklist | `unmatched` / `matched` / `approved_unmatched` |
| Matched Expectation | `Matched_Expectation` | Lookup (Expectations) | Linked when matched |
| Match Notes | `Match_Notes` | Multi Line | Notes about the match |

#### Expectations

Fee expectations calculated from client plans.

| Field | API Name | Type | Notes |
|-------|----------|------|-------|
| Expectation ID | `Expectation_ID` | Auto Number | Unique identifier |
| Client | `Client_1` | Lookup (Contacts) | Resolved to display name at fetch time |
| Plan Reference | `Plan_Policy_Reference` | Single Line | Primary match identifier |
| Expected Amount | `Expected_Fee_Amount` | Currency | Calculated expected fee |
| Calculation Date | `Calculation_Date` | Date | YYYY-MM-DD format |
| Fee Category | `Fee_Category` | Picklist | `initial` / `ongoing` |
| Fee Type | `Fee_Type` | Picklist | Used to derive Fee Category if blank |
| Provider | `Provider` | Lookup (Providers) | Resolved to display name |
| Adviser Name | `Adviser_Name` | Single Line | Adviser name |
| Superbia Company | `Superbia_Company` | Picklist | `Furnley House` / `Headleys` / `Anchor Wealth` |
| Status | `Status` | Picklist | `unmatched` / `partial` / `matched` |
| Allocated Amount | `Allocated_Amount` | Currency | Amount already matched |
| Remaining Amount | `Remaining_Amount` | Currency | Amount still to match |

#### Payment_Matches

Confirmed matches between line items and expectations.

| Field | API Name | Type | Notes |
|-------|----------|------|-------|
| Match ID | `Payment_Match_ID` | Auto Number | Unique identifier |
| Name | `Name` | Single Line | Format: `Match-{timestamp}-{index}` |
| Payment | `Bank_Payment_Ref_Match` | Lookup (Bank_Payments) | Parent payment |
| Line Item | `Payment_Line_Match` | Lookup (Bank_Payment_Lines) | Matched line item |
| Expectation | `Expectation` | Lookup (Expectations) | Matched expectation (null for data-check items) |
| Matched Amount | `Matched_Amount` | Currency | Amount allocated |
| Variance | `Variance` | Currency | Difference from expected |
| Variance Percentage | `Variance_Percentage` | Decimal | Variance as % |
| Match Type | `Match_Type` | Picklist | `full` / `partial` / `multi` |
| Match Method | `Match_Method` | Picklist | `auto` / `manual` / `ai-suggested` |
| Match Quality | `Match_Quality` | Picklist | `perfect` / `good` / `acceptable` / `warning` |
| No Match Reason Code | `No_Match_Reason_Code` | Picklist | For approved-unmatched items (see §4.2) |
| Notes | `Notes` | Multi Line | Match justification |
| Confirmed | `Confirmed` | Checkbox | Always `true` when created by the tool |

---

## 3. Local Cache Data Model (PostgreSQL)

The local cache mirrors a subset of Zoho data for session performance. All tables use `text` primary keys matching Zoho record IDs.

### 3.1 Tables

#### `cached_payments`

| Column | Type | Notes |
|--------|------|-------|
| `id` | text (PK) | Zoho record ID |
| `zoho_record_id` | text | Duplicate of id for explicit reference |
| `provider_name` | text | Resolved provider name |
| `payment_reference` | text | Provider's reference |
| `amount` | numeric | Total payment amount |
| `payment_date` | date | Payment date |
| `period_start` | date | Expectation date filter start |
| `period_end` | date | Expectation date filter end |
| `status` | text | `unreconciled` / `in_progress` / `reconciled` |
| `reconciled_amount` | numeric | Amount matched so far |
| `remaining_amount` | numeric | Amount still to match |
| `notes` | text | Reconciliation notes |
| `cached_at` | timestamptz | When downloaded |
| `updated_at` | timestamptz | Last local modification |

#### `cached_line_items`

| Column | Type | Notes |
|--------|------|-------|
| `id` | text (PK) | Zoho record ID |
| `zoho_record_id` | text | Duplicate of id for explicit reference |
| `payment_id` | text (FK → cached_payments) | Parent payment |
| `client_name` | text | Client name from statement |
| `plan_reference` | text | Policy reference (match key) |
| `adviser_name` | text | Adviser name |
| `amount` | numeric | Line item amount |
| `fee_category` | text | `initial` / `ongoing` |
| `status` | text | `unmatched` / `matched` / `approved_unmatched` |
| `matched_expectation_id` | text | Linked expectation ID when matched |
| `match_notes` | text | Match notes |
| `reason_code` | text | Data-check reason code |
| `cached_at` | timestamptz | When downloaded |
| `updated_at` | timestamptz | Last local modification |

#### `cached_expectations`

| Column | Type | Notes |
|--------|------|-------|
| `id` | text (PK) | Zoho record ID |
| `zoho_record_id` | text | Duplicate of id for explicit reference |
| `client_name` | text | Resolved from Client_1 lookup |
| `plan_reference` | text | Policy reference (match key) |
| `adviser_name` | text | Adviser name |
| `expected_amount` | numeric | Expected fee amount |
| `calculation_date` | date | When expectation was calculated |
| `fee_category` | text | `initial` / `ongoing` |
| `provider_name` | text | Resolved provider name |
| `status` | text | `unmatched` / `partial` / `matched` |
| `allocated_amount` | numeric | Amount matched so far |
| `remaining_amount` | numeric | Amount still to match |
| `cached_at` | timestamptz | When downloaded |
| `updated_at` | timestamptz | Last local modification |

#### `pending_matches`

Staging table for matches confirmed locally but not yet synced to Zoho.

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid (PK) | Auto-generated |
| `payment_id` | text (FK → cached_payments) | Parent payment Zoho ID |
| `line_item_id` | text (FK → cached_line_items) | Line item Zoho ID |
| `expectation_id` | text | Expectation Zoho ID, or `DATA_CHECK_NO_EXPECTATION` for approved-unmatched |
| `matched_amount` | numeric | Amount allocated |
| `variance` | numeric | Amount variance |
| `variance_percentage` | numeric | Percentage variance |
| `match_quality` | text | `perfect` / `good` / `acceptable` / `warning` |
| `notes` | text | Match notes (includes reason code prefix for data-check items) |
| `matched_at` | timestamptz | When confirmed locally |
| `synced_to_zoho` | boolean | `false` until successfully synced |
| `synced_at` | timestamptz | When synced to Zoho |

#### `sync_status`

Singleton row tracking the current session state.

| Column | Type | Notes |
|--------|------|-------|
| `id` | text (PK) | Always `'current'` |
| `last_download_at` | timestamptz | Last Zoho data download |
| `last_sync_at` | timestamptz | Last sync to Zoho |
| `pending_match_count` | integer | Auto-updated by trigger |
| `is_locked` | boolean | Prevents concurrent downloads |
| `lock_reason` | text | Why the session is locked |

#### `zoho_token_cache`

Shared OAuth token to prevent refresh flooding across Edge Function instances.

| Column | Type | Notes |
|--------|------|-------|
| `id` | text (PK) | Always `'default'` |
| `access_token` | text | Current OAuth access token |
| `expires_at` | timestamptz | Token expiry time |
| `updated_at` | timestamptz | Last refresh time |

---

## 4. Data Flow

### 4.1 Download Flow (Zoho → Local Cache)

```
User clicks "Load Data"
         │
         ▼
┌──────────────────────────────────────────────────┐
│  Edge Function: zoho-crm                         │
│                                                  │
│  1. Check/refresh OAuth token                    │
│  2. Fetch Providers (resolve hierarchy)           │
│     ──── 500ms delay ────                        │
│  3. Fetch Bank_Payments (COQL → hydrate by ID)   │
│     ──── 500ms delay ────                        │
│  4. Fetch Bank_Payment_Lines (COQL → hydrate)    │
│     ──── 500ms delay ────                        │
│  5. Fetch Expectations (all, no status filter)    │
│     - Resolve Client_1 lookup to display name    │
│     - Resolve Provider lookup to display name    │
│     - Derive Fee Category from Fee_Category      │
│       or Fee_Type fields                         │
└──────────────┬───────────────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────────────┐
│  Frontend: Cache to PostgreSQL                   │
│                                                  │
│  • Upsert cached_payments (batch 500)            │
│  • Upsert cached_line_items (batch 500)          │
│  • Upsert cached_expectations (batch 500)        │
│  • Update sync_status.last_download_at           │
└──────────────────────────────────────────────────┘
```

**Pagination:** COQL queries use LIMIT 200 + OFFSET pagination. Hydration uses batches of 100 IDs per request.

**No status filtering on Expectations:** Zoho data quality issues (blank/null status fields) caused records to be silently excluded. All expectations are fetched and filtered client-side.

### 4.2 Reconciliation Flow (In-Memory + Local Cache)

```
┌─────────────────────────────────────────────────────────┐
│  Phase 1: Prescreening (Auto-Match)                     │
│                                                         │
│  • Match on Plan/Policy Reference                       │
│  • Progressive tolerance: 0% → 1% → 5% → 10% → 25%    │
│  • Exclude zero/negative expectations                   │
│  • Each expectation consumed once (no double-matching)   │
│  • Confirmed → pending_matches table                    │
└──────────────────────┬──────────────────────────────────┘
                       ▼
┌─────────────────────────────────────────────────────────┐
│  Phase 2: Data Checks (Condition Verification)          │
│                                                         │
│  Live COQL queries verify against Zoho:                 │
│  • "No Plan Found" — Policy Ref not in Plans module     │
│  • "No Fee Record" — Plan exists but no linked Fee      │
│  • "Zero Valuation" — Plan valuation field is zero      │
│  • "Ongoing Fee Zero Percent" — Fee % is zero           │
│  • "Potential Duplicate" — Policy Ref already matched   │
│  • "Upload Error" — Manual skip by user                 │
│                                                         │
│  Approved items → pending_matches with:                 │
│    expectation_id = 'DATA_CHECK_NO_EXPECTATION'         │
│    notes = '{ReasonCode}: {description}'                 │
└──────────────────────┬──────────────────────────────────┘
                       ▼
┌─────────────────────────────────────────────────────────┐
│  Phase 3: Manual Match                                  │
│                                                         │
│  • Drag-and-drop or selection-based matching            │
│  • Weighted suggestions based on reference similarity   │
│  • Out-of-tolerance matches require approval notes      │
│  • Confirmed → pending_matches table                    │
└─────────────────────────────────────────────────────────┘
```

### 4.3 Sync Flow (Local Cache → Zoho)

```
User clicks "Sync to Zoho"
         │
         ▼
┌──────────────────────────────────────────────────────────┐
│  Read all pending_matches WHERE synced_to_zoho = false   │
│  (paginated in batches of 1,000)                         │
└──────────────────────┬───────────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────────┐
│  Phase 1: Create Payment_Matches (100 per API call)      │
│                                                          │
│  For each record:                                        │
│  • Bank_Payment_Ref_Match = { id: paymentZohoId }        │
│  • Payment_Line_Match     = { id: lineItemZohoId }       │
│  • Expectation            = { id: expectationZohoId }    │
│    (omitted if DATA_CHECK_NO_EXPECTATION)                │
│  • No_Match_Reason_Code   = reason code                  │
│    (only for data-check items)                           │
│                                                          │
│  ──── 2s delay between batches ────                      │
└──────────────────────┬───────────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────────┐
│  Phase 2: Update Bank_Payment_Lines (100 per API call)   │
│  (only for items with a real expectation link)           │
│                                                          │
│  • Status → 'matched'                                    │
│  • Matched_Expectation → { id: expectationZohoId }       │
│                                                          │
│  ──── 2s delay ────                                      │
└──────────────────────┬───────────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────────┐
│  Phase 3: Update Expectations (100 per API call)         │
│  (de-duplicated by expectation ID)                       │
│                                                          │
│  • Status → 'matched'                                    │
│  • Allocated_Amount → sum of matched amounts             │
│  • Remaining_Amount → 0                                  │
└──────────────────────┬───────────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────────┐
│  Mark synced pending_matches:                            │
│  • synced_to_zoho = true                                 │
│  • synced_at = now()                                     │
│  Update sync_status.last_sync_at                         │
└──────────────────────────────────────────────────────────┘
```

### 4.4 CSV Import Flow (File → Zoho)

```
CSV File Upload
      │
      ▼
┌──────────────────────────────────┐
│  Parse CSV + AI Column Mapping   │
│  (Edge Function: csv-mapping-ai) │
└──────────────┬───────────────────┘
               │
               ▼
┌──────────────────────────────────┐
│  Value Mapping                   │
│  • Fuzzy match enum values       │
│  • User reviews/corrects         │
└──────────────┬───────────────────┘
               │
               ▼
┌──────────────────────────────────┐
│  Create in Zoho (Edge Function)  │
│  1. Create Bank_Payment header   │
│  2. Batch-create Bank_Payment_   │
│     Lines (100 per call)         │
└──────────────────────────────────┘

Note: Imported data is NOT in the local cache.
User must click "Load Data" to refresh.
```

---

## 5. Lookup Field Format

All Zoho lookup fields must be sent as objects with an `id` property containing the numeric Zoho record ID:

```json
{
  "Bank_Payment_Ref_Match": { "id": "5046754000012345678" },
  "Payment_Line_Match": { "id": "5046754000012345679" },
  "Expectation": { "id": "5046754000012345680" }
}
```

Non-numeric values (e.g. placeholder strings) are omitted to prevent Zoho API validation errors.

---

## 6. Rate Limit Management

| Constraint | Strategy |
|------------|----------|
| Zoho API calls per minute | 2-second delays between batches |
| 200-record COQL page limit | Automated LIMIT/OFFSET pagination |
| OAuth token refresh limits | Shared token cache in PostgreSQL |
| Edge Function timeouts | Hydration in batches of 100 IDs |
| Supabase URL length limits | Database updates in chunks of 100 |
| Supabase payload limits | Bulk inserts in chunks of 500 |

---

## 7. Session Integrity

The system enforces a strict session model:

1. **Download lock** — Only one download session can be active. The `sync_status.is_locked` flag prevents concurrent downloads.
2. **Sync gate** — New data cannot be downloaded until all pending matches are synced (pending_match_count = 0).
3. **Cache rehydration** — On page load, the in-memory Zustand store is rehydrated from the PostgreSQL cache, preserving work across browser refreshes.
4. **Resumable sync** — If sync is interrupted (rate limit, network error), only unsynced records are processed on retry.
