'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { SentimentSourceKey } from '@/lib/actions/adanos.helpers';
import type { TrendingBySourceResult } from '@/lib/actions/adanos.trending';
import { fetchWatchlistSentimentAction } from '@/lib/actions/adanos.watchlist-action';
import SentimentMoversTable from '@/components/sentiment/SentimentMoversTable';

interface WatchlistBuzzPanelProps {
    symbols: string[];
    activeSource: SentimentSourceKey;
}

export default function WatchlistBuzzPanel({ symbols, activeSource }: WatchlistBuzzPanelProps) {
    const [result, setResult] = useState<TrendingBySourceResult | null>(null);
    const [loadedFor, setLoadedFor] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    const cacheKey = `${activeSource}:${symbols.join(',')}`;
    const isLoaded = loadedFor === cacheKey;

    const load = async () => {
        if (symbols.length === 0 || symbols.length > 20 || loading) return;
        setLoading(true);
        try {
            const next = await fetchWatchlistSentimentAction(activeSource, symbols);
            setResult(next);
            setLoadedFor(cacheKey);
        } finally {
            setLoading(false);
        }
    };

    if (symbols.length === 0) {
        return (
            <div className="rounded-xl border border-white/10 bg-black/30 p-5">
                <h2 className="text-lg font-semibold text-white mb-1">My watchlist buzz</h2>
                <p className="text-sm text-gray-400">
                    Add symbols on your{' '}
                    <Link href="/watchlist" className="text-teal-300 hover:underline">
                        watchlist
                    </Link>{' '}
                    to see their Adanos buzz here.
                </p>
            </div>
        );
    }

    if (symbols.length > 20) {
        return (
            <div className="rounded-xl border border-white/10 bg-black/30 p-5">
                <h2 className="text-lg font-semibold text-white mb-1">My watchlist buzz</h2>
                <p className="text-sm text-gray-400">
                    Watchlist buzz is available for up to 20 symbols (you have {symbols.length}).
                    Trim the{' '}
                    <Link href="/watchlist" className="text-teal-300 hover:underline">
                        watchlist
                    </Link>{' '}
                    to load Adanos compare for this panel.
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-3">
            <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                    <h2 className="text-lg font-semibold text-white">My watchlist buzz</h2>
                    <p className="text-sm text-gray-500">
                        Opt-in load (1 Adanos compare call) for the active source — keeps quota free
                        for stock cards and Why?.
                    </p>
                </div>
                <button
                    type="button"
                    onClick={load}
                    disabled={loading}
                    className="rounded-md border border-teal-500/40 bg-teal-500/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-teal-200 hover:bg-teal-500/20 disabled:opacity-50"
                >
                    {loading ? 'Loading…' : isLoaded ? 'Refresh' : 'Load buzz'}
                </button>
            </div>
            {isLoaded ? (
                <SentimentMoversTable
                    items={result?.items ?? []}
                    error={result?.error ?? null}
                    emptyTitle="No buzz data"
                    emptyDescription="Adanos returned no rows for these watchlist symbols on this source."
                    watchlistSymbols={symbols}
                    activeSource={activeSource}
                    showWhy={false}
                />
            ) : null}
        </div>
    );
}
