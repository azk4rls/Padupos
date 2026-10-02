# PADUPOS — Global-First Country Configuration & Localization

## 1. Zero Hardcoded Geographic Boundaries

PADUPOS contains **no hardcoded** `country === 'ID'`, `currency === 'IDR'`, or `payment === 'QRIS'` in generic business logic. Every localized behavior (currency formatting, sales tax computation, date presentation, and payment options) is driven dynamically by country and branch configurations.

---

## 2. Currently Configured Countries

| Country | Code | ISO-3 | Currency | Symbol | Default Locale | Tax System |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **Indonesia** | `ID` | `IDN` | `IDR` | `Rp` | `id-ID` | VAT (PPN 11%) |
| **Singapore** | `SG` | `SGP` | `SGD` | `S$` | `en-SG` | GST (9%) |
| **Malaysia** | `MY` | `MYS` | `MYR` | `RM` | `ms-MY` | SST (6%) |
| **United States** | `US` | `USA` | `USD` | `$` | `en-US` | Sales Tax |
| **United Kingdom**| `GB` | `GBR` | `GBP` | `£` | `en-GB` | VAT (20%) |
| **Australia** | `AU` | `AUS` | `AUD` | `A$` | `en-AU` | GST (10%) |

---

## 3. Adding a New Country

To expand PADUPOS into a new territory, developers simply add a new configuration record to `packages/config/src/countries.ts` without touching the core accounting, inventory, or POS logic:

```typescript
export const NEW_COUNTRY_CONFIG: Country = {
  id: 'country_ph',
  countryCode: 'PH',
  iso3: 'PHL',
  name: 'Philippines',
  defaultCurrency: 'PHP',
  defaultLocale: 'en-PH',
  defaultTimezone: 'Asia/Manila',
  taxSystemType: 'VAT',
  dateFormat: 'MM/DD/YYYY',
  numberFormat: {
    decimalSeparator: '.',
    thousandSeparator: ',',
    decimalPlaces: 2,
    currencySymbol: '₱',
    symbolPlacement: 'BEFORE',
  },
  isActive: true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};
```
