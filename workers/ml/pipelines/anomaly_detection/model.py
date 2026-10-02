from typing import List, Dict, Any, Optional
import numpy as np
import uuid
from datetime import datetime

class AnomalyDetectionEngine:
    """
    Multi-signal Anomaly Detector for POS transactions, cash sessions, and discounts.
    Utilizes statistical Z-score thresholds and heuristic fraud signals.
    """

    def __init__(self, z_score_threshold: float = 3.0, discount_threshold_pct: float = 30.0):
        self.z_score_threshold = z_score_threshold
        self.discount_threshold_pct = discount_threshold_pct

    def detect_transaction_anomalies(
        self,
        transactions: List[Dict[str, Any]],
        historical_baseline: Optional[List[float]] = None
    ) -> List[Dict[str, Any]]:
        """
        Detects unusually high/low transaction amounts or extreme discounts.
        transactions: list of dicts with 'id', 'amount', 'discount_amount', 'cashier_id', 'created_at'.
        """
        if not transactions:
            return []

        anomalies = []

        # Extract amounts
        amounts = [float(t.get('amount', 0.0)) for t in transactions]
        baseline_amounts = historical_baseline if historical_baseline and len(historical_baseline) >= 5 else amounts

        mean_amt = float(np.mean(baseline_amounts))
        std_amt = float(np.std(baseline_amounts)) if len(baseline_amounts) > 1 else 0.0

        for t in transactions:
            amt = float(t.get('amount', 0.0))
            discount = float(t.get('discount_amount', 0.0))
            subtotal = amt + discount

            # 1. Z-Score Transaction Size Anomaly
            if std_amt > 0:
                z_score = (amt - mean_amt) / std_amt
                if z_score >= self.z_score_threshold:
                    anomalies.append({
                        "id": f"anom_{uuid.uuid4().hex[:8]}",
                        "type": "TRANSACTION_AMOUNT_OUTLIER",
                        "severity": "HIGH" if z_score > 4.0 else "MEDIUM",
                        "reference_id": t.get("id"),
                        "metric_value": amt,
                        "baseline_mean": round(mean_amt, 4),
                        "baseline_std": round(std_amt, 4),
                        "z_score": round(z_score, 2),
                        "description": f"Transaksi {t.get('id')} bernilai {amt:.2f} mencurigakan (Z-score {z_score:.2f} melebihi batas {self.z_score_threshold}).",
                        "timestamp": t.get("created_at", datetime.now().isoformat())
                    })

            # 2. Abnormal Discount Percentage
            if subtotal > 0 and discount > 0:
                disc_pct = (discount / subtotal) * 100.0
                if disc_pct >= self.discount_threshold_pct:
                    anomalies.append({
                        "id": f"anom_{uuid.uuid4().hex[:8]}",
                        "type": "ABNORMAL_DISCOUNT",
                        "severity": "CRITICAL" if disc_pct >= 50.0 else "HIGH",
                        "reference_id": t.get("id"),
                        "metric_value": round(disc_pct, 2),
                        "threshold": self.discount_threshold_pct,
                        "description": f"Diskon sebesar {disc_pct:.1f}% ({discount:.2f}) pada transaksi {t.get('id')} melebihi batas toleransi {self.discount_threshold_pct}%.",
                        "timestamp": t.get("created_at", datetime.now().isoformat())
                    })

        return anomalies

    def detect_cash_session_discrepancy(
        self,
        session_id: str,
        expected_cash: float,
        actual_cash: float,
        max_acceptable_diff: float = 10000.0
    ) -> Optional[Dict[str, Any]]:
        """
        Detects cash discrepancy between expected system cash and physically counted cash.
        """
        diff = actual_cash - expected_cash
        abs_diff = abs(diff)

        if abs_diff > max_acceptable_diff:
            severity = "CRITICAL" if abs_diff >= (max_acceptable_diff * 5) else "HIGH"
            direction = "SELISIH LEBIH" if diff > 0 else "SELISIH KURANG"

            return {
                "id": f"anom_{uuid.uuid4().hex[:8]}",
                "type": "CASH_DRAWER_DISCREPANCY",
                "severity": severity,
                "reference_id": session_id,
                "metric_value": round(diff, 4),
                "expected_value": round(expected_cash, 4),
                "actual_value": round(actual_cash, 4),
                "description": f"Sesi kasir {session_id} mengalami {direction} sebesar {abs_diff:.2f} (Diharapkan: {expected_cash:.2f}, Fisik: {actual_cash:.2f}).",
                "timestamp": datetime.now().isoformat()
            }

        return None
