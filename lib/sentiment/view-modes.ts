import type { TrendingSentimentItem } from '@/lib/actions/adanos.helpers';

export type MoversViewMode = 'hottest' | 'falling';

/** Hottest = buzz desc (default list). Falling = trend===falling only, buzz desc. */
export function applyMoversView(
    items: TrendingSentimentItem[],
    mode: MoversViewMode,
): TrendingSentimentItem[] {
    const copy = [...items];
    if (mode === 'falling') {
        return copy
            .filter((i) => i.trend === 'falling')
            .sort((a, b) => b.buzzScore - a.buzzScore);
    }
    return copy.sort((a, b) => b.buzzScore - a.buzzScore);
}
