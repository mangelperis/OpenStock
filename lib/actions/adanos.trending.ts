import {
    normalizeTrendingItem,
    SOURCE_CONFIG,
    type SentimentSourceKey,
    type TrendingSentimentItem,
} from './adanos.helpers';
import { FETCH_TIMEOUT_MS, getAdanosApiKey, getAdanosBaseUrl } from './adanos.shared';

/** Match stock-detail compare/stock endpoints (7-day lookback). */
const TRENDING_LOOKBACK_DAYS = 7;

export type TrendingBySourceResult = {
    items: TrendingSentimentItem[];
    error: string | null;
};

function stockDetailPath(source: SentimentSourceKey, ticker: string): string {
    return SOURCE_CONFIG[source].trendingPath.replace(
        /\/trending$/,
        `/stock/${encodeURIComponent(ticker)}`,
    );
}

async function fetchJson(
    pathWithQuery: string,
): Promise<{ ok: true; status: number; data: unknown } | { ok: false; status: number }> {
    const url = pathWithQuery.startsWith('http')
        ? pathWithQuery
        : `${getAdanosBaseUrl()}${pathWithQuery}`;
    const abortController = new AbortController();
    const timeout = setTimeout(() => abortController.abort(), FETCH_TIMEOUT_MS);
    try {
        const response = await fetch(url, {
            headers: { 'X-API-Key': getAdanosApiKey() },
            signal: abortController.signal,
            next: { revalidate: 3600 },
        });
        if (!response.ok) {
            return { ok: false, status: response.status };
        }
        return { ok: true, status: response.status, data: await response.json() };
    } finally {
        clearTimeout(timeout);
    }
}

/**
 * Adanos /trending can disagree slightly with /stock/{ticker} on buzz (esp. X),
 * even with the same days= window. Re-hydrate each row from /stock so list
 * numbers match the stock-detail sentiment cards.
 */
async function enrichWithStockDetail(
    source: SentimentSourceKey,
    item: TrendingSentimentItem,
): Promise<TrendingSentimentItem> {
    try {
        const result = await fetchJson(stockDetailPath(source, item.ticker));
        if (!result.ok) return item;
        const enriched = normalizeTrendingItem(source, result.data as Record<string, unknown>);
        return enriched ?? item;
    } catch {
        return item;
    }
}

export async function getTrendingBySource(
    source: SentimentSourceKey,
    limit: number = 15,
): Promise<TrendingBySourceResult> {
    if (!getAdanosApiKey()) {
        return { items: [], error: null };
    }

    const capped = Math.max(1, Math.min(limit, 50));

    try {
        const url = new URL(`${getAdanosBaseUrl()}${SOURCE_CONFIG[source].trendingPath}`);
        url.searchParams.set('limit', String(capped));
        // Without days=, Adanos returns a short-window trending snapshot that
        // does not match /compare or /stock/{ticker} (7-day) on the detail page.
        url.searchParams.set('days', String(TRENDING_LOOKBACK_DAYS));

        const result = await fetchJson(url.toString());
        if (!result.ok) {
            console.error(`Adanos ${source} trending failed: ${result.status}`);
            return {
                items: [],
                error: `Failed to load trending data (${result.status})`,
            };
        }

        const rows = Array.isArray(result.data) ? result.data : [];
        const ranked = rows
            .map((row) => normalizeTrendingItem(source, row))
            .filter((item): item is TrendingSentimentItem => Boolean(item))
            .sort((a, b) => b.buzzScore - a.buzzScore)
            .slice(0, capped);

        const items = (
            await Promise.all(ranked.map((item) => enrichWithStockDetail(source, item)))
        ).sort((a, b) => b.buzzScore - a.buzzScore);

        return { items, error: null };
    } catch (error) {
        console.error(`Adanos ${source} trending request failed`, error);
        return {
            items: [],
            error: 'Failed to load trending data',
        };
    }
}

export async function getAllTrendingSentiment(
    limit: number = 15,
): Promise<Record<SentimentSourceKey, TrendingBySourceResult>> {
    const sourceKeys = Object.keys(SOURCE_CONFIG) as SentimentSourceKey[];
    const results = await Promise.all(
        sourceKeys.map(async (source) => [source, await getTrendingBySource(source, limit)] as const),
    );
    return Object.fromEntries(results) as Record<SentimentSourceKey, TrendingBySourceResult>;
}
