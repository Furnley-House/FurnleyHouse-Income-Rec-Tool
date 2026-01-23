// Sample CSV templates for data import
// Note: Calculation_Date on expectations should align with Payment_Date on payments for proper month filtering

export const samplePaymentsCSV = `Payment_ID,Provider_Name,Payment_Reference,Amount,Payment_Date,Bank_Reference,Status,Notes,Included_Superbia_Companies,Date_Range_Start,Date_Range_End
PAY-0001,Aegon,AEG-2024-12-001,45250.00,2024-12-15,BACS-789456,unreconciled,December commission payment,Furnley House;Headleys,2024-12-01,2024-12-31
PAY-0002,Aviva,AVV-2024-11-002,32180.50,2024-11-18,BACS-789457,unreconciled,November trail commission,,2024-11-01,2024-11-30
PAY-0003,Legal & General,LG-2024-12-003,18945.25,2024-12-20,BACS-789458,unreconciled,December fee payment,Anchor Wealth,2024-12-01,2024-12-31`;

export const sampleLineItemsCSV = `Line_Item_ID,Payment,Client_Name,Plan_Reference,Agency_Code,Adviser_Name,Fee_Type,Fee_Category,Amount,Description,Status
LI-00001,PAY-0001,Mr J Smith,POL-123456,AG001,James Anderson,management,ongoing,1250.00,December management fee,unmatched
LI-00002,PAY-0001,Mrs S Johnson,POL-234567,AG001,Sarah Mitchell,management,ongoing,875.50,December trail,unmatched
LI-00003,PAY-0001,Mr R Williams,POL-345678,AG002,James Anderson,advisory,initial,2500.00,Initial commission,unmatched
LI-00004,PAY-0002,Ms A Brown,POL-456789,AG001,David Thompson,management,ongoing,1150.25,November fee,unmatched
LI-00005,PAY-0002,Mr T Davis,POL-567890,AG003,Sarah Mitchell,performance,ongoing,980.00,November trail,unmatched
LI-00006,PAY-0003,Mrs P Wilson,POL-678901,AG002,David Thompson,custody,ongoing,1425.75,December management fee,unmatched`;

// Note: Calculation_Date determines which payment month an expectation should match to
export const sampleExpectationsCSV = `Expectation_ID,Client_Name,Plan_Reference,Expected_Amount,Calculation_Date,Fund_Reference,Fee_Category,Fee_Type,Provider_Name,Adviser_Name,Superbia_Company,Status
EXP-0001,Mr J Smith,POL-123456,1250.00,2024-12-01,FUND-001,ongoing,management,Aegon,James Anderson,Furnley House,unmatched
EXP-0002,Mrs S Johnson,POL-234567,880.00,2024-12-01,FUND-002,ongoing,management,Aegon,Sarah Mitchell,Furnley House,unmatched
EXP-0003,Mr R Williams,POL-345678,2500.00,2024-12-01,FUND-003,initial,advisory,Aegon,James Anderson,Headleys,unmatched
EXP-0004,Ms A Brown,POL-456789,1150.25,2024-11-01,FUND-004,ongoing,management,Aviva,David Thompson,Furnley House,unmatched
EXP-0005,Mr T Davis,POL-567890,975.00,2024-11-01,FUND-005,ongoing,management,Aviva,Sarah Mitchell,Anchor Wealth,unmatched
EXP-0006,Mrs P Wilson,POL-678901,1430.00,2024-12-01,FUND-006,ongoing,management,Legal & General,David Thompson,Anchor Wealth,unmatched
EXP-0007,Mr J Smith,POL-123456,1245.00,2024-11-01,FUND-001,ongoing,management,Aegon,James Anderson,Furnley House,unmatched
EXP-0008,Mrs S Johnson,POL-234567,878.00,2024-11-01,FUND-002,ongoing,management,Aegon,Sarah Mitchell,Furnley House,unmatched`;

export const downloadCSV = (content: string, filename: string) => {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
};
