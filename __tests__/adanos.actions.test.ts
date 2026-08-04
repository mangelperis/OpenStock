import { afterEach, describe, expect, it, vi } from 'vitest';

import { getStockSentimentInsights } from '@/lib/actions/adanos.actions';
import { getAllTrendingSentiment, getTrendingBySource } from '@/lib/actions/adanos.trending';
import {
    buildStockSentimentInsights,
    getSourceAlignment,
    normalizeSourceInsight,
    normalizeTrendingItem,
} from '@/lib/actions/adanos.helpers';

afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    delete process.env.ADANOS_API_KEY;
    delete process.env.ADANOS_API_BASE_URL;
});

describe('normalizeSourceInsight', () => {
    it('maps source-specific metrics for mentions and trades', () => {
        const reddit = normalizeSourceInsight('reddit', {
            ticker: 'TSLA',
            buzz_score: 81.2,
            bullish_pct: 46,
            trend: 'rising',
            mentions: 647,
        });

        const polymarket = normalizeSourceInsight('polymarket', {
            ticker: 'TSLA',
            buzz_score: 55.7,
            bullish_pct: 72,
            trend: 'stable',
            trade_count: 3731,
        });

        expect(reddit).toMatchObject({
            label: 'Reddit',
            companyName: null,
            metricLabel: 'Mentions',
            metricValue: 647,
            buzzScore: 81.2,
            bullishPct: 46,
        });
        expect(polymarket).toMatchObject({
            label: 'Polymarket',
            companyName: null,
            metricLabel: 'Trades',
            metricValue: 3731,
            buzzScore: 55.7,
            bullishPct: 72,
        });
    });

    it('returns null when required values are missing', () => {
        expect(
            normalizeSourceInsight('x', {
                ticker: 'NVDA',
                bullish_pct: 54,
                mentions: 1200,
            }),
        ).toBeNull();

        expect(
            normalizeSourceInsight('news', {
                ticker: 'NVDA',
                buzz_score: 60,
                bullish_pct: 54,
            }),
        ).toBeNull();
    });
});

describe('normalizeTrendingItem', () => {
    it('maps a reddit trending row', () => {
        expect(
            normalizeTrendingItem('reddit', {
                ticker: 'AMZN',
                company_name: 'Amazon.com Inc',
                buzz_score: 75,
                bullish_pct: 31,
                trend: 'rising',
                mentions: 134,
            }),
        ).toEqual({
            source: 'reddit',
            label: 'Reddit',
            ticker: 'AMZN',
            companyName: 'Amazon.com Inc',
            buzzScore: 75,
            bullishPct: 31,
            trend: 'rising',
            metricLabel: 'Mentions',
            metricValue: 134,
        });
    });

    it('maps polymarket trade_count', () => {
        expect(
            normalizeTrendingItem('polymarket', {
                ticker: 'PLTR',
                company_name: 'Palantir',
                buzz_score: 70.5,
                bullish_pct: 93,
                trend: 'rising',
                trade_count: 87,
            })?.metricValue,
        ).toBe(87);
    });

    it('returns null without ticker or buzz_score', () => {
        expect(normalizeTrendingItem('x', { mentions: 10 })).toBeNull();
        expect(normalizeTrendingItem('x', { ticker: 'MU', mentions: 10 })).toBeNull();
    });
});

describe('getSourceAlignment', () => {
    it('classifies wide divergence when sources materially disagree', () => {
        expect(getSourceAlignment([31, 56, 48, 30])).toBe('Wide divergence');
    });

    it('classifies bullish alignment when sources are tightly aligned and positive', () => {
        expect(getSourceAlignment([61, 64, 67])).toBe('Bullish alignment');
    });
});

describe('buildStockSentimentInsights', () => {
    it('builds a compact aggregate summary from available sources', () => {
        const insight = buildStockSentimentInsights('TSLA', [
            {
                source: 'reddit',
                label: 'Reddit',
                companyName: 'Tesla, Inc.',
                buzzScore: 74.1,
                bullishPct: 31,
                trend: 'rising',
                metricLabel: 'Mentions',
                metricValue: 647,
            },
            {
                source: 'x',
                label: 'X.com',
                companyName: 'Tesla, Inc.',
                buzzScore: 86.1,
                bullishPct: 56,
                trend: 'falling',
                metricLabel: 'Mentions',
                metricValue: 2650,
            },
            {
                source: 'polymarket',
                label: 'Polymarket',
                companyName: 'Tesla, Inc.',
                buzzScore: 83.3,
                bullishPct: 30,
                trend: 'falling',
                metricLabel: 'Trades',
                metricValue: 3731,
            },
            null,
        ]);

        expect(insight).toMatchObject({
            symbol: 'TSLA',
            companyName: 'Tesla, Inc.',
            averageBuzz: 81.2,
            bullishAverage: 39,
            sourceAlignment: 'Wide divergence',
            availableSources: 3,
        });
        expect(insight?.sources).toHaveLength(3);
    });

    it('returns null when no sources have usable data', () => {
        expect(buildStockSentimentInsights('MSFT', [null, null])).toBeNull();
    });
});

describe('getStockSentimentInsights', () => {
    it('returns a parsed result when compare data matches the requested ticker', async () => {
        process.env.ADANOS_API_KEY = 'test-key';
        vi.spyOn(global, 'fetch').mockImplementation(async (input) => {
            const url = String(input);

            if (url.includes('/reddit/')) {
                return new Response(
                    JSON.stringify({
                        stocks: [{ ticker: 'TSLA', company_name: 'Tesla, Inc.', buzz_score: 80, bullish_pct: 40, trend: 'rising', mentions: 10 }],
                    }),
                    { status: 200 },
                );
            }

            if (url.includes('/x/')) {
                return new Response(
                    JSON.stringify({
                        stocks: [{ ticker: 'TSLA', company_name: 'Tesla, Inc.', buzz_score: 90, bullish_pct: 60, trend: 'falling', mentions: 20 }],
                    }),
                    { status: 200 },
                );
            }

            return new Response(JSON.stringify({ stocks: [] }), { status: 404 });
        });

        const insight = await getStockSentimentInsights('TSLA');

        expect(insight).toMatchObject({
            symbol: 'TSLA',
            companyName: 'Tesla, Inc.',
            averageBuzz: 85,
            bullishAverage: 50,
            availableSources: 2,
        });
        expect(insight?.sources).toHaveLength(2);
    });

    it('returns null when the remote source returns 404 for all sources', async () => {
        process.env.ADANOS_API_KEY = 'test-key';
        vi.spyOn(global, 'fetch').mockResolvedValue(new Response(null, { status: 404 }));

        await expect(getStockSentimentInsights('TSLA')).resolves.toBeNull();
    });

    it('returns null when the remote payload contains a different ticker only', async () => {
        process.env.ADANOS_API_KEY = 'test-key';
        vi.spyOn(global, 'fetch').mockResolvedValue(
            new Response(
                JSON.stringify({
                    stocks: [{ ticker: 'MSFT', company_name: 'Microsoft Corporation', buzz_score: 70, bullish_pct: 55, trend: 'stable', mentions: 30 }],
                }),
                { status: 200 },
            ),
        );

        await expect(getStockSentimentInsights('TSLA')).resolves.toBeNull();
    });

    it('returns null when the response body is invalid json', async () => {
        process.env.ADANOS_API_KEY = 'test-key';
        vi.spyOn(global, 'fetch').mockResolvedValue({
            status: 200,
            ok: true,
            json: vi.fn().mockRejectedValue(new Error('invalid json')),
        } as unknown as Response);

        await expect(getStockSentimentInsights('TSLA')).resolves.toBeNull();
    });

    it('returns null when fetch fails', async () => {
        process.env.ADANOS_API_KEY = 'test-key';
        vi.spyOn(global, 'fetch').mockRejectedValue(new Error('network failed'));

        await expect(getStockSentimentInsights('TSLA')).resolves.toBeNull();
    });
});

describe('getTrendingBySource', () => {
    it('returns empty items when API key missing', async () => {
        await expect(getTrendingBySource('reddit')).resolves.toEqual({ items: [], error: null });
    });

    it('normalizes array payload from trending endpoint', async () => {
        process.env.ADANOS_API_KEY = 'test-key';
        vi.stubGlobal(
            'fetch',
            vi.fn().mockResolvedValue({
                ok: true,
                status: 200,
                json: async () => [
                    {
                        ticker: 'AMZN',
                        company_name: 'Amazon.com Inc',
                        buzz_score: 75,
                        bullish_pct: 31,
                        trend: 'rising',
                        mentions: 134,
                    },
                ],
            }),
        );
        const result = await getTrendingBySource('reddit', 15);
        expect(result.error).toBeNull();
        expect(result.items).toHaveLength(1);
        expect(result.items[0].ticker).toBe('AMZN');
        expect(fetch).toHaveBeenCalledWith(
            expect.stringContaining('/reddit/stocks/v1/trending'),
            expect.objectContaining({
                headers: expect.objectContaining({ 'X-API-Key': 'test-key' }),
                next: { revalidate: 3600 },
            }),
        );
    });

    it('sorts by buzzScore descending before slicing', async () => {
        process.env.ADANOS_API_KEY = 'test-key';
        vi.stubGlobal(
            'fetch',
            vi.fn().mockResolvedValue({
                ok: true,
                status: 200,
                json: async () => [
                    { ticker: 'LOW', buzz_score: 40, bullish_pct: 50, trend: 'stable', mentions: 10 },
                    { ticker: 'HIGH', buzz_score: 90, bullish_pct: 50, trend: 'rising', mentions: 20 },
                    { ticker: 'MID', buzz_score: 60, bullish_pct: 50, trend: 'falling', mentions: 15 },
                ],
            }),
        );
        const result = await getTrendingBySource('reddit', 15);
        expect(result.items.map((item) => item.ticker)).toEqual(['HIGH', 'MID', 'LOW']);
    });

    it('returns error on HTTP failure', async () => {
        process.env.ADANOS_API_KEY = 'test-key';
        vi.stubGlobal(
            'fetch',
            vi.fn().mockResolvedValue({
                ok: false,
                status: 503,
                json: async () => ({}),
            }),
        );
        const result = await getTrendingBySource('reddit');
        expect(result.items).toEqual([]);
        expect(result.error).toBe('Failed to load trending data (503)');
    });

    it('returns error on fetch exception', async () => {
        process.env.ADANOS_API_KEY = 'test-key';
        vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network failed')));
        const result = await getTrendingBySource('reddit');
        expect(result.items).toEqual([]);
        expect(result.error).toBe('Failed to load trending data');
    });
});

describe('getAllTrendingSentiment', () => {
    it('returns all four keys with items and error fields', async () => {
        process.env.ADANOS_API_KEY = 'test-key';
        vi.stubGlobal(
            'fetch',
            vi.fn().mockResolvedValue({
                ok: true,
                status: 200,
                json: async () => [],
            }),
        );
        const all = await getAllTrendingSentiment(15);
        expect(Object.keys(all).sort()).toEqual(['news', 'polymarket', 'reddit', 'x']);
        for (const source of Object.keys(all)) {
            expect(all[source as keyof typeof all]).toEqual({ items: [], error: null });
        }
    });
});
