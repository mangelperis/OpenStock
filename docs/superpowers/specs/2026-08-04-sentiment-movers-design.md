# Sentiment Movers — Design Spec

**Date:** 2026-08-04  
**Status:** Approved (pending user review of this file)  
**Repo:** mangelperis/OpenStock (fork)

## Goal

Add a dedicated, login-gated **Sentiment** area that surfaces Adanos “hottest” tickers by buzz, with room to grow (quietest, sectors, explain) later.

## Decisions (locked)

| Decision | Choice |
|----------|--------|
| Access | Login required (same pattern as Watchlist) |
| Ranking | Hottest only (~15 by buzz) |
| Sources | Tabs: Reddit / X / News / Polymarket |
| Placement | New nav item + `/sentiment` page (not Dashboard widget) |

## Approaches considered

1. **Dedicated page + server prefetch** (chosen) — clear expansion surface; tabs switch client-side over prefetched data.
2. Dashboard-only widget — less discoverable; harder to grow.
3. Fetch-on-tab-click only — saves quota if users stay on one tab; worse UX; more client complexity.

## Product design

### Navigation

- Extend `NAV_ITEMS` with `{ href: '/sentiment', label: 'Sentiment' }` (after Watchlist).

### Page: `/sentiment`

- Auth: `getSession` → redirect `/sign-in` if missing.
- Header: title “Sentiment”, short subtitle that this is Adanos attention/buzz (not price prediction).
- Client tabs for the four Adanos sources.
- Table columns: rank, ticker (link to `/stocks/[symbol]`), company, buzz (/100), bullish %, trend, volume metric (mentions or trades per source).
- States: missing `ADANOS_API_KEY`, empty list, per-source fetch failure (show message; other tabs still work).

### Data

- New helper path config for trending: `/{source}/stocks/v1/trending?limit=15`.
- New action: `getTrendingBySource(source, limit)` and `getAllTrendingSentiment(limit)` (parallel fetch of all four).
- Cache: `next: { revalidate: 300 }` (5 minutes) to protect free-tier quota (~250 req/month).
- Normalize rows into a shared `TrendingSentimentItem` type (ticker, companyName, buzzScore, bullishPct, trend, metricLabel, metricValue).

### UI structure (expandable)

```
app/(root)/sentiment/page.tsx          # auth + data load
components/sentiment/
  SentimentMoversPage.tsx              # tabs + table (client)
  SentimentMoversTable.tsx             # presentational table
lib/actions/adanos.actions.ts          # extend
lib/actions/adanos.helpers.ts          # trending path + normalizers
```

## Out of scope (v1)

- Quietest / least-active list
- Combined multi-source average ranking
- Sector / country trending
- `/explain` “why trending”
- Watchlist-only filter
- Polymarket zero-activity special casing beyond normal empty metrics

## Success criteria

1. Signed-out user hitting `/sentiment` lands on sign-in.
2. Signed-in user sees nav **Sentiment** and a working hottest list for at least one source when Adanos key is set.
3. Ticker click opens local `/stocks/TICKER` (not TradingView).
4. Changing tabs does not require a full page reload.
5. Missing Adanos key shows a clear empty/config state (no crash).

## Risks

- Free-tier quota: 4 sources × page views; mitigated by 5-minute revalidate and login gate.
- Trending payload shape may differ slightly per source; normalizer must tolerate missing optional fields.

## Spec self-review

- [x] No unresolved placeholders
- [x] No contradictions with prior chat decisions (login + hottest + tabs)
- [x] Scope bounded; expansion called out explicitly
- [x] Success criteria are testable
