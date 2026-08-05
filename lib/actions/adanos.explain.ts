import { SOURCE_CONFIG, type SentimentSourceKey } from './adanos.helpers';
import { FETCH_TIMEOUT_MS, getAdanosApiKey, getAdanosBaseUrl } from './adanos.shared';

export type SentimentExplainResult =
    | {
          explanation: string;
          model: string | null;
          generatedAt: string | null;
          cached: boolean | null;
      }
    | { error: string };

function explainPath(source: SentimentSourceKey, ticker: string): string {
    return SOURCE_CONFIG[source].trendingPath.replace(
        /\/trending$/,
        `/stock/${encodeURIComponent(ticker.trim().toUpperCase())}/explain`,
    );
}

export async function getSentimentExplain(
    source: SentimentSourceKey,
    ticker: string,
): Promise<SentimentExplainResult> {
    const symbol = ticker.trim().toUpperCase();
    if (!getAdanosApiKey()) {
        return { error: 'Adanos API key is not configured' };
    }
    if (!symbol) {
        return { error: 'Ticker is required' };
    }

    try {
        const abortController = new AbortController();
        const timeout = setTimeout(() => abortController.abort(), FETCH_TIMEOUT_MS);
        try {
            const response = await fetch(`${getAdanosBaseUrl()}${explainPath(source, symbol)}`, {
                headers: { 'X-API-Key': getAdanosApiKey() },
                signal: abortController.signal,
                next: { revalidate: 3600 },
            });

            if (!response.ok) {
                if (response.status === 429) {
                    return {
                        error:
                            'Adanos rate limit (429). Wait a minute, then try Why? again — avoid switching tabs or loading watchlist buzz at the same time.',
                    };
                }
                return { error: `Failed to load explanation (${response.status})` };
            }

            const data = (await response.json()) as {
                explanation?: unknown;
                model?: unknown;
                generated_at?: unknown;
                cached?: unknown;
            };

            if (typeof data.explanation !== 'string' || !data.explanation.trim()) {
                return { error: 'No explanation available' };
            }

            return {
                explanation: data.explanation.trim(),
                model: typeof data.model === 'string' ? data.model : null,
                generatedAt: typeof data.generated_at === 'string' ? data.generated_at : null,
                cached: typeof data.cached === 'boolean' ? data.cached : null,
            };
        } finally {
            clearTimeout(timeout);
        }
    } catch (error) {
        console.error(`Adanos ${source} explain failed for ${symbol}`, error);
        return { error: 'Failed to load explanation' };
    }
}
