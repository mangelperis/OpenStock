'use client';

import { useState } from 'react';
import {
    SOURCE_CONFIG,
    type SentimentSourceKey,
    type TrendingSentimentItem,
} from '@/lib/actions/adanos.helpers';
import SentimentMoversTable from '@/components/sentiment/SentimentMoversTable';

const SOURCE_KEYS = Object.keys(SOURCE_CONFIG) as SentimentSourceKey[];

interface SentimentMoversClientProps {
    initialData: Record<SentimentSourceKey, TrendingSentimentItem[]>;
}

export default function SentimentMoversClient({ initialData }: SentimentMoversClientProps) {
    const [activeSource, setActiveSource] = useState<SentimentSourceKey>('reddit');

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap gap-2 border-b border-gray-800 pb-4">
                {SOURCE_KEYS.map((source) => {
                    const isActive = activeSource === source;
                    return (
                        <button
                            key={source}
                            type="button"
                            onClick={() => setActiveSource(source)}
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

            <SentimentMoversTable items={initialData[activeSource] ?? []} />
        </div>
    );
}
