'use client';

import { Fragment, useState, useTransition } from 'react';
import Link from 'next/link';
import type { SentimentSourceKey, TrendingSentimentItem } from '@/lib/actions/adanos.helpers';
import { fetchSentimentExplainAction } from '@/lib/actions/adanos.explain-action';

interface SentimentMoversTableProps {
    items: TrendingSentimentItem[];
    error?: string | null;
    emptyTitle?: string;
    emptyDescription?: string;
    watchlistSymbols?: string[];
    activeSource: SentimentSourceKey;
    showWhy?: boolean;
}

function formatScore(value: number | null, suffix: string): string {
    if (value === null) return 'N/A';
    return `${value.toFixed(1)}${suffix}`;
}

function formatCompactNumber(value: number | null): string {
    if (value === null) return 'N/A';
    return new Intl.NumberFormat('en-US', {
        notation: 'compact',
        maximumFractionDigits: 1,
    }).format(value);
}

function getTrendClasses(trend: string | null): string {
    if (trend === 'rising') return 'text-emerald-400';
    if (trend === 'falling') return 'text-rose-400';
    if (trend === 'stable') return 'text-amber-300';
    return 'text-gray-400';
}

export default function SentimentMoversTable({
    items,
    error,
    emptyTitle = 'No trending stocks',
    emptyDescription = 'No trending stocks for this source right now.',
    watchlistSymbols = [],
    activeSource,
    showWhy = true,
}: SentimentMoversTableProps) {
    const watchlistSet = new Set(watchlistSymbols.map((s) => s.toUpperCase()));
    const [expandedTicker, setExpandedTicker] = useState<string | null>(null);
    const [explainText, setExplainText] = useState<Record<string, string>>({});
    const [explainError, setExplainError] = useState<Record<string, string>>({});
    const [pending, startTransition] = useTransition();

    const loadExplain = (ticker: string) => {
        const key = `${activeSource}:${ticker}`;
        if (explainText[key]) {
            setExpandedTicker((current) => (current === ticker ? null : ticker));
            return;
        }
        setExpandedTicker(ticker);
        setExplainError((prev) => {
            if (!prev[key]) return prev;
            const next = { ...prev };
            delete next[key];
            return next;
        });
        startTransition(async () => {
            const result = await fetchSentimentExplainAction(activeSource, ticker);
            if ('error' in result) {
                setExplainError((prev) => ({ ...prev, [key]: result.error }));
            } else {
                setExplainText((prev) => ({ ...prev, [key]: result.explanation }));
            }
        });
    };

    if (error) {
        return (
            <div className="text-center py-12 bg-gray-900/50 rounded-lg border border-rose-500/30">
                <h3 className="text-xl font-medium text-rose-300 mb-2">Could not load trending data</h3>
                <p className="text-gray-400">{error}</p>
            </div>
        );
    }

    if (items.length === 0) {
        return (
            <div className="text-center py-12 bg-gray-900/50 rounded-lg border border-gray-800">
                <h3 className="text-xl font-medium text-gray-300 mb-2">{emptyTitle}</h3>
                <p className="text-gray-500">{emptyDescription}</p>
            </div>
        );
    }

    const metricLabel = items[0]?.metricLabel ?? 'Metric';

    return (
        <div className="overflow-hidden rounded-xl border border-white/10 bg-black/40 backdrop-blur-md shadow-xl">
            <table className="w-full text-left text-sm border-collapse">
                <thead className="bg-white/5 text-gray-400 font-medium border-b border-white/10">
                    <tr>
                        <th className="px-6 py-4 font-semibold tracking-wide w-16">#</th>
                        <th className="px-6 py-4 font-semibold tracking-wide">Ticker</th>
                        <th className="px-6 py-4 font-semibold tracking-wide">Company</th>
                        <th className="px-6 py-4 font-semibold tracking-wide">Buzz</th>
                        <th className="px-6 py-4 font-semibold tracking-wide">Bullish</th>
                        <th className="px-6 py-4 font-semibold tracking-wide">Trend</th>
                        <th className="px-6 py-4 font-semibold tracking-wide">{metricLabel}</th>
                        {showWhy ? (
                            <th className="px-6 py-4 font-semibold tracking-wide w-24">Why</th>
                        ) : null}
                    </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                    {items.map((item, index) => {
                        const key = `${activeSource}:${item.ticker}`;
                        const isOpen = expandedTicker === item.ticker;
                        const onWatchlist = watchlistSet.has(item.ticker);
                        return (
                            <Fragment key={`${item.ticker}-${index}`}>
                                <tr className="hover:bg-white/5 transition-colors">
                                    <td className="px-6 py-4 text-gray-500 font-medium">{index + 1}</td>
                                    <td className="px-6 py-4">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <Link
                                                href={`/stocks/${encodeURIComponent(item.ticker)}`}
                                                className="bg-white/5 px-2.5 py-1 rounded-md text-xs font-mono border border-white/10 hover:border-white/30 hover:text-white text-gray-300 transition-colors"
                                            >
                                                {item.ticker}
                                            </Link>
                                            {onWatchlist ? (
                                                <span className="rounded-md border border-teal-500/40 bg-teal-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-teal-300">
                                                    Watchlist
                                                </span>
                                            ) : null}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-white font-medium">
                                        {item.companyName ?? '—'}
                                    </td>
                                    <td className="px-6 py-4 text-white font-medium">
                                        {formatScore(item.buzzScore, '/100')}
                                    </td>
                                    <td className="px-6 py-4 text-white font-medium">
                                        {formatScore(item.bullishPct, '%')}
                                    </td>
                                    <td
                                        className={`px-6 py-4 font-medium capitalize ${getTrendClasses(item.trend)}`}
                                    >
                                        {item.trend ?? 'N/A'}
                                    </td>
                                    <td className="px-6 py-4 text-gray-300 font-medium">
                                        {formatCompactNumber(item.metricValue)}
                                    </td>
                                    {showWhy ? (
                                        <td className="px-6 py-4">
                                            <button
                                                type="button"
                                                onClick={() => loadExplain(item.ticker)}
                                                className="rounded-md border border-white/15 bg-white/5 px-2.5 py-1 text-xs font-medium text-gray-300 hover:border-white/30 hover:text-white transition-colors"
                                            >
                                                {isOpen && pending ? '…' : 'Why?'}
                                            </button>
                                        </td>
                                    ) : null}
                                </tr>
                                {showWhy && isOpen ? (
                                    <tr className="bg-white/[0.03]">
                                        <td
                                            colSpan={8}
                                            className="px-6 py-4 text-sm text-gray-300 leading-relaxed"
                                        >
                                            {explainText[key] ??
                                                explainError[key] ??
                                                (pending ? 'Loading explanation…' : null)}
                                        </td>
                                    </tr>
                                ) : null}
                            </Fragment>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}
