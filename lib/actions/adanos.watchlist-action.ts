'use server';

import type { SentimentSourceKey } from './adanos.helpers';
import { getWatchlistSentimentBySource } from './adanos.watchlist-sentiment';
import type { TrendingBySourceResult } from './adanos.trending';

export async function fetchWatchlistSentimentAction(
    source: SentimentSourceKey,
    symbols: string[],
): Promise<TrendingBySourceResult> {
    return getWatchlistSentimentBySource(source, symbols);
}
