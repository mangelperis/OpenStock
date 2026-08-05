'use client';

import { useState, useTransition } from 'react';
import {
    SOURCE_CONFIG,
    type SentimentSourceKey,
} from '@/lib/actions/adanos.helpers';
import type { TrendingBySourceResult } from '@/lib/actions/adanos.trending';
import { fetchTrendingBySourceAction } from '@/lib/actions/adanos.trending-action';
import { applyMoversView, type MoversViewMode } from '@/lib/sentiment/view-modes';
import SentimentMoversTable from '@/components/sentiment/SentimentMoversTable';
import WatchlistBuzzPanel from '@/components/sentiment/WatchlistBuzzPanel';

const SOURCE_KEYS = Object.keys(SOURCE_CONFIG) as SentimentSourceKey[];

const VIEW_MODES: { id: MoversViewMode; label: string }[] = [
    { id: 'hottest', label: 'Hottest' },
    { id: 'falling', label: 'Falling' },
];

interface SentimentMoversClientProps {
    /** Only the default source (reddit) is prefetched server-side. */
    initialSource: SentimentSourceKey;
    initialResult: TrendingBySourceResult;
    watchlistSymbols?: string[];
}

export default function SentimentMoversClient({
    initialSource,
    initialResult,
    watchlistSymbols = [],
}: SentimentMoversClientProps) {
    const [activeSource, setActiveSource] = useState<SentimentSourceKey>(initialSource);
    const [viewMode, setViewMode] = useState<MoversViewMode>('hottest');
    const [cache, setCache] = useState<Partial<Record<SentimentSourceKey, TrendingBySourceResult>>>(
        { [initialSource]: initialResult },
    );
    const [pending, startTransition] = useTransition();

    const selectSource = (source: SentimentSourceKey) => {
        setActiveSource(source);
        if (cache[source]) return;
        startTransition(async () => {
            const result = await fetchTrendingBySourceAction(source, 15);
            setCache((prev) => ({ ...prev, [source]: result }));
        });
    };

    const activeResult = cache[activeSource] ?? { items: [], error: null };
    const loadingSource = pending && !cache[activeSource];
    const viewedItems = applyMoversView(activeResult.items, viewMode);

    const emptyCopy =
        viewMode === 'falling'
            ? {
                  title: 'No falling names',
                  description: 'No falling names in this source’s current set.',
              }
            : {
                  title: loadingSource ? 'Loading movers' : 'No trending stocks',
                  description: loadingSource
                      ? 'Fetching Adanos trending for this source…'
                      : 'No trending stocks for this source right now.',
              };

    return (
        <div className="space-y-8">
            <WatchlistBuzzPanel symbols={watchlistSymbols} activeSource={activeSource} />

            <div className="space-y-6">
                <div className="flex flex-wrap gap-2 border-b border-gray-800 pb-4">
                    {SOURCE_KEYS.map((source) => {
                        const isActive = activeSource === source;
                        return (
                            <button
                                key={source}
                                type="button"
                                onClick={() => selectSource(source)}
                                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                                    isActive
                                        ? 'bg-white/10 text-white border border-white/20'
                                        : 'text-gray-400 hover:text-white hover:bg-white/5 border border-transparent'
                                }`}
                            >
                                {SOURCE_CONFIG[source].label}
                            </button>
                        );
                    })}
                </div>

                <div className="flex flex-wrap gap-2">
                    {VIEW_MODES.map((mode) => {
                        const isActive = viewMode === mode.id;
                        return (
                            <button
                                key={mode.id}
                                type="button"
                                onClick={() => setViewMode(mode.id)}
                                className={`px-3 py-1.5 rounded-md text-xs font-semibold uppercase tracking-wide transition-colors ${
                                    isActive
                                        ? 'bg-teal-500/20 text-teal-200 border border-teal-500/40'
                                        : 'text-gray-400 hover:text-white border border-white/10 hover:border-white/25'
                                }`}
                            >
                                {mode.label}
                            </button>
                        );
                    })}
                </div>

                <SentimentMoversTable
                    items={loadingSource ? [] : viewedItems}
                    error={loadingSource ? null : activeResult.error}
                    emptyTitle={emptyCopy.title}
                    emptyDescription={emptyCopy.description}
                    watchlistSymbols={watchlistSymbols}
                    activeSource={activeSource}
                    showWhy
                />
            </div>
        </div>
    );
}
