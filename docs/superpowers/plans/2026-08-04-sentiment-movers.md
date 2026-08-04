# Sentiment Movers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a login-gated `/sentiment` page with nav item that shows Adanos hottest tickers by buzz, with Reddit / X / News / Polymarket tabs.

**Architecture:** Server page authenticates and prefetches trending for all four sources (5-minute revalidate). A client component holds source tabs and renders a shared table; tickers link to `/stocks/[symbol]`.

**Tech Stack:** Next.js 15 App Router, existing Adanos helpers/actions, Vitest, Tailwind (match watchlist page styling).

## Global Constraints

- Login required; unauthenticated users redirect to `/sign-in`.
- Hottest only (~15 rows); no quietest / combined ranking in v1.
- Source tabs: Reddit, X, News, Polymarket.
- Protect free-tier quota with `revalidate: 300`.
- Do not commit `.env` or secrets.
- Only create git commits when the user explicitly asks.

## File map

| File | Role |
|------|------|
| `lib/actions/adanos.helpers.ts` | Add trending path + `TrendingSentimentItem` + `normalizeTrendingItem` |
| `lib/actions/adanos.actions.ts` | `getTrendingBySource`, `getAllTrendingSentiment` |
| `__tests__/adanos.actions.test.ts` | Tests for normalizer + trending fetch |
| `components/sentiment/SentimentMoversTable.tsx` | Presentational table |
| `components/sentiment/SentimentMoversClient.tsx` | Tabs + selected table |
| `app/(root)/sentiment/page.tsx` | Auth + data load + page chrome |
| `lib/constants.ts` | Nav item |

---

### Task 1: Trending helpers + unit tests

**Files:**
- Modify: `lib/actions/adanos.helpers.ts`
- Modify: `__tests__/adanos.actions.test.ts`

**Interfaces:**
- Produces:
  - `TRENDING_PATH` per source (or extend `SOURCE_CONFIG` with `trendingPath: string`)
  - `TrendingSentimentItem` type
  - `normalizeTrendingItem(source, row): TrendingSentimentItem | null`

- [ ] **Step 1: Write failing tests** for `normalizeTrendingItem`

Add to `__tests__/adanos.actions.test.ts`:

```ts
import { normalizeTrendingItem } from '@/lib/actions/adanos.helpers';

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
```

- [ ] **Step 2: Run tests — expect FAIL** (export missing)

Run: `npm test -- __tests__/adanos.actions.test.ts`
Expected: FAIL referencing `normalizeTrendingItem`

- [ ] **Step 3: Implement helpers**

In `adanos.helpers.ts`, extend `SOURCE_CONFIG` entries with:

```ts
trendingPath: '/reddit/stocks/v1/trending' // (and x/news/polymarket equivalents)
```

Add:

```ts
export interface TrendingSentimentItem {
  source: SentimentSourceKey;
  label: string;
  ticker: string;
  companyName: string | null;
  buzzScore: number;
  bullishPct: number | null;
  trend: SentimentTrend | null;
  metricLabel: string;
  metricValue: number | null;
}

export function normalizeTrendingItem(
  source: SentimentSourceKey,
  row: SourceSpecificRow | null | undefined,
): TrendingSentimentItem | null {
  if (!row) return null;
  const ticker = typeof row.ticker === 'string' ? row.ticker.trim().toUpperCase() : '';
  const buzzScore = toNumber(row.buzz_score);
  if (!ticker || buzzScore === null) return null;
  const metricValue = toNumber(row[SOURCE_CONFIG[source].metricField]);
  return {
    source,
    label: SOURCE_CONFIG[source].label,
    ticker,
    companyName: typeof row.company_name === 'string' ? row.company_name : null,
    buzzScore: roundTo(buzzScore),
    bullishPct: toNumber(row.bullish_pct),
    trend: normalizeTrend(row.trend),
    metricLabel: SOURCE_CONFIG[source].metricLabel,
    metricValue: metricValue === null ? null : Math.round(metricValue),
  };
}
```

Note: trending API returns a bare array (not `{ stocks: [...] }`). Keep `SourceComparePayload` for compare; trending fetch will parse `unknown` as array in the action layer.

- [ ] **Step 4: Run tests — expect PASS**

Run: `npm test -- __tests__/adanos.actions.test.ts`
Expected: PASS for `normalizeTrendingItem`

---

### Task 2: Adanos trending actions + fetch tests

**Files:**
- Modify: `lib/actions/adanos.actions.ts`
- Modify: `__tests__/adanos.actions.test.ts`

**Interfaces:**
- Consumes: `normalizeTrendingItem`, `SOURCE_CONFIG`, `SentimentSourceKey`
- Produces:
  - `getTrendingBySource(source, limit = 15): Promise<TrendingSentimentItem[]>`
  - `getAllTrendingSentiment(limit = 15): Promise<Record<SentimentSourceKey, TrendingSentimentItem[]>>`

- [ ] **Step 1: Write failing fetch test**

```ts
import { getTrendingBySource, getAllTrendingSentiment } from '@/lib/actions/adanos.actions';

describe('getTrendingBySource', () => {
  it('returns [] when API key missing', async () => {
    await expect(getTrendingBySource('reddit')).resolves.toEqual([]);
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
    const rows = await getTrendingBySource('reddit', 15);
    expect(rows).toHaveLength(1);
    expect(rows[0].ticker).toBe('AMZN');
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/reddit/stocks/v1/trending'),
      expect.objectContaining({
        headers: expect.objectContaining({ 'X-API-Key': 'test-key' }),
      }),
    );
  });
});

describe('getAllTrendingSentiment', () => {
  it('returns all four keys', async () => {
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
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

- [ ] **Step 3: Implement actions**

In `adanos.actions.ts`:

```ts
export async function getTrendingBySource(
  source: SentimentSourceKey,
  limit: number = 15,
): Promise<TrendingSentimentItem[]> {
  if (!getAdanosApiKey()) return [];
  const capped = Math.max(1, Math.min(limit, 50));
  try {
    const url = new URL(`${getAdanosBaseUrl()}${SOURCE_CONFIG[source].trendingPath}`);
    url.searchParams.set('limit', String(capped));
    const abortController = new AbortController();
    const timeout = setTimeout(() => abortController.abort(), FETCH_TIMEOUT_MS);
    let response: Response;
    try {
      response = await fetch(url.toString(), {
        headers: { 'X-API-Key': getAdanosApiKey() },
        signal: abortController.signal,
        next: { revalidate: 300 },
      });
    } finally {
      clearTimeout(timeout);
    }
    if (!response.ok) {
      console.error(`Adanos ${source} trending failed: ${response.status}`);
      return [];
    }
    const payload = await response.json();
    const rows = Array.isArray(payload) ? payload : [];
    return rows
      .map((row) => normalizeTrendingItem(source, row))
      .filter((item): item is TrendingSentimentItem => Boolean(item))
      .slice(0, capped);
  } catch (error) {
    console.error(`Adanos ${source} trending request failed`, error);
    return [];
  }
}

export async function getAllTrendingSentiment(
  limit: number = 15,
): Promise<Record<SentimentSourceKey, TrendingSentimentItem[]>> {
  const sourceKeys = Object.keys(SOURCE_CONFIG) as SentimentSourceKey[];
  const results = await Promise.all(
    sourceKeys.map(async (source) => [source, await getTrendingBySource(source, limit)] as const),
  );
  return Object.fromEntries(results) as Record<SentimentSourceKey, TrendingSentimentItem[]>;
}
```

- [ ] **Step 4: Run tests — expect PASS**

---

### Task 3: UI components + page + nav

**Files:**
- Create: `components/sentiment/SentimentMoversTable.tsx`
- Create: `components/sentiment/SentimentMoversClient.tsx`
- Create: `app/(root)/sentiment/page.tsx`
- Modify: `lib/constants.ts` (`NAV_ITEMS`)

**Interfaces:**
- Consumes: `getAllTrendingSentiment`, `TrendingSentimentItem`, `SentimentSourceKey`, `SOURCE_CONFIG`

- [ ] **Step 1: Add nav item**

```ts
export const NAV_ITEMS = [
  { href: '/', label: 'Dashboard' },
  { href: '/search', label: 'Search' },
  { href: '/watchlist', label: 'Watchlist' },
  { href: '/sentiment', label: 'Sentiment' },
  { href: '/api-docs', label: 'API Docs' },
];
```

- [ ] **Step 2: Create `SentimentMoversTable.tsx`**

Presentational table: rank, Link ticker → `/stocks/${encodeURIComponent(ticker)}`, company, buzz, bullish %, trend (color like StockSentimentCard), metric column using `metricLabel`. Empty state message when `items.length === 0`.

- [ ] **Step 3: Create `SentimentMoversClient.tsx`**

Client component with `useState<SentimentSourceKey>('reddit')`, tab buttons for four sources, render `SentimentMoversTable` for `data[activeSource]`.

- [ ] **Step 4: Create page**

```tsx
// app/(root)/sentiment/page.tsx
// auth redirect like watchlist
// const trending = await getAllTrendingSentiment(15);
// if !ADANOS_API_KEY show config hint
// else <SentimentMoversClient initialData={trending} />
```

Match watchlist page chrome (dark bg, title, subtitle).

- [ ] **Step 5: Verify**

Run: `npm test -- __tests__/adanos.actions.test.ts`  
Rebuild Docker: `docker compose up -d --build openstock`  
Manual: sign in → open `/sentiment` → switch tabs → click ticker → `/stocks/...`

---

## Spec coverage check

| Spec requirement | Task |
|------------------|------|
| Nav Sentiment item | 3 |
| `/sentiment` login gate | 3 |
| Hottest ~15 by buzz | 2–3 |
| Source tabs | 3 |
| Link to local stock page | 3 |
| Missing key / empty states | 3 |
| revalidate 300 | 2 |
| Out of scope left out | — |

## Placeholder scan

No TBD / “implement later” left in tasks.
