import type { AIInsight } from '@padupos/types';
import type { DateRangeQuery } from '../../lib/dateRange.js';
import { DeterministicInsightEngine } from '../ml/insightEngine.js';

export class AIInsightService {
  static async generateInsight(
    businessId: string,
    insightType: AIInsight['insightType'],
    branchId?: string | null,
    query?: DateRangeQuery,
  ): Promise<AIInsight> {
    return DeterministicInsightEngine.generateInsight(businessId, branchId ?? null, insightType, query);
  }

  static async getInsights(
    businessId: string,
    branchId?: string | null,
    query?: DateRangeQuery & { insightType?: AIInsight['insightType'] },
  ) {
    return DeterministicInsightEngine.getInsights(businessId, branchId ?? null, query);
  }
}

