# Outlet View

The **Outlet View** combines basic outlet registry information with corresponding operating configuration limits (such as stock value limits, credit limits, visiting frequency, and price lists) into a single flat schema.

---

## Google Sheet Formula

```excel
=LET(
  MasterFileID, VLOOKUP("MasterFileID",Config!A1:B,2,0),

  OutletsRaw, IMPORTRANGE(MasterFileID, "Outlets!A2:O"),
  FilteredOutlets, FILTER(OutletsRaw, IFERROR(INDEX(OutletsRaw, 0, 1) <> "", FALSE)),
  RulesRaw, IMPORTRANGE(MasterFileID, "OutletOperatingRules!B2:F"),

  HEADER, {
    "Code", "Name", "ContactPerson", "Phone", "Email", "Country", "Province", "City", "Area", "CommunicationAddress", "MapLocationLink", "Picture", "Picture2", "Picture3", "Licence",
    "MaxStockValueLimit", "VisitFrequencyDays", "CreditLimit", "PriceListCode"
  },

  DATA,
  BYROW(
    FilteredOutlets,
    LAMBDA(outlet_row,
      LET(
        outlet_code, INDEX(outlet_row, 1, 1),
        max_stock, IFERROR(VLOOKUP(outlet_code, RulesRaw, 2, FALSE), ""),
        visit_freq, IFERROR(VLOOKUP(outlet_code, RulesRaw, 3, FALSE), ""),
        credit_limit, IFERROR(VLOOKUP(outlet_code, RulesRaw, 4, FALSE), ""),
        price_list, IFERROR(VLOOKUP(outlet_code, RulesRaw, 5, FALSE), ""),

        HSTACK(
          outlet_row,
          max_stock,
          visit_freq,
          credit_limit,
          price_list
        )
      )
    )
  ),

  VSTACK(HEADER, DATA)
)
```

---

## Inputs & Dependencies

The formula imports data from the spreadsheet corresponding to `MasterFileID` defined in the local `Config` sheet:
1. **`Outlets`** (`Outlets!A2:O`): Primary registry of outlet profiles (containing Code, Name, Contact details, Address, Map location link, Pictures, and Licence).
2. **`OutletOperatingRules`** (`OutletOperatingRules!B2:F`): Contains operational settings mapped by Outlet Code.

---

## Columns Produced

The output table matches the following schema:

| Column | Header | Source/Formula | Description |
| :--- | :--- | :--- | :--- |
| 1 | `Code` | `Outlets` Col 1 | Unique Outlet Code. |
| 2 | `Name` | `Outlets` Col 2 | Name of the Outlet. |
| 3 | `ContactPerson` | `Outlets` Col 3 | Outlet main contact person. |
| 4 | `Phone` | `Outlets` Col 4 | Contact phone number. |
| 5 | `Email` | `Outlets` Col 5 | Contact email address. |
| 6 | `Country` | `Outlets` Col 6 | Country. |
| 7 | `Province` | `Outlets` Col 7 | Province/State. |
| 8 | `City` | `Outlets` Col 8 | City. |
| 9 | `Area` | `Outlets` Col 9 | Area/Neighborhood. |
| 10 | `CommunicationAddress` | `Outlets` Col 10 | Complete postal address. |
| 11 | `MapLocationLink` | `Outlets` Col 11 | Google Maps URL. |
| 12 | `Picture` | `Outlets` Col 12 | Photo URL. |
| 13 | `Picture2` | `Outlets` Col 13 | Additional photo URL. |
| 14 | `Picture3` | `Outlets` Col 14 | Additional photo URL. |
| 15 | `Licence` | `Outlets` Col 15 | Business License details. |
| 16 | `MaxStockValueLimit` | `RulesRaw` Col 2 | Max limit value of stock permitted. |
| 17 | `VisitFrequencyDays` | `RulesRaw` Col 3 | Targeted customer visit frequency (in days). |
| 18 | `CreditLimit` | `RulesRaw` Col 4 | Financial credit limit. |
| 19 | `PriceListCode` | `RulesRaw` Col 5 | Price list code assigned to this outlet. |

---

## Detailed Logic Breakdown

1. **`IMPORTRANGE`**: Fetches raw tables from the external Master Spreadsheet.
2. **`FILTER`**: Filters out rows where the outlet code is empty.
3. **`BYROW` Iteration**:
   - Iterates through the filtered outlet rows.
   - Extracts the `outlet_code` (first column).
   - Performs `VLOOKUP` against `RulesRaw` for the stock limit, visit frequency, credit limit, and price list code.
   - Uses `HSTACK` to append the lookup outputs to the end of the raw outlet row.
4. **Stacking Results**: `VSTACK` prepends the custom headers to the aggregated data rows.
