import unittest
from datetime import datetime, timedelta
import os
import sys

# Add worker package to python path
current_dir = os.path.dirname(os.path.abspath(__file__))
parent_dir = os.path.dirname(current_dir)
sys.path.insert(0, parent_dir)

from pipelines.sales_forecast import SalesForecastModel, INSUFFICIENT_DATA_MESSAGE
from pipelines.stock_forecast import StockForecastModel
from pipelines.anomaly_detection import AnomalyDetectionEngine


class TestSalesForecastModel(unittest.TestCase):
    def setUp(self):
        self.model = SalesForecastModel(min_days=7, recommended_days=30)

    def test_insufficient_data_rejection(self):
        """Must reject with INSUFFICIENT_DATA when history is under 7 days"""
        history = [
            {"date": f"2026-01-{i+1:02d}", "amount": 100000.0}
            for i in range(4)  # only 4 days
        ]
        result = self.model.forecast(history, horizon_days=7)
        self.assertEqual(result["status"], "INSUFFICIENT_DATA")
        self.assertEqual(result["message"], INSUFFICIENT_DATA_MESSAGE)
        self.assertEqual(result["data_points_count"], 4)
        self.assertEqual(len(result["forecast"]), 0)

    def test_fallback_tier_forecasting(self):
        """Must generate fallback baseline forecast when between 7 and 29 days"""
        start_date = datetime(2026, 1, 1)
        history = [
            {"date": (start_date + timedelta(days=i)).strftime('%Y-%m-%d'), "amount": 120000.0}
            for i in range(12)  # 12 days
        ]
        result = self.model.forecast(history, horizon_days=7)
        self.assertEqual(result["status"], "SUCCESS")
        self.assertTrue(result["is_fallback"])
        self.assertEqual(result["model_type"], "BASELINE_WEEKLY_AVERAGE")
        self.assertEqual(len(result["forecast"]), 7)
        self.assertGreater(result["total_predicted_sales"], 0.0)

    def test_recommended_tier_forecasting(self):
        """Must generate Ridge regression forecast when 30 or more days of data are provided"""
        start_date = datetime(2026, 1, 1)
        history = []
        for i in range(35):
            current = start_date + timedelta(days=i)
            base = 150000.0 + (50000.0 if current.weekday() in [5, 6] else 0.0)
            history.append({
                "date": current.strftime('%Y-%m-%d'),
                "amount": base
            })

        result = self.model.forecast(history, horizon_days=7)
        self.assertEqual(result["status"], "SUCCESS")
        self.assertFalse(result["is_fallback"])
        self.assertEqual(result["model_type"], "RIDGE_REGRESSION")
        self.assertEqual(result["horizon_days"], 7)
        self.assertEqual(len(result["forecast"]), 7)
        self.assertGreater(result["total_predicted_sales"], 0.0)

        # Check prediction structure and confidence intervals
        first_day = result["forecast"][0]
        self.assertIn("predicted_amount", first_day)
        self.assertIn("confidence_lower", first_day)
        self.assertIn("confidence_upper", first_day)
        self.assertLessEqual(first_day["confidence_lower"], first_day["confidence_upper"])


class TestStockForecastModel(unittest.TestCase):
    def setUp(self):
        self.model = StockForecastModel(default_lead_time_days=3, default_safety_stock_days=4)

    def test_zero_sales_history_honesty(self):
        """Must not hallucinate velocity when no sales history exists"""
        result = self.model.analyze_product_stock("prod_1", current_stock=50.0, sales_history=[])
        self.assertTrue(result["insufficient_sales_history"])
        self.assertEqual(result["daily_velocity_7d"], 0.0)
        self.assertIsNone(result["days_until_stockout"])
        self.assertEqual(result["recommended_reorder_qty"], 0.0)

    def test_active_stock_depletion_and_reorder(self):
        """Must calculate velocity, days until stockout, and reorder recommendation"""
        # 7 days of 10 units sold per day = velocity 10.0
        sales_history = [
            {"date": f"2026-03-{i+1:02d}", "quantity_sold": 10.0}
            for i in range(7)
        ]
        # Current stock = 15 units. At 10/day, depletion is 1.5 days -> CRITICAL risk
        result = self.model.analyze_product_stock("prod_coffee", current_stock=15.0, sales_history=sales_history)
        
        self.assertFalse(result["insufficient_sales_history"])
        self.assertEqual(result["daily_velocity_7d"], 10.0)
        self.assertEqual(result["days_until_stockout"], 1.5)
        self.assertEqual(result["stockout_risk"], "CRITICAL")

        # Target inventory = (lead_time 3 + safety 4) * 10 = 70. Needed = 70 - 15 = 55
        self.assertEqual(result["reorder_point"], 70.0)
        self.assertEqual(result["recommended_reorder_qty"], 55.0)


class TestAnomalyDetectionEngine(unittest.TestCase):
    def setUp(self):
        self.engine = AnomalyDetectionEngine(z_score_threshold=3.0, discount_threshold_pct=30.0)

    def test_normal_transactions_no_anomaly(self):
        transactions = [
            {"id": f"tx_{i}", "amount": 50000.0, "discount_amount": 0.0}
            for i in range(20)
        ]
        anomalies = self.engine.detect_transaction_anomalies(transactions)
        self.assertEqual(len(anomalies), 0)

    def test_z_score_transaction_outlier(self):
        # Baseline transactions around 50,000 IDR
        transactions = [
            {"id": f"tx_{i}", "amount": 50000.0 + (i * 100), "discount_amount": 0.0}
            for i in range(30)
        ]
        # Extreme transaction
        transactions.append({"id": "tx_suspicious", "amount": 2500000.0, "discount_amount": 0.0})

        anomalies = self.engine.detect_transaction_anomalies(transactions)
        outliers = [a for a in anomalies if a["type"] == "TRANSACTION_AMOUNT_OUTLIER"]
        self.assertEqual(len(outliers), 1)
        self.assertEqual(outliers[0]["reference_id"], "tx_suspicious")
        self.assertGreater(outliers[0]["z_score"], 3.0)

    def test_excessive_discount_anomaly(self):
        transactions = [
            {"id": "tx_normal", "amount": 100000.0, "discount_amount": 10000.0},     # 9% disc
            {"id": "tx_fraud_disc", "amount": 20000.0, "discount_amount": 80000.0}   # 80% disc
        ]
        anomalies = self.engine.detect_transaction_anomalies(transactions)
        disc_anomalies = [a for a in anomalies if a["type"] == "ABNORMAL_DISCOUNT"]
        self.assertEqual(len(disc_anomalies), 1)
        self.assertEqual(disc_anomalies[0]["reference_id"], "tx_fraud_disc")
        self.assertEqual(disc_anomalies[0]["severity"], "CRITICAL")

    def test_cash_session_discrepancy(self):
        # Discrepancy > 10,000 threshold
        anomaly = self.engine.detect_cash_session_discrepancy(
            session_id="cs_101",
            expected_cash=500000.0,
            actual_cash=450000.0,
            max_acceptable_diff=10000.0
        )
        self.assertIsNotNone(anomaly)
        self.assertEqual(anomaly["type"], "CASH_DRAWER_DISCREPANCY")
        self.assertEqual(anomaly["metric_value"], -50000.0)
        self.assertEqual(anomaly["severity"], "CRITICAL")


if __name__ == "__main__":
    unittest.main()
