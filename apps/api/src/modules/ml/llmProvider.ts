import type {
  LLMExplanationRequest,
  LLMExplanationResult,
} from '@padupos/types';
import { config } from '../../config/index.js';

export interface LLMExplanationProvider {
  name: string;
  explainInsight(request: LLMExplanationRequest): Promise<LLMExplanationResult>;
}

/**
 * 1. Authoritative Deterministic Explanation Provider
 * Default provider: generates grounded natural language synthesis directly from validated facts.
 * Never invents metrics, never executes DB queries, zero network overhead.
 */
export class DeterministicLLMProvider implements LLMExplanationProvider {
  public name = 'deterministic_v2';

  async explainInsight(request: LLMExplanationRequest): Promise<LLMExplanationResult> {
    return {
      title: request.deterministicTitle,
      summary: request.deterministicSummary,
      recommendation: this.getGroundedRecommendation(request),
      modelUsed: 'deterministic_engine_v2',
    };
  }

  private getGroundedRecommendation(request: LLMExplanationRequest): string {
    const { insightType, metricsSnapshot } = request;

    switch (insightType) {
      case 'SALES_TREND': {
        const trend = (metricsSnapshot.trendDirection as string) || 'FLAT';
        const topProduct = (metricsSnapshot.topProductName as string) || '';
        if (trend === 'UP') {
          return topProduct
            ? `Pertahankan momentum pertumbuhan dengan memastikan ketersediaan stok produk unggulan seperti "${topProduct}".`
            : 'Pertahankan strategi penjualan dan ketersediaan stok produk terlaris.';
        }
        if (trend === 'DOWN') {
          return 'Evaluasi strategi harga, penawaran promosi, atau jam operasional untuk mendorong kembali volume penjualan.';
        }
        return 'Pertahankan stabilitas operasional dan pantau performa produk unggulan.';
      }

      case 'INVENTORY_RISK': {
        const outOfStock = Number(metricsSnapshot.outOfStockCount || 0);
        const lowStock = Number(metricsSnapshot.lowStockCount || 0);
        if (outOfStock > 0) {
          return 'Segera buat Purchase Order untuk produk yang habis guna menghindari potensi kehilangan penjualan.';
        }
        if (lowStock > 0) {
          return 'Tinjau daftar produk dengan stok menipis dan rencanakan pemesanan ulang sebelum mencapai batas kritis.';
        }
        return 'Pertahankan jadwal stock opname berkala untuk memastikan akurasi data inventaris.';
      }

      case 'EXPENSE_SPIKE': {
        const expenseRatio = Number(metricsSnapshot.expenseRatio || 0);
        const topCategory = (metricsSnapshot.topExpenseCategoryName as string) || '';
        if (expenseRatio > 60) {
          return topCategory
            ? `Lakukan audit efisiensi pengeluaran, terutama pada pos beban "${topCategory}".`
            : 'Tinjau ulang pos-pos pengeluaran operasional terbesar untuk memperbaiki margin profit.';
        }
        return 'Pertahankan pengendalian beban operasional sesuai dengan anggaran yang telah direncanakan.';
      }

      case 'BUSINESS_SUMMARY': {
        const opProfit = Number(metricsSnapshot.operatingProfit || 0);
        if (opProfit > 0) {
          return 'Kinerja bisnis terpantau sehat. Alokasikan sebagian laba operasional untuk cadangan kas dan pengembangan stok.';
        }
        if (opProfit < 0) {
          return 'Prioritaskan peningkatan penjualan produk dengan margin tinggi dan lakukan rasionalisasi beban operasional.';
        }
        return 'Pantau terus arus kas dan perputaran persediaan secara teratur.';
      }

      default:
        return 'Pantau metrik bisnis secara berkala.';
    }
  }
}

/**
 * 2. Mock / Configurable Provider for Automated Testing
 */
export class MockLLMProvider implements LLMExplanationProvider {
  public name = 'mock_llm';
  public shouldFail = false;
  public malformedResponse = false;
  public customResult?: Partial<LLMExplanationResult>;

  async explainInsight(request: LLMExplanationRequest): Promise<LLMExplanationResult> {
    if (this.shouldFail) {
      throw new Error('LLM provider connection timed out');
    }

    if (this.malformedResponse) {
      return {
        title: '',
        summary: '',
        modelUsed: 'mock_malformed',
      };
    }

    if (this.customResult) {
      return {
        title: this.customResult.title || request.deterministicTitle,
        summary: this.customResult.summary || request.deterministicSummary,
        recommendation: this.customResult.recommendation,
        modelUsed: this.customResult.modelUsed || 'mock_llm_v1',
      };
    }

    return {
      title: `[AI AI Insight] ${request.deterministicTitle}`,
      summary: `${request.deterministicSummary} (Dianalisis secara objektif berdasarkan data transaksi aktual).`,
      recommendation: 'Rekomendasi terstruktur berdasarkan data historis.',
      modelUsed: 'mock_llm_v1',
    };
  }
}

// Global active provider singleton
let activeProvider: LLMExplanationProvider = new DeterministicLLMProvider();

export function setLLMExplanationProviderForTesting(provider: LLMExplanationProvider | null): void {
  activeProvider = provider || new DeterministicLLMProvider();
}

/**
 * Safe execution boundary: invokes the configured LLM provider but guarantees
 * fallback to deterministic output if provider fails, times out, or returns empty response.
 */
export async function generateInsightExplanation(
  request: LLMExplanationRequest,
  overrideProvider?: LLMExplanationProvider,
): Promise<LLMExplanationResult> {
  const provider = overrideProvider || activeProvider;
  const deterministicFallback = new DeterministicLLMProvider();

  try {
    const result = await provider.explainInsight(request);
    if (!result || !result.title || !result.title.trim() || !result.summary || !result.summary.trim()) {
      // Malformed or empty output from LLM: fallback cleanly
      return deterministicFallback.explainInsight(request);
    }
    return result;
  } catch {
    // LLM execution error: graceful fallback
    return deterministicFallback.explainInsight(request);
  }
}
