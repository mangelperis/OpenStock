import { auth } from '@/lib/better-auth/auth';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { getAllTrendingSentiment } from '@/lib/actions/adanos.actions';
import SentimentMoversClient from '@/components/sentiment/SentimentMoversClient';

export default async function SentimentPage() {
    const session = await auth.api.getSession({
        headers: await headers(),
    });

    if (!session) {
        redirect('/sign-in');
    }

    const hasAdanosKey = Boolean(process.env.ADANOS_API_KEY);
    const trending = hasAdanosKey ? await getAllTrendingSentiment(15) : null;

    return (
        <div className="min-h-screen bg-black text-gray-100 p-6 md:p-8">
            <div className="mb-8">
                <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-500">
                    Sentiment
                </h1>
                <p className="text-gray-500 mt-1">
                    Hottest tickers by attention and buzz across Reddit, X.com, news, and Polymarket — not price predictions.
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
            ) : (
                <SentimentMoversClient initialData={trending!} />
            )}
        </div>
    );
}
