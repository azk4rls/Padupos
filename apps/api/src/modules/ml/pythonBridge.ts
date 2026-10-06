import { spawn } from 'node:child_process';
import path from 'node:path';
import type {
  SalesDailyDataset,
  ProductDemandFeatures,
  AnomalyDetectionDataset,
  MLInferenceResponse,
} from '@padupos/types';

// ================================================================
// PYTHON ML WORKER BOUNDARY
// ================================================================
// Fastify
//   ↓
// prepared ML dataset / service boundary (dataReadiness.ts)
//   ↓
// PythonBridge (pythonBridge.ts)
//   ↓
// future Python ML worker/service (workers/ml/worker.py)
//   ↓
// future model (scikit-learn / XGBoost pipelines)
//   ↓
// future prediction/result
// ================================================================

export type PythonMLTask = 'sales_forecast' | 'stock_forecast' | 'anomaly_detection';

export interface PythonMLPayload {
  task: PythonMLTask;
  params: Record<string, unknown>;
}

export interface PythonMLWorkerResult {
  status: 'SUCCESS' | 'INSUFFICIENT_DATA' | 'MODEL_FAILURE';
  message?: string;
  data?: unknown;
  error?: string;
}

/**
 * Transforms prepared datasets into Python worker input contracts.
 */
export class PythonBridge {
  /**
   * Formats a SalesDailyDataset for the Python sales_forecast pipeline.
   */
  static formatSalesForecastPayload(
    dataset: SalesDailyDataset,
    horizonDays = 7,
  ): PythonMLPayload {
    const historical_sales = dataset.observations.map((obs) => ({
      date: obs.date,
      amount: Number(obs.revenue),
      units: Number(obs.unitsSold),
      transactions: obs.transactionCount,
    }));

    return {
      task: 'sales_forecast',
      params: {
        historical_sales,
        horizon_days: horizonDays,
        min_days: 14,
        scope: dataset.scope,
      },
    };
  }

  /**
   * Formats product features for the Python stock_forecast pipeline.
   */
  static formatStockForecastPayload(
    product: ProductDemandFeatures,
    leadTimeDays = 3,
    safetyStockDays = 4,
  ): PythonMLPayload {
    return {
      task: 'stock_forecast',
      params: {
        product_id: product.productId,
        current_stock: Number(product.currentStock),
        daily_velocity: Number(product.avgDailyDemand),
        lead_time_days: leadTimeDays,
        safety_stock_days: safetyStockDays,
        moving_avg_7d: Number(product.movingAvg7d),
        moving_avg_30d: Number(product.movingAvg30d),
      },
    };
  }

  /**
   * Formats anomaly dataset for the Python anomaly_detection pipeline.
   */
  static formatAnomalyDetectionPayload(
    dataset: AnomalyDetectionDataset,
  ): PythonMLPayload {
    const transactions = dataset.observations.map((obs) => ({
      id: obs.transactionId,
      date: obs.date,
      amount: Number(obs.amount),
      item_count: obs.itemCount,
      deviation_score: Number(obs.deviationScore),
    }));

    return {
      task: 'anomaly_detection',
      params: {
        transactions,
        historical_baseline: {
          mean_amount: Number(dataset.baseline.meanAmount),
          std_amount: Number(dataset.baseline.stdDevAmount),
          sample_size: dataset.baseline.sampleSize,
        },
      },
    };
  }

  /**
   * Executes the Python ML worker over stdin/stdout.
   * If the worker fails, times out, or produces invalid output,
   * returns MODEL_FAILURE (never classifies model failure as INSUFFICIENT_DATA).
   */
  static async executeWorker(
    payload: PythonMLPayload,
    options: {
      timeoutMs?: number;
      pythonExecutable?: string;
      workerScript?: string;
    } = {},
  ): Promise<PythonMLWorkerResult> {
    const pythonBin = options.pythonExecutable || process.env.PYTHON_BIN || 'python';
    const workerScript =
      options.workerScript ||
      path.resolve(process.cwd(), '../../workers/ml/worker.py');
    const timeoutMs = options.timeoutMs || 10000;

    return new Promise<PythonMLWorkerResult>((resolve) => {
      let resolved = false;

      let child;
      try {
        child = spawn(pythonBin, [workerScript], {
          stdio: ['pipe', 'pipe', 'pipe'],
        });
      } catch (err) {
        return resolve({
          status: 'MODEL_FAILURE',
          error: `Failed to spawn Python process: ${(err as Error).message}`,
        });
      }

      const timer = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          child.kill();
          resolve({
            status: 'MODEL_FAILURE',
            error: `Python ML worker execution timed out after ${timeoutMs}ms`,
          });
        }
      }, timeoutMs);

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (chunk) => {
        stdout += chunk.toString();
      });

      child.stderr.on('data', (chunk) => {
        stderr += chunk.toString();
      });

      child.on('error', (err) => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timer);
          resolve({
            status: 'MODEL_FAILURE',
            error: `Python worker process error: ${err.message}`,
          });
        }
      });

      child.on('close', (code) => {
        if (resolved) return;
        resolved = true;
        clearTimeout(timer);

        if (code !== 0) {
          return resolve({
            status: 'MODEL_FAILURE',
            error: `Python worker exited with non-zero code ${code}: ${stderr || 'Unknown error'}`,
          });
        }

        try {
          const parsed = JSON.parse(stdout);
          if (parsed.status === 'INSUFFICIENT_DATA') {
            return resolve({
              status: 'INSUFFICIENT_DATA',
              message: parsed.message || 'Data belum cukup untuk membuat prediksi.',
              data: parsed,
            });
          }
          if (parsed.error) {
            return resolve({
              status: 'MODEL_FAILURE',
              error: parsed.error,
            });
          }
          return resolve({
            status: 'SUCCESS',
            data: parsed,
          });
        } catch (err) {
          return resolve({
            status: 'MODEL_FAILURE',
            error: `Failed to parse Python worker JSON output: ${(err as Error).message}. Raw output: ${stdout}`,
          });
        }
      });

      // Send payload to worker
      try {
        child.stdin.write(JSON.stringify(payload));
        child.stdin.end();
      } catch (err) {
        if (!resolved) {
          resolved = true;
          clearTimeout(timer);
          resolve({
            status: 'MODEL_FAILURE',
            error: `Failed to write payload to Python worker stdin: ${(err as Error).message}`,
          });
        }
      }
    });
  }
}
