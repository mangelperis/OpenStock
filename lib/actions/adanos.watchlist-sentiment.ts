import {
    normalizeTrendingItem,
    SOURCE_CONFIG,
    type SentimentSourceKey,
    type TrendingSentimentItem,
} from './adanos.helpers';
import { FETCH_TIMEOUT_MS, getAdanosApiKey, getAdanosBaseUrl } from './adanos.shared';
import type { TrendingBySourceResult } from './adanos.trending';

const LOOKBACK_DAYS = 7;
const MAX_WATCHLIST_SYMBOLS = 20;

function normalizeSymbols(symbols: string[]): string[] {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const raw of symbols) {
        const ticker = raw.trim().toUpperCase();
        if (!ticker || seen.has(ticker)) continue;
        seen.add(ticker);
        out.push(ticker);
        if (out.length >= MAX_WATCHLIST_SYMBOLS) break;
    }
    return out;
}

export async function getWatchlistSentimentBySource(
    source: SentimentSourceKey,
    symbols: string[],
    days: number = LOOKBACK_DAYS,
): Promise<TrendingBySourceResult> {
    const tickers = normalizeSymbols(symbols);
    if (!getAdanosApiKey() || tickers.length === 0) {
        return { items: [], error: null };
    }

    try {
        const url = new URL(`${getAdanosBaseUrl()}${SOURCE_CONFIG[source].path}`);
        url.searchParams.set('tickers', tickers.join(','));
        url.searchParams.set('days', String(days));

        const abortController = new AbortController();
        const timeout = setTimeout(() => abortController.abort(), FETCH_TIMEOUT_MS);
        try {
            const response = await fetch(url.toString(), {
                headers: { 'X-API-Key': getAdanosApiKey() },
                signal: abortController.signal,
                next: { revalidate: 3600 },
            });

            if (!response.ok) {
                console.error(`Adanos ${source} watchlist compare failed: ${response.status}`);
                return {
                    items: [],
                    error: `Failed to load watchlist sentiment (${response.status})`,
                };
            }

            const data = (await response.json()) as { stocks?: unknown[] };
            const rows = Array.isArray(data.stocks) ? data.stocks : [];
            const items = rows
                .map((row) => normalizeTrendingItem(source, row as Record<string, unknown>))
                .filter((item): item is TrendingSentimentItem => Boolean(item))
                .sort((a, b) => b.buzzScore - a.buzzScore);

            return { items, error: null };
        } finally {
            clearTimeout(timeout);
        }
    } catch (error) {
        console.error(`Adanos ${source} watchlist compare request failed`, error);
        return {
            items: [],
            error: 'Failed to load watchlist sentiment',
        };
    }
}

export async function getAllWatchlistSentiment(
    symbols: string[],
    days: number = LOOKBACK_DAYS,
): Promise<Record<SentimentSourceKey, TrendingBySourceResult>> {
    const sourceKeys = Object.keys(SOURCE_CONFIG) as SentimentSourceKey[];
    const results = await Promise.all(
        sourceKeys.map(
            async (source) =>
                [source, await getWatchlistSentimentBySource(source, symbols, days)] as const,
        ),
    );
    return Object.fromEntries(results) as Record<SentimentSourceKey, TrendingBySourceResult>;
}
