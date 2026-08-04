import Link from 'next/link';
import type { TrendingSentimentItem } from '@/lib/actions/adanos.helpers';

interface SentimentMoversTableProps {
    items: TrendingSentimentItem[];
    error?: string | null;
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

export default function SentimentMoversTable({ items, error }: SentimentMoversTableProps) {
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
                <h3 className="text-xl font-medium text-gray-300 mb-2">No trending stocks</h3>
                <p className="text-gray-500">No trending stocks for this source right now.</p>
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
                    </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                    {items.map((item, index) => (
                        <tr key={`${item.ticker}-${index}`} className="hover:bg-white/5 transition-colors">
                            <td className="px-6 py-4 text-gray-500 font-medium">{index + 1}</td>
                            <td className="px-6 py-4">
                                <Link
                                    href={`/stocks/${encodeURIComponent(item.ticker)}`}
                                    className="bg-white/5 px-2.5 py-1 rounded-md text-xs font-mono border border-white/10 hover:border-white/30 hover:text-white text-gray-300 transition-colors"
                                >
                                    {item.ticker}
                                </Link>
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
                            <td className={`px-6 py-4 font-medium capitalize ${getTrendClasses(item.trend)}`}>
                                {item.trend ?? 'N/A'}
                            </td>
                            <td className="px-6 py-4 text-gray-300 font-medium">
                                {formatCompactNumber(item.metricValue)}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
