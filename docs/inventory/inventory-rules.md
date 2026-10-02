# PADUPOS — Inventory & Costing (WAC) Rules

## 1. Weighted Average Cost (WAC) Calculation

PADUPOS mandates the **Weighted Average Cost (WAC)** valuation method for inventory costing. Every purchase batch updates the unit cost price dynamically:

$$\text{WAC}_{\text{new}} = \frac{(Q_{\text{current}} \times C_{\text{current}}) + (Q_{\text{incoming}} \times C_{\text{incoming}})}{Q_{\text{current}} + Q_{\text{incoming}}}$$

### Edge Cases Handled:
- **Zero or Negative Stock**: If $Q_{\text{current}} \le 0$, the incoming purchase cost becomes the new cost directly ($\text{WAC}_{\text{new}} = C_{\text{incoming}}$).
- **Zero Incoming**: If $Q_{\text{incoming}} = 0$, existing cost is preserved.

```typescript
import BigNumber from 'bignumber.js';

export function calculateWeightedAverageCost(
  currentQuantity: string | number,
  currentCost: string | number,
  incomingQuantity: string | number,
  incomingCost: string | number
): string {
  const curQty = new BigNumber(currentQuantity);
  const curCost = new BigNumber(currentCost);
  const inQty = new BigNumber(incomingQuantity);
  const inCost = new BigNumber(incomingCost);

  if (curQty.isLessThanOrEqualTo(0)) {
    return inCost.toFixed(4);
  }

  const totalValue = curQty.multipliedBy(curCost).plus(inQty.multipliedBy(inCost));
  const totalQty = curQty.plus(inQty);

  if (totalQty.isZero()) return curCost.toFixed(4);

  return totalValue.dividedBy(totalQty).toFixed(4);
}
```

---

## 2. Inventory Movements Ledger

Stock adjustments are tracked through an append-only `inventory_movements` log. The following movement types are supported:

| Movement Type | Quantity Direction | Cost Reference |
| :--- | :--- | :--- |
| `PURCHASE` | Positive (+) | Purchase Invoice Cost |
| `SALE` | Negative (-) | Current WAC Unit Cost |
| `RETURN_RESTOCK` | Positive (+) | Original Sale Cost |
| `ADJUSTMENT_IN` | Positive (+) | Current WAC Cost |
| `ADJUSTMENT_OUT` | Negative (-) | Current WAC Cost |
| `DAMAGE` | Negative (-) | Current WAC Cost |

---

## 3. Stock Depletion & Reorder Points

- **Low Stock Threshold**: Triggered when `current_stock <= min_stock_level`.
- **Reorder Point (ROP)**:
  $$\text{ROP} = (\text{Daily Velocity} \times \text{Lead Time Days}) + (\text{Daily Velocity} \times \text{Safety Stock Days})$$
- **Automated Alerts**: Real-time notifications dispatched to store managers when stock breaches the reorder threshold.
