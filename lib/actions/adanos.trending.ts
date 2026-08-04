import {
    normalizeTrendingItem,
    SOURCE_CONFIG,
    type SentimentSourceKey,
    type TrendingSentimentItem,
} from './adanos.helpers';
import { FETCH_TIMEOUT_MS, getAdanosApiKey, getAdanosBaseUrl } from './adanos.shared';

export type TrendingBySourceResult = {
    items: TrendingSentimentItem[];
    error: string | null;
};

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
        const abortController = new AbortController();
        const timeout = setTimeout(() => abortController.abort(), FETCH_TIMEOUT_MS);
        let response: Response;
        try {
            response = await fetch(url.toString(), {
                headers: { 'X-API-Key': getAdanosApiKey() },
                signal: abortController.signal,
                next: { revalidate: 3600 },
            });
        } finally {
            clearTimeout(timeout);
        }

        if (!response.ok) {
            console.error(`Adanos ${source} trending failed: ${response.status}`);
            return {
                items: [],
                error: `Failed to load trending data (${response.status})`,
            };
        }

        const payload = await response.json();
        const rows = Array.isArray(payload) ? payload : [];
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
