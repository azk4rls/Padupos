from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta
import numpy as np
import pandas as pd
from sklearn.linear_model import Ridge

MIN_DATA_POINTS = 7              # Absolute minimum required for weekly baseline
RECOMMENDED_DATA_POINTS = 30     # Recommended for full ML regression model
INSUFFICIENT_DATA_MESSAGE = "Belum cukup data untuk membuat prediksi. Minimal 7 hari data transaksi diperlukan."

class SalesForecastModel:
    """
    Sales Forecasting model designed for MSME transaction patterns.
    Implements tiered data sufficiency gates:
    - Below 7 days: Rejection with INSUFFICIENT_DATA
    - 7 to 29 days: Baseline weekly seasonal moving average (Fallback)
    - 30+ days: Full Ridge regression model
    Zero fabricated numbers.
    """

    def __init__(self, min_days: int = MIN_DATA_POINTS, recommended_days: int = RECOMMENDED_DATA_POINTS):
        self.min_days = min_days
        self.recommended_days = recommended_days

    def forecast(
        self,
        historical_sales: List[Dict[str, Any]],
        horizon_days: int = 7
    ) -> Dict[str, Any]:
        """
        historical_sales: list of dicts with 'date' (YYYY-MM-DD) and 'amount' (float/str).
        """
        if not historical_sales or len(historical_sales) < self.min_days:
            return {
                "status": "INSUFFICIENT_DATA",
                "message": INSUFFICIENT_DATA_MESSAGE,
                "data_points_count": len(historical_sales) if historical_sales else 0,
                "minimum_points_required": self.min_days,
                "recommended_points": self.recommended_days,
                "forecast": []
            }

        # Convert to DataFrame
        df = pd.DataFrame(historical_sales)
        df['date'] = pd.to_datetime(df['date'])
        df['amount'] = pd.to_numeric(df['amount'], errors='coerce').fillna(0.0)
        
        # Aggregate daily sales
        daily = df.groupby('date')['amount'].sum().reset_index().sort_values('date')

        if len(daily) < self.min_days:
            return {
                "status": "INSUFFICIENT_DATA",
                "message": INSUFFICIENT_DATA_MESSAGE,
                "data_points_count": len(daily),
                "minimum_points_required": self.min_days,
                "recommended_points": self.recommended_days,
                "forecast": []
            }

        last_date = daily['date'].max()
        data_count = len(daily)

        # Tier 1: Fallback Baseline for 7 to 29 days
        if data_count < self.recommended_days:
            # Baseline: Day-of-week mean or overall moving average
            daily['day_of_week'] = daily['date'].dt.dayofweek
            dow_means = daily.groupby('day_of_week')['amount'].mean().to_dict()
            overall_mean = float(daily['amount'].mean())
            std_err = float(daily['amount'].std()) if data_count > 1 else (overall_mean * 0.1)

            predictions = []
            for i in range(1, horizon_days + 1):
                future_date = last_date + timedelta(days=i)
                dow = future_date.weekday()
                pred_val = float(dow_means.get(dow, overall_mean))
                lower_bound = round(max(0.0, pred_val - (1.96 * std_err)), 4)
                upper_bound = round(pred_val + (1.96 * std_err), 4)

                predictions.append({
                    "date": future_date.strftime('%Y-%m-%d'),
                    "day_of_week": dow,
                    "predicted_amount": round(max(0.0, pred_val), 4),
                    "confidence_lower": lower_bound,
                    "confidence_upper": upper_bound,
                    "prediction_interval_lower": lower_bound,
                    "prediction_interval_upper": upper_bound,
                    "interval_type": "PREDICTION_INTERVAL_95",
                })

            total_predicted = sum(p["predicted_amount"] for p in predictions)
            return {
                "status": "SUCCESS",
                "model_type": "BASELINE_WEEKLY_AVERAGE",
                "is_fallback": True,
                "uncertainty_method": "SAMPLE_STANDARD_DEVIATION",
                "message": f"Prediksi menggunakan estimasi baseline rata-rata mingguan ({data_count} hari data tersedia, rekomendasi 30 hari).",
                "data_points_count": data_count,
                "horizon_days": horizon_days,
                "total_predicted_sales": round(total_predicted, 4),
                "forecast": predictions
            }

        # Tier 2: Full Ridge Regression Model for 30+ days
        daily['day_of_week'] = daily['date'].dt.dayofweek
        daily['day_of_month'] = daily['date'].dt.day
        daily['lag_1'] = daily['amount'].shift(1).bfill()
        daily['lag_7'] = daily['amount'].shift(7).bfill()
        daily['rolling_mean_7'] = daily['amount'].rolling(window=7, min_periods=1).mean()

        features = ['day_of_week', 'day_of_month', 'lag_1', 'lag_7', 'rolling_mean_7']
        X = daily[features].values
        y = daily['amount'].values

        model = Ridge(alpha=1.0)
        model.fit(X, y)

        last_amount = daily['amount'].iloc[-1]
        recent_window = list(daily['amount'].iloc[-7:])

        predictions = []
        current_lag1 = last_amount

        for i in range(1, horizon_days + 1):
            future_date = last_date + timedelta(days=i)
            dow = future_date.weekday()
            dom = future_date.day
            lag_7_val = recent_window[-(7 - ((i - 1) % 7))] if len(recent_window) >= 7 else current_lag1
            roll_mean = float(np.mean(recent_window[-7:]))

            x_future = np.array([[dow, dom, current_lag1, lag_7_val, roll_mean]])
            pred_val = max(0.0, float(model.predict(x_future)[0]))

            residuals = y - model.predict(X)
            std_err = float(np.std(residuals)) if len(residuals) > 1 else (pred_val * 0.1)
            lower_bound = round(max(0.0, pred_val - (1.96 * std_err)), 4)
            upper_bound = round(pred_val + (1.96 * std_err), 4)

            predictions.append({
                "date": future_date.strftime('%Y-%m-%d'),
                "day_of_week": dow,
                "predicted_amount": round(pred_val, 4),
                "confidence_lower": lower_bound,
                "confidence_upper": upper_bound,
                "prediction_interval_lower": lower_bound,
                "prediction_interval_upper": upper_bound,
                "interval_type": "PREDICTION_INTERVAL_95",
            })

            current_lag1 = pred_val
            recent_window.append(pred_val)

        total_predicted = sum(p["predicted_amount"] for p in predictions)

        return {
            "status": "SUCCESS",
            "model_type": "RIDGE_REGRESSION",
            "is_fallback": False,
            "uncertainty_method": "RESIDUAL_STANDARD_ERROR",
            "message": "Forecasting completed successfully using Ridge regression with residual standard error prediction intervals.",
            "data_points_count": data_count,
            "horizon_days": horizon_days,
            "total_predicted_sales": round(total_predicted, 4),
            "forecast": predictions
        }
