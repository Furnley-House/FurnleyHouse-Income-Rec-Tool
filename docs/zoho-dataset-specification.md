# Zoho CRM Dataset Specification
## Payment Reconciliation System

**Document Version:** 1.0  
**Last Updated:** January 2026

---

## Overview

This document specifies the Zoho CRM datasets required to support the Payment Reconciliation System. These datasets enable the storage, retrieval, and synchronisation of payment data, fee expectations, and reconciliation matches.

---

## 1. Payments Dataset

Represents bulk payments received from providers (e.g., Aegon, Aviva).

| Field Name | API Name | Data Type | Required | Description |
|------------|----------|-----------|----------|-------------|
| Payment ID | `Payment_ID` | Auto Number | Yes | Unique identifier (e.g., PAY-0001) |
| Provider Name | `Provider_Name` | Lookup (Providers) | Yes | Link to provider record |
| Payment Reference | `Payment_Reference` | Single Line | Yes | Provider's payment reference |
| Amount | `Amount` | Currency | Yes | Total payment amount |
| Payment Date | `Payment_Date` | Date | Yes | Date payment was received |
| Bank Reference | `Bank_Reference` | Single Line | No | Bank transaction reference |
| Status | `Status` | Picklist | Yes | unreconciled, in_progress, reconciled |
| Reconciled Amount | `Reconciled_Amount` | Currency | No | Amount successfully matched |
| Remaining Amount | `Remaining_Amount` | Currency | No | Amount still to be matched |
| Notes | `Notes` | Multi Line | No | Reconciliation notes |
| Reconciled At | `Reconciled_At` | DateTime | No | When fully reconciled |
| Reconciled By | `Reconciled_By` | Lookup (Users) | No | User who completed reconciliation |
| Included Superbia Companies | `Included_Superbia_Companies` | Multi-Select | No | Furnley House, Headleys, Anchor Wealth |
| Date Range Start | `Date_Range_Start` | Date | No | Start of expectation date filter |
| Date Range End | `Date_Range_End` | Date | No | End of expectation date filter |

---

## 2. Payment Line Items Dataset

Individual line items from provider statements, linked to a parent Payment.

| Field Name | API Name | Data Type | Required | Description |
|------------|----------|-----------|----------|-------------|
| Line Item ID | `Line_Item_ID` | Auto Number | Yes | Unique identifier |
| Payment | `Payment` | Lookup (Payments) | Yes | Parent payment record |
| Client Name | `Client_Name` | Single Line | Yes | Client name from statement |
| Plan Reference | `Plan_Reference` | Single Line | Yes | Plan/policy reference |
| Agency Code | `Agency_Code` | Single Line | No | Agency identifier for matching |
| Fee Category | `Fee_Category` | Picklist | No | initial, ongoing |
| Amount | `Amount` | Currency | Yes | Line item amount |
| Description | `Description` | Single Line | No | Line item description |
| Status | `Status` | Picklist | Yes | unmatched, matched, approved_unmatched |
| Matched Expectation | `Matched_Expectation` | Lookup (Expectations) | No | Linked expectation when matched |
| Match Notes | `Match_Notes` | Multi Line | No | Notes about the match |

---

## 3. Expectations Dataset

Fee expectations calculated from client plans, used as the "expected" side of reconciliation.

| Field Name | API Name | Data Type | Required | Description |
|------------|----------|-----------|----------|-------------|
| Expectation ID | `Expectation_ID` | Auto Number | Yes | Unique identifier (e.g., EXP-0001) |
| Client Name | `Client_Name` | Single Line | Yes | Client full name |
| Plan Reference | `Plan_Reference` | Single Line | Yes | Plan/policy reference |
| Expected Amount | `Expected_Amount` | Currency | Yes | Calculated expected fee amount |
| Calculation Date | `Calculation_Date` | Date | Yes | When expectation was calculated |
| Fund Reference | `Fund_Reference` | Single Line | No | Associated fund reference |
| Fee Category | `Fee_Category` | Picklist | Yes | initial, ongoing |
| Fee Type | `Fee_Type` | Picklist | Yes | management, performance, advisory, custody |
| Description | `Description` | Single Line | No | Fee description |
| Provider Name | `Provider_Name` | Lookup (Providers) | Yes | Provider for this expectation |
| Adviser Name | `Adviser_Name` | Single Line | Yes | Name of the adviser |
| Superbia Company | `Superbia_Company` | Picklist | Yes | Furnley House, Headleys, Anchor Wealth |
| Status | `Status` | Picklist | Yes | unmatched, partial, matched |
| Allocated Amount | `Allocated_Amount` | Currency | No | Amount already matched |
| Remaining Amount | `Remaining_Amount` | Currency | No | Amount still to be matched |

---

## 4. Matches Dataset

Records of confirmed matches between payment line items and expectations.

| Field Name | API Name | Data Type | Required | Description |
|------------|----------|-----------|----------|-------------|
| Match ID | `Match_ID` | Auto Number | Yes | Unique identifier (e.g., MTH-0001) |
| Payment | `Payment` | Lookup (Payments) | Yes | Parent payment record |
| Payment Line Item | `Payment_Line_Item` | Lookup (Payment Line Items) | No | Specific line item matched |
| Expectation | `Expectation` | Lookup (Expectations) | Yes | Matched expectation |
| Matched Amount | `Matched_Amount` | Currency | Yes | Amount allocated in this match |
| Variance | `Variance` | Currency | No | Difference between expected and actual |
| Variance Percentage | `Variance_Percentage` | Decimal | No | Variance as percentage |
| Match Type | `Match_Type` | Picklist | Yes | full, partial, multi |
| Match Method | `Match_Method` | Picklist | Yes | auto, manual, ai-suggested |
| Match Quality | `Match_Quality` | Picklist | No | perfect, good, acceptable, warning |
| Notes | `Notes` | Multi Line | No | Match notes or justification |
| Matched By | `Matched_By` | Lookup (Users) | Yes | User who confirmed match |
| Matched At | `Matched_At` | DateTime | Yes | When match was confirmed |
| Confirmed | `Confirmed` | Checkbox | Yes | Whether match is confirmed |

---

## 5. Providers Dataset

Reference data for payment providers, supporting parent-child relationships for provider brands/codes.

| Field Name | API Name | Data Type | Required | Description |
|------------|----------|-----------|----------|-------------|
| Provider ID | `Provider_ID` | Auto Number | Yes | Unique identifier |
| Provider Name | `Provider_Name` | Single Line | Yes | Provider name or brand (e.g., Aviva Pensions) |
| Provider Code | `Provider_Code` | Single Line | No | Short code used in statements |
| Parent Provider | `Parent_Provider` | Lookup (Providers) | No | Parent provider for grouped brands |
| Is Payment Source | `Is_Payment_Source` | Checkbox | Yes | True if this provider makes bulk payments |
| Active | `Active` | Checkbox | Yes | Whether provider is active |
| Contact Email | `Contact_Email` | Email | No | Provider contact email |
| Notes | `Notes` | Multi Line | No | Additional notes |

### Provider Hierarchy Example

```
Aviva (Is_Payment_Source: Yes)
├── Aviva Pensions (Parent: Aviva)
├── Aviva Group (Parent: Aviva)
└── Aviva Investments (Parent: Aviva)
```

When matching, expectations tagged with any child provider will match to payments from the parent provider.

---

## Relationships Diagram

```
┌─────────────────┐
│    Providers    │
└────────┬────────┘
         │
         │ 1:many
         ▼
┌─────────────────┐       ┌─────────────────┐
│    Payments     │       │  Expectations   │
└────────┬────────┘       └────────┬────────┘
         │                         │
         │ 1:many                  │
         ▼                         │
┌─────────────────┐                │
│  Payment Line   │                │
│     Items       │                │
└────────┬────────┘                │
         │                         │
         │         ┌───────────────┘
         │         │
         ▼         ▼
    ┌─────────────────┐
    │     Matches     │
    └─────────────────┘
```

---

## Picklist Values Reference

### Status (Payments)
- `unreconciled` - Not yet processed
- `in_progress` - Partially matched
- `reconciled` - Fully matched

### Status (Line Items)
- `unmatched` - No expectation linked
- `matched` - Successfully matched
- `approved_unmatched` - Approved without match

### Status (Expectations)
- `unmatched` - No payment linked
- `partial` - Partially allocated
- `matched` - Fully allocated

### Fee Category
- `initial` - Initial/setup fees
- `ongoing` - Recurring fees

### Fee Type
- `management` - Management fees
- `performance` - Performance fees
- `advisory` - Advisory fees
- `custody` - Custody fees

### Match Type
- `full` - Complete match
- `partial` - Partial allocation
- `multi` - Multiple expectations matched

### Match Method
- `auto` - System auto-matched
- `manual` - User manually matched
- `ai-suggested` - AI suggested, user confirmed

### Match Quality
- `perfect` - Exact amount match
- `good` - Within 1% variance
- `acceptable` - Within tolerance
- `warning` - Outside tolerance, needs review

### Superbia Company
- `Furnley House`
- `Headleys`
- `Anchor Wealth`

---

## Data Flow

1. **Expectations** are created from fee calculations in Zoho (existing process)
2. **Payments** and **Payment Line Items** are imported from bank/provider statements
3. **Matches** are created by the Reconciliation Tool when users confirm matches
4. Status fields are updated automatically as matching progresses

---

## API Integration Notes

When integrating with the Reconciliation Tool:

1. **Read Operations**
   - Fetch Payments with status `unreconciled` or `in_progress`
   - Fetch Expectations filtered by Provider, Superbia Company, and Date Range
   - Include related Payment Line Items when fetching Payments

2. **Write Operations**
   - Create Match records when user confirms matches
   - Update Payment status and Reconciled Amount
   - Update Expectation status and Allocated Amount
   - Update Payment Line Item status and Matched Expectation

3. **Authentication**
   - Use OAuth 2.0 with refresh token
   - Store credentials securely (never in client-side code)

---

## Contact

For questions about this specification, please contact the development team.
