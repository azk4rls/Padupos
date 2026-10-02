# PADUPOS — Grounded AI Business Intelligence Rules

## 1. Zero Hallucination Principle

PADUPOS AI operates under a **Strict Grounded Intelligence** mandate:
- **No Hallucinated Numbers**: AI cannot invent, interpolate, or fabricate revenue, expenses, or projections.
- **SQL Fact Grounding**: Every prompt dispatched to the AI model contains verified aggregate telemetry queried directly from the tenant's database (Total Sales, Gross Profit, Low Stock Items, Unsettled Payables/Receivables).
- **Prompt Injection Defense**: System prompts enforce:
  > *"You are PADUPOS Grounded Business Advisor. Answer strictly using the verified operational data provided in this prompt. If data is zero or missing, advise the merchant that data is insufficient to conclude. Never invent sales figures or hypothetical percentages."*

---

## 2. Dynamic Insight Types

1. `SALES_TREND`: Grounded analysis of today's sales vs recent averages, top selling items, and payment method distribution.
2. `INVENTORY_RISK`: Alerts on items with zero stock or stock below safety levels, estimating impact on revenue.
3. `EXPENSE_SPIKE`: Highlights significant operational expenses incurred within the period and compares them to gross profit.
4. `BUSINESS_SUMMARY`: Comprehensive daily or weekly operational briefing for the business owner.

---

## 3. Honest Empty States

When a business has no transaction history or fewer than the required data points:
- AI outputs honest, actionable guidance:
  `"Belum ada data transaksi yang tercatat. Lakukan transaksi penjualan atau catat pengeluaran untuk mengaktifkan analisis performa bisnis."`
