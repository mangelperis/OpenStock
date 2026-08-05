# Sentiment Expansion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend `/sentiment` with watchlist badges + buzz panel, Hottest/Quietest/Falling views, and on-demand Adanos “why trending” explanations.

**Architecture:** Keep login-gated server page. Prefetch watchlist symbols and optional per-source compare for the watchlist panel. Client toggles views over existing mover items (no extra trending calls). Explain loads via a dedicated server action on user click. Reuse `TrendingSentimentItem` / table chrome.

**Tech Stack:** Next.js 15 App Router, existing Adanos helpers (`adanos.trending`, `adanos.helpers`, `adanos.shared`), Vitest, Tailwind.

## Global Constraints

- Login required; stay on `/sentiment`.
- 7-day Adanos window (`days=7`); keep enrich-from-`/stock/{ticker}` for movers.
- Quietest = reverse buzz of same list; Falling = filter `trend === 'falling'`.
- Explain on-demand only; `revalidate: 3600`.
- Do not commit `.env` / secrets.
- Commit only when the user asks (unless running SDD with explicit commit steps).
- Update README fork section when features land.
- Spec: `docs/superpowers/specs/2026-08-04-sentiment-expansion-design.md`.

## File map

| File | Role |
|------|------|
| `lib/actions/adanos.watchlist-sentiment.ts` | Compare watchlist tickers per source → `TrendingBySourceResult`-like shape |
| `lib/actions/adanos.explain.ts` | Fetch `/stock/{ticker}/explain` |
| `lib/actions/adanos.explain-action.ts` | Thin `'use server'` action for client Why? clicks |
| `lib/sentiment/view-modes.ts` | Pure helpers: `applyMoversView(items, mode)` |
| `__tests__/sentiment-view-modes.test.ts` | Unit tests for Hottest/Quietest/Falling |
| `__tests__/adanos.actions.test.ts` | Extend for watchlist compare + explain |
| `components/sentiment/SentimentMoversTable.tsx` | Badge, Why?, view-aware |
| `components/sentiment/SentimentMoversClient.tsx` | View toggle, watchlist panel wiring, explain state |
| `components/sentiment/WatchlistBuzzPanel.tsx` | Watchlist buzz table / empty CTA |
| `app/(root)/sentiment/page.tsx` | Load watchlist + watchlist sentiment |
| `README.md` | Fork modifications blurb |

---

### Task 1: View-mode helpers (Quietest / Falling) — pure logic

**Files:**
- Create: `lib/sentiment/view-modes.ts`
- Create: `__tests__/sentiment-view-modes.test.ts`

**Interfaces:**
- Produces:
  - `export type MoversViewMode = 'hottest' | 'quietest' | 'falling'`
  - `export function applyMoversView(items: TrendingSentimentItem[], mode: MoversViewMode): TrendingSentimentItem[]`

- [ ] **Step 1: Write failing tests**

```ts
import { describe, expect, it } from 'vitest';
import { applyMoversView } from '@/lib/sentiment/view-modes';
import type { TrendingSentimentItem } from '@/lib/actions/adanos.helpers';

const sample: TrendingSentimentItem[] = [
  { source: 'reddit', label: 'Reddit', ticker: 'A', companyName: null, buzzScore: 90, bullishPct: 40, trend: 'rising', metricLabel: 'Mentions', metricValue: 1 },
  { source: 'reddit', label: 'Reddit', ticker: 'B', companyName: null, buzzScore: 50, bullishPct: 40, trend: 'falling', metricLabel: 'Mentions', metricValue: 1 },
  { source: 'reddit', label: 'Reddit', ticker: 'C', companyName: null, buzzScore: 20, bullishPct: 40, trend: 'stable', metricLabel: 'Mentions', metricValue: 1 },
  { source: 'reddit', label: 'Reddit', ticker: 'D', companyName: null, buzzScore: 70, bullishPct: 40, trend: 'falling', metricLabel: 'Mentions', metricValue: 1 },
];

describe('applyMoversView', () => {
  it('hottest sorts buzz desc', () => {
    expect(applyMoversView(sample, 'hottest').map((i) => i.ticker)).toEqual(['A', 'D', 'B', 'C']);
  });
  it('quietest sorts buzz asc', () => {
    expect(applyMoversView(sample, 'quietest').map((i) => i.ticker)).toEqual(['C', 'B', 'D', 'A']);
  });
  it('falling filters and sorts buzz desc', () => {
    expect(applyMoversView(sample, 'falling').map((i) => i.ticker)).toEqual(['D', 'B']);
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

Run: `npx vitest run __tests__/sentiment-view-modes.test.ts`

- [ ] **Step 3: Implement**

```ts
export type MoversViewMode = 'hottest' | 'quietest' | 'falling';

export function applyMoversView(
  items: TrendingSentimentItem[],
  mode: MoversViewMode,
): TrendingSentimentItem[] {
  const copy = [...items];
  if (mode === 'quietest') {
    return copy.sort((a, b) => a.buzzScore - b.buzzScore);
  }
  if (mode === 'falling') {
    return copy
      .filter((i) => i.trend === 'falling')
      .sort((a, b) => b.buzzScore - a.buzzScore);
  }
  return copy.sort((a, b) => b.buzzScore - a.buzzScore);
}
```

- [ ] **Step 4: Run — expect PASS**

---

### Task 2: Wire Hottest / Quietest / Falling UI

**Files:**
- Modify: `components/sentiment/SentimentMoversClient.tsx`
- Modify: `components/sentiment/SentimentMoversTable.tsx` (empty copy for falling)

**Interfaces:**
- Consumes: `applyMoversView`, `MoversViewMode`

- [ ] **Step 1: Add view toggle** above the table (three buttons: Hottest | Quietest | Falling), default `hottest`.

- [ ] **Step 2: Pass `applyMoversView(activeResult.items, viewMode)` into the table.**

- [ ] **Step 3: Empty states**
  - Falling with 0 rows: “No falling names in this source’s current set.”
  - Keep existing error / no-trending messages for other cases.

- [ ] **Step 4: Manual check** — switch modes without network; ranks update.

---

### Task 3: Watchlist badges + buzz panel (data)

**Files:**
- Create: `lib/actions/adanos.watchlist-sentiment.ts`
- Modify: `__tests__/adanos.actions.test.ts` (or new `__tests__/adanos.watchlist-sentiment.test.ts`)

**Interfaces:**
- Produces:
  - `getWatchlistSentimentBySource(source, symbols: string[], days = 7): Promise<TrendingBySourceResult>`
  - `getAllWatchlistSentiment(symbols: string[], days = 7): Promise<Record<SentimentSourceKey, TrendingBySourceResult>>`
- Uses Adanos compare: `SOURCE_CONFIG[source].path` + `tickers=A,B,C` + `days=7`, then `normalizeTrendingItem` / `normalizeSourceInsight` mapped into `TrendingSentimentItem` (reuse normalizeTrendingItem on each stock row).
- Cap symbols at 20; if empty, return empty items without calling API.
- `revalidate: 3600`, same timeout pattern as trending.

- [ ] **Step 1: Failing tests** — missing key → empty; mocks compare payload `{ stocks: [...] }` → normalized items; empty symbols → no fetch.

- [ ] **Step 2: Implement module** (no `'use server'`).

- [ ] **Step 3: Tests PASS**.

---

### Task 4: Watchlist badges + buzz panel (UI)

**Files:**
- Create: `components/sentiment/WatchlistBuzzPanel.tsx`
- Modify: `app/(root)/sentiment/page.tsx`
- Modify: `components/sentiment/SentimentMoversClient.tsx`
- Modify: `components/sentiment/SentimentMoversTable.tsx`

**Interfaces:**
- Page loads `getUserWatchlist(session.user.id)` → symbols array.
- If Adanos key and `0 < symbols.length ≤ 20`, prefetch `getAllWatchlistSentiment(symbols)`.
- Pass `watchlistSymbols` + `watchlistData` into client.

- [ ] **Step 1: Table badge** — if `watchlistSet.has(item.ticker)`, show teal “Watchlist” pill beside ticker.

- [ ] **Step 2: `WatchlistBuzzPanel`** — for active source, render compact table from `watchlistData[source]`; link tickers; handle error/empty; if no symbols, CTA to `/watchlist`.

- [ ] **Step 3: Page wiring** — auth already present; parallel fetch watchlist + trending.

- [ ] **Step 4: Verify** — add a symbol to watchlist, confirm badge + panel row.

---

### Task 5: Explain (“Why trending”)

**Files:**
- Create: `lib/actions/adanos.explain.ts`
- Create: `lib/actions/adanos.explain-action.ts` (`'use server'`)
- Modify: tests
- Modify: `SentimentMoversTable.tsx` / `SentimentMoversClient.tsx`

**Interfaces:**
- `getSentimentExplain(source, ticker): Promise<{ explanation: string; model: string | null; generatedAt: string | null } | { error: string }>`
- URL: `` `${base}${trendingPath.replace(/\/trending$/, `/stock/${ticker}/explain`)}` ``
- Server action: `fetchSentimentExplainAction(source, ticker)` callable from client.

- [ ] **Step 1: Tests** — mock explain JSON; missing key; HTTP error.

- [ ] **Step 2: Implement fetch + action.**

- [ ] **Step 3: UI** — “Why?” button per row; on click call action for **active source** + ticker; show expandable panel under row (or adjacent) with explanation text; loading spinner; error text.

- [ ] **Step 4: Do not prefetch** explains for the whole table.

- [ ] **Step 5: Manual** — click Why? on a hot ticker; text appears; matches Adanos curl roughly.

---

### Task 6: README fork blurb

**Files:**
- Modify: `README.md` (§ Fork modifications)

- [ ] **Step 1: Document** watchlist badges/panel, Hottest/Quietest/Falling, Why? explain.
- [ ] **Step 2: Link** design spec path.

---

## Spec coverage

| Spec item | Task |
|-----------|------|
| Watchlist badge | 4 |
| Watchlist buzz panel | 3–4 |
| Hottest / Quietest / Falling | 1–2 |
| Why? explain on-demand | 5 |
| README | 6 |
| Quota / no explain prefetch | 5 |
| Keep 7-day movers enrich | unchanged (regression via existing tests) |

## Placeholder scan

None intentional. Exact Adanos explain path verified: `/{source}/stocks/v1/stock/{TICKER}/explain`.
