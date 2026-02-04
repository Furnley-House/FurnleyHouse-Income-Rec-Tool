# CSV Import Mapping Design

## Universal Field Source Pattern

Every target field (fields required in Zoho) can be sourced from one of three options:

### 1. CSV Column (`source: 'csv'`)
- User selects which CSV column maps to this field
- AI provides suggestions with confidence levels
- Sample values shown in tooltip for verification

### 2. Payment Header (`source: 'header'`)  
- Value is inherited from the payment header entered in Step 1
- Available header fields: paymentDate, paymentReference, providerName, paymentAmount, notes
- Display shows the actual value that will be used

### 3. Fixed Value (`source: 'hardcoded'`)
- User enters a constant value applied to all rows
- Validation is performed based on field type:
  - **date**: Must match YYYY-MM-DD format
  - **number**: Must be a valid numeric value
  - **enum**: Must be one of predefined options (dropdown shown)
  - **text**: Any string value

## Field Validation Rules

Defined in `FIELD_VALIDATION` in `types.ts`:

| Field | Type | Validation |
|-------|------|------------|
| payment_date | date | YYYY-MM-DD format |
| amount | number | Valid numeric |
| payment_reference | text | Any string |
| client_name | text | Any string |
| policy_reference | text | Any string |
| description | text | Any string |
| transaction_type | enum | credit, debit, fee, commission |
| balance | number | Valid numeric |
| fee_category | enum | initial, ongoing, ad-hoc |
| adviser_name | text | Any string |
| agency_code | text | Any string |

## Component Structure

```
MappingReviewStep.tsx
  └── FieldMappingRow.tsx (one per target field)
        ├── Source selector (CSV / Header / Fixed)
        ├── Value selector (depends on source)
        └── Validation feedback
```

## Data Flow

1. AI analysis provides suggested CSV column mappings
2. User reviews and can change any field's source
3. On proceed, configs are converted to legacy format:
   - CSV mappings → `FieldMapping[]`
   - Header/hardcoded → `DefaultFieldValue[]`
