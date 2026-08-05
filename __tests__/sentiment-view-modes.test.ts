import { describe, expect, it } from 'vitest';
import { applyMoversView } from '@/lib/sentiment/view-modes';
import type { TrendingSentimentItem } from '@/lib/actions/adanos.helpers';

const sample: TrendingSentimentItem[] = [
    {
        source: 'reddit',
        label: 'Reddit',
        ticker: 'A',
        companyName: null,
        buzzScore: 90,
        bullishPct: 40,
        trend: 'rising',
        metricLabel: 'Mentions',
        metricValue: 1,
    },
    {
        source: 'reddit',
        label: 'Reddit',
        ticker: 'B',
        companyName: null,
        buzzScore: 50,
        bullishPct: 40,
        trend: 'falling',
        metricLabel: 'Mentions',
        metricValue: 1,
    },
    {
        source: 'reddit',
        label: 'Reddit',
        ticker: 'C',
        companyName: null,
        buzzScore: 20,
        bullishPct: 40,
        trend: 'stable',
        metricLabel: 'Mentions',
        metricValue: 1,
    },
    {
        source: 'reddit',
        label: 'Reddit',
        ticker: 'D',
        companyName: null,
        buzzScore: 70,
        bullishPct: 40,
        trend: 'falling',
        metricLabel: 'Mentions',
        metricValue: 1,
    },
];

describe('applyMoversView', () => {
    it('hottest sorts buzz desc', () => {
        expect(applyMoversView(sample, 'hottest').map((i) => i.ticker)).toEqual([
            'A',
            'D',
            'B',
            'C',
        ]);
    });

    it('falling filters and sorts buzz desc', () => {
        expect(applyMoversView(sample, 'falling').map((i) => i.ticker)).toEqual(['D', 'B']);
    });
});
