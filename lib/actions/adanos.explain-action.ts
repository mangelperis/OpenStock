'use server';

import type { SentimentSourceKey } from './adanos.helpers';
import { getSentimentExplain, type SentimentExplainResult } from './adanos.explain';

export async function fetchSentimentExplainAction(
    source: SentimentSourceKey,
    ticker: string,
): Promise<SentimentExplainResult> {
    return getSentimentExplain(source, ticker);
}
