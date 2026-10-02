# PADUPOS — Machine Learning Pipeline Architecture

## 1. Asynchronous Python ML Architecture

Machine Learning workloads run in an isolated Python worker environment (`workers/ml`) leveraging `scikit-learn`, `pandas`, and `numpy`.

```
┌────────────────────────────────┐         JSON Job Payload         ┌─────────────────────────────┐
│ Fastify API Monolith           ├─────────────────────────────────►│ Python ML Worker            │
│ (/api/v1/ml/sales-forecast,    │                                  │ (workers/ml/worker.py)      │
│  /api/v1/ml/stock-depletion,   │◄─────────────────────────────────┤ - Data Sufficiency Checks   │
│  /api/v1/ml/anomalies)         │         Predictions & Risks      │ - Regression / Run Rates    │
└────────────────────────────────┘                                  │ - Outlier & Fraud Detection │
                                                                    └─────────────────────────────┘
```

---

## 2. Models & Algorithms

### A. Sales Forecasting (`workers/ml/pipelines/sales_forecast/model.py`)
- **Data Sufficiency Rule**: Requires a minimum of **30 distinct days** of sales history.
- **Insufficient Data Behavior**:
  ```json
  {
    "status": "INSUFFICIENT_DATA",
    "message": "Belum cukup data untuk membuat prediksi. Minimal 30 hari data transaksi diperlukan.",
    "data_points_count": 12,
    "required_points": 30
  }
  ```
- **Sufficient Data Pipeline**:
  - Features: Day of week, day of month, Lag 1, Lag 7, 7-day rolling mean.
  - Estimator: `Ridge` regression with confidence intervals computed via historical residual standard deviation ($\pm 1.96 \sigma$).

### B. Stock Depletion & Run Rate (`workers/ml/pipelines/stock_forecast/model.py`)
- **Daily Velocity**:
  $$\text{Velocity}_{7d} = \frac{\sum_{i=1}^7 \text{Units Sold}_i}{7}$$
- **Days Until Stockout**:
  $$\text{Stockout Days} = \frac{\text{Current Stock}}{\text{Velocity}}$$
- **Risk Tiers**:
  - $\le 0$ days: `OUT_OF_STOCK`
  - $< 3$ days: `CRITICAL`
  - $< 7$ days: `HIGH`
  - $< 14$ days: `MEDIUM`
  - $\ge 14$ days: `LOW`
- **Reorder Recommendation**:
  $$\text{Target} = (\text{Lead Time} + \text{Safety Stock}) \times \text{Velocity}$$
  $$\text{Recommended Qty} = \max(0, \text{Target} - \text{Current Stock})$$

### C. Multi-Signal Anomaly Detector (`workers/ml/pipelines/anomaly_detection/model.py`)
- **Transaction Outlier**: Flags transactions where $Z\text{-score} = \frac{X - \mu}{\sigma} \ge 3.0$.
- **Abnormal Discount**: Flags transactions with discount percentage $\ge 30\%$ of gross value.
- **Cash Drawer Discrepancy**: Flags cash drawer difference exceeding threshold upon session close.
