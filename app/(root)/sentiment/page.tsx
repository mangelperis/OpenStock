import { auth } from '@/lib/better-auth/auth';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { getTrendingBySource } from '@/lib/actions/adanos.trending';
import { getUserWatchlist } from '@/lib/actions/watchlist.actions';
import SentimentMoversClient from '@/components/sentiment/SentimentMoversClient';

const DEFAULT_SOURCE = 'reddit' as const;

export default async function SentimentPage() {
    const session = await auth.api.getSession({
        headers: await headers(),
    });

    if (!session) {
        redirect('/sign-in');
    }

    const hasAdanosKey = Boolean(process.env.ADANOS_API_KEY);
    const watchlist = await getUserWatchlist(session.user.id);
    const watchlistSymbols = (Array.isArray(watchlist) ? watchlist : [])
        .map((row: { symbol?: string }) => (typeof row.symbol === 'string' ? row.symbol : ''))
        .filter(Boolean)
        .map((s: string) => s.toUpperCase());

    const trending = hasAdanosKey ? await getTrendingBySource(DEFAULT_SOURCE, 15) : null;

    return (
        <div className="min-h-screen bg-black text-gray-100 p-6 md:p-8">
            <div className="mb-8">
                <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-500">
                    Sentiment
                </h1>
                <p className="text-gray-500 mt-1">
                    Hottest movers by Adanos buzz (7-day), plus a Falling filter. One source loads
                    at a time to stay under rate limits — Why? and watchlist buzz are on-demand.
                </p>
            </div>

            {!hasAdanosKey ? (
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-6 text-amber-200">
                    <h2 className="text-lg font-semibold text-amber-100 mb-2">Adanos API key required</h2>
                    <p className="text-sm text-amber-200/90">
                        Set <code className="rounded bg-black/30 px-1.5 py-0.5 font-mono text-xs">ADANOS_API_KEY</code> in
                        your environment to load sentiment trending data.
                    </p>
                </div>
            ) : trending ? (
                <SentimentMoversClient
                    initialSource={DEFAULT_SOURCE}
                    initialResult={trending}
                    watchlistSymbols={watchlistSymbols}
                />
            ) : null}
        </div>
    );
}
