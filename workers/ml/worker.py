import json
import sys
from typing import Dict, Any
from pipelines.sales_forecast import SalesForecastModel
from pipelines.stock_forecast import StockForecastModel
from pipelines.anomaly_detection import AnomalyDetectionEngine

def process_job(payload: Dict[str, Any]) -> Dict[str, Any]:
    task = payload.get("task")
    params = payload.get("params", {})

    if task == "sales_forecast":
        model = SalesForecastModel(min_days=params.get("min_days", 30))
        return model.forecast(
            historical_sales=params.get("historical_sales", []),
            horizon_days=params.get("horizon_days", 7)
        )
    elif task == "stock_forecast":
        model = StockForecastModel(
            default_lead_time_days=params.get("lead_time_days", 3),
            default_safety_stock_days=params.get("safety_stock_days", 4)
        )
        return model.analyze_product_stock(
            product_id=params.get("product_id", ""),
            current_stock=params.get("current_stock", 0.0),
            sales_history=params.get("sales_history", []),
            lead_time_days=params.get("lead_time_days"),
            safety_stock_days=params.get("safety_stock_days"),
            min_reorder_qty=params.get("min_reorder_qty", 0.0)
        )
    elif task == "anomaly_detection":
        engine = AnomalyDetectionEngine(
            z_score_threshold=params.get("z_score_threshold", 3.0),
            discount_threshold_pct=params.get("discount_threshold_pct", 30.0)
        )
        if "transactions" in params:
            return {
                "anomalies": engine.detect_transaction_anomalies(
                    transactions=params.get("transactions", []),
                    historical_baseline=params.get("historical_baseline")
                )
            }
        elif "session" in params:
            sess = params["session"]
            anom = engine.detect_cash_session_discrepancy(
                session_id=sess.get("session_id", ""),
                expected_cash=float(sess.get("expected_cash", 0.0)),
                actual_cash=float(sess.get("actual_cash", 0.0)),
                max_acceptable_diff=float(sess.get("max_acceptable_diff", 10000.0))
            )
            return {"anomaly": anom}
        return {"error": "Invalid anomaly detection parameters"}
    else:
        return {"error": f"Unknown task: {task}"}

def main():
    if len(sys.argv) > 1 and sys.argv[1] == "--test-health":
        print(json.dumps({"status": "OK", "worker": "PADUPOS_ML_WORKER_READY"}))
        return

    # Read from standard input if piped
    try:
        raw_input = sys.stdin.read()
        if raw_input.strip():
            payload = json.loads(raw_input)
            result = process_job(payload)
            print(json.dumps(result, indent=2))
    except Exception as e:
        print(json.dumps({"error": str(e)}), file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()
