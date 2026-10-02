from typing import List, Dict, Any, Optional
import math
import numpy as np

class StockForecastModel:
    """
    Inventory depletion and replenishment recommendation engine.
    Computes true run rate velocities, stockout horizon, and lead-time buffered restock amounts.
    """

    def __init__(self, default_lead_time_days: int = 3, default_safety_stock_days: int = 4):
        self.default_lead_time_days = default_lead_time_days
        self.default_safety_stock_days = default_safety_stock_days

    def analyze_product_stock(
        self,
        product_id: str,
        current_stock: float,
        sales_history: List[Dict[str, Any]],
        lead_time_days: Optional[int] = None,
        safety_stock_days: Optional[int] = None,
        min_reorder_qty: float = 0.0
    ) -> Dict[str, Any]:
        """
        sales_history: list of dicts with 'date' (YYYY-MM-DD) and 'quantity_sold' (float).
        """
        lead_time = lead_time_days if lead_time_days is not None else self.default_lead_time_days
        safety_days = safety_stock_days if safety_stock_days is not None else self.default_safety_stock_days

        if not sales_history:
            return {
                "product_id": product_id,
                "current_stock": round(float(current_stock), 4),
                "insufficient_sales_history": True,
                "daily_velocity_7d": 0.0,
                "daily_velocity_30d": 0.0,
                "days_until_stockout": None,
                "stockout_risk": "LOW",
                "reorder_point": 0.0,
                "recommended_reorder_qty": 0.0,
                "message": "Belum ada riwayat penjualan untuk menghitung kecepatan stok."
            }

        # Calculate quantities sold over 7d, 14d, 30d
        quantities = [float(item.get("quantity_sold", 0.0)) for item in sales_history]
        total_units = sum(quantities)
        history_length = max(1, len(sales_history))

        velocity_window = min(7, history_length)
        recent_units = sum(quantities[-velocity_window:])
        velocity_7d = round(recent_units / float(velocity_window), 4)

        velocity_30d = round(total_units / float(history_length), 4)

        # Primary velocity prioritizes recent 7-day run rate if available
        primary_velocity = velocity_7d if velocity_7d > 0 else velocity_30d

        if primary_velocity <= 0:
            return {
                "product_id": product_id,
                "current_stock": round(float(current_stock), 4),
                "insufficient_sales_history": False,
                "daily_velocity_7d": 0.0,
                "daily_velocity_30d": 0.0,
                "days_until_stockout": None,
                "stockout_risk": "LOW",
                "reorder_point": 0.0,
                "recommended_reorder_qty": 0.0,
                "message": "Tidak ada penjualan dalam periode yang dianalisis."
            }

        days_until_stockout = round(float(current_stock) / primary_velocity, 2)

        # Risk classification
        if days_until_stockout <= 0:
            stockout_risk = "OUT_OF_STOCK"
        elif days_until_stockout < 3:
            stockout_risk = "CRITICAL"
        elif days_until_stockout < 7:
            stockout_risk = "HIGH"
        elif days_until_stockout < 14:
            stockout_risk = "MEDIUM"
        else:
            stockout_risk = "LOW"

        # Reorder Point (ROP) = (Lead Time * Velocity) + Safety Stock
        safety_stock_units = safety_days * primary_velocity
        reorder_point = round((lead_time * primary_velocity) + safety_stock_units, 4)

        # Recommended order quantity to cover (lead_time + safety_stock)
        target_inventory = (lead_time + safety_days) * primary_velocity
        needed_qty = max(0.0, target_inventory - float(current_stock))
        
        if needed_qty > 0 and min_reorder_qty > 0:
            needed_qty = max(needed_qty, float(min_reorder_qty))

        recommended_reorder_qty = round(needed_qty, 4)

        return {
            "product_id": product_id,
            "current_stock": round(float(current_stock), 4),
            "insufficient_sales_history": False,
            "daily_velocity_7d": velocity_7d,
            "daily_velocity_30d": velocity_30d,
            "primary_velocity": primary_velocity,
            "days_until_stockout": days_until_stockout,
            "stockout_risk": stockout_risk,
            "reorder_point": reorder_point,
            "recommended_reorder_qty": recommended_reorder_qty,
            "lead_time_days": lead_time,
            "safety_stock_days": safety_days
        }
