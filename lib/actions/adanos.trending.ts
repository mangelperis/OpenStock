import {
    normalizeTrendingItem,
    SOURCE_CONFIG,
    type SentimentSourceKey,
    type TrendingSentimentItem,
} from './adanos.helpers';
import { FETCH_TIMEOUT_MS, getAdanosApiKey, getAdanosBaseUrl } from './adanos.shared';

/** Match stock-detail compare lookback (7-day). */
const TRENDING_LOOKBACK_DAYS = 7;

export type TrendingBySourceResult = {
    items: TrendingSentimentItem[];
    error: string | null;
};

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
        // does not match /compare (7-day) on the stock detail page.
        url.searchParams.set('days', String(TRENDING_LOOKBACK_DAYS));

        const result = await fetchJson(url.toString());
        if (!result.ok) {
            console.error(`Adanos ${source} trending failed: ${result.status}`);
            return {
                items: [],
                error:
                    result.status === 429
                        ? 'Adanos rate limit hit — try again later'
                        : `Failed to load trending data (${result.status})`,
            };
        }

        const rows = Array.isArray(result.data) ? result.data : [];
        const items = rows
            .map((row) => normalizeTrendingItem(source, row))
            .filter((item): item is TrendingSentimentItem => Boolean(item))
            .sort((a, b) => b.buzzScore - a.buzzScore)
            .slice(0, capped);

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
