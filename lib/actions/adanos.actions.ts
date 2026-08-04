'use server';

import {
    buildStockSentimentInsights,
    normalizeSourceInsight,
    normalizeTrendingItem,
    SOURCE_CONFIG,
    type SentimentSourceInsight,
    type SentimentSourceKey,
    type SourceComparePayload,
    type StockSentimentInsights,
    type TrendingSentimentItem,
} from './adanos.helpers';

const DEFAULT_LOOKBACK_DAYS = 7;
const FETCH_TIMEOUT_MS = 5000;

function getAdanosBaseUrl(): string {
    return (process.env.ADANOS_API_BASE_URL || 'https://api.adanos.org').replace(/\/$/, '');
}

function getAdanosApiKey(): string {
    return process.env.ADANOS_API_KEY ?? '';
}

async function fetchCompareSource(
    source: SentimentSourceKey,
    symbol: string,
    days: number,
): Promise<SentimentSourceInsight | null> {
    try {
        const url = new URL(`${getAdanosBaseUrl()}${SOURCE_CONFIG[source].path}`);
        url.searchParams.set('tickers', symbol.toUpperCase());
        url.searchParams.set('days', String(days));

        const abortController = new AbortController();
        const timeout = setTimeout(() => abortController.abort(), FETCH_TIMEOUT_MS);
        let response: Response;
        try {
            response = await fetch(url.toString(), {
                headers: {
                    'X-API-Key': getAdanosApiKey(),
                },
                signal: abortController.signal,
                next: { revalidate: 300 },
            });
        } finally {
            clearTimeout(timeout);
        }

        if (response.status === 404) {
            return null;
        }

        if (!response.ok) {
            console.error(`Adanos ${source} compare failed for ${symbol}: ${response.status}`);
            return null;
        }

        const payload = (await response.json()) as SourceComparePayload;
        const row = payload.stocks?.find((item) => item.ticker?.toUpperCase() === symbol.toUpperCase());

        return normalizeSourceInsight(source, row);
    } catch (error) {
        console.error(`Adanos ${source} compare request failed for ${symbol}`, error);
        return null;
    }
}

export async function getStockSentimentInsights(
    symbol: string,
    days: number = DEFAULT_LOOKBACK_DAYS,
): Promise<StockSentimentInsights | null> {
    if (!getAdanosApiKey() || !symbol?.trim()) {
        return null;
    }

    const normalizedSymbol = symbol.trim().toUpperCase();
    const lookbackDays = Math.max(1, Math.min(days, 30));
    const sourceKeys = Object.keys(SOURCE_CONFIG) as SentimentSourceKey[];

    const sources = await Promise.all(
        sourceKeys.map((source) => fetchCompareSource(source, normalizedSymbol, lookbackDays)),
    );

    return buildStockSentimentInsights(normalizedSymbol, sources);
}

export async function getTrendingBySource(
    source: SentimentSourceKey,
    limit: number = 15,
): Promise<TrendingSentimentItem[]> {
    if (!getAdanosApiKey()) return [];
    const capped = Math.max(1, Math.min(limit, 50));
    try {
        const url = new URL(`${getAdanosBaseUrl()}${SOURCE_CONFIG[source].trendingPath}`);
        url.searchParams.set('limit', String(capped));
        const abortController = new AbortController();
        const timeout = setTimeout(() => abortController.abort(), FETCH_TIMEOUT_MS);
        let response: Response;
        try {
            response = await fetch(url.toString(), {
                headers: { 'X-API-Key': getAdanosApiKey() },
                signal: abortController.signal,
                next: { revalidate: 300 },
            });
        } finally {
            clearTimeout(timeout);
        }
        if (!response.ok) {
            console.error(`Adanos ${source} trending failed: ${response.status}`);
            return [];
        }
        const payload = await response.json();
        const rows = Array.isArray(payload) ? payload : [];
        return rows
            .map((row) => normalizeTrendingItem(source, row))
            .filter((item): item is TrendingSentimentItem => Boolean(item))
            .slice(0, capped);
    } catch (error) {
        console.error(`Adanos ${source} trending request failed`, error);
        return [];
    }
}

export async function getAllTrendingSentiment(
    limit: number = 15,
): Promise<Record<SentimentSourceKey, TrendingSentimentItem[]>> {
    const sourceKeys = Object.keys(SOURCE_CONFIG) as SentimentSourceKey[];
    const results = await Promise.all(
        sourceKeys.map(async (source) => [source, await getTrendingBySource(source, limit)] as const),
    );
    return Object.fromEntries(results) as Record<SentimentSourceKey, TrendingSentimentItem[]>;
}
