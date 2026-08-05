'use server';

import type { SentimentSourceKey } from './adanos.helpers';
import { getTrendingBySource, type TrendingBySourceResult } from './adanos.trending';

export async function fetchTrendingBySourceAction(
    source: SentimentSourceKey,
    limit: number = 15,
): Promise<TrendingBySourceResult> {
    return getTrendingBySource(source, limit);
}
