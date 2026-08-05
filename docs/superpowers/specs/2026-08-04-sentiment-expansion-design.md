# Sentiment Expansion — Design Spec (Watchlist · Quiet/Falling · Explain)

**Date:** 2026-08-04  
**Status:** Draft for approval  
**Repo:** mangelperis/OpenStock  
**Surface:** `/sentiment` (login-gated, existing)

## Goals

Extend the Sentiment movers page with three related capabilities:

1. **Watchlist × sentiment** — See which movers are on your watchlist; optional panel of buzz for *your* symbols.
2. **Quiet / falling movers** — Same data set, alternate views: lowest buzz and `trend === falling`.
3. **Why trending** — On-demand Adanos `/stock/{ticker}/explain` text per row (or expand).

## Locked decisions

| Topic | Choice |
|-------|--------|
| Where | Stay on `/sentiment` only (no new nav item) |
| Auth | Already required; reuse session |
| Lookback | Keep **7-day** alignment with stock detail |
| Quota | No prefetch of explain; watchlist compare once per page load (one active source or batched compare); cache `revalidate: 3600` |
| Quietest | Bottom of the *same* trending list by buzz (not a separate Adanos “quiet universe”) |
| Falling | Filter `trend === 'falling'` from enriched trending list |
| Explain | On-demand (button / expand), per active source; show Adanos text as-is (no Ollama rewrite in v1) |

## Feature designs

### 1 — Watchlist × sentiment

**A. Badge on movers table**  
- Server loads `getUserWatchlist(userId)` → `Set` of symbols.  
- Pass `watchlistSymbols: string[]` into `SentimentMoversClient` → table.  
- Rows in watchlist show a small “Watchlist” pill next to the ticker.

**B. “My watchlist buzz” panel** (same page, above or beside movers)  
- For the **active source** tab, call Adanos compare with `tickers=SYM1,SYM2,...` and `days=7` (single request per source switch if client-fetched, or prefetch all four on server if watchlist is small ≤20).  
- Prefer **server prefetch for all four sources** when `watchlist.length > 0 && length ≤ 20`, else skip panel with “Add symbols to watchlist”.  
- Table: ticker → `/stocks/...`, buzz, bullish %, trend, metric — same columns as movers, no rank required.  
- Empty watchlist: short CTA linking to `/watchlist`.

### 2 — Quiet / falling movers

- Client view mode toggle: **Hottest** (default) | **Quietest** | **Falling**.  
- Operates on already-loaded `items` for the active source (no extra Adanos calls):  
  - Hottest: sort buzz desc (current).  
  - Quietest: sort buzz asc, take up to 15.  
  - Falling: filter `trend === 'falling'`, sort buzz desc.  
- Empty falling: “No falling names in this source’s top set.”  
- Rank `#` reflects position in the *current* view.

### 3 — Why trending (explain)

- Adanos: `GET /{source}/stocks/v1/stock/{ticker}/explain` → `{ ticker, company_name, explanation, cached, generated_at, model }`.  
- New helper + `getSentimentExplain(source, ticker)` in `lib/actions/adanos.explain.ts` (no `'use server'` unless needed for client invoke — use a small **server action** wrapper for client on-demand).  
- UI: “Why?” button per row → expands row or popover with explanation; loading / error / empty states.  
- Cache: `revalidate: 3600`. Do **not** batch-explain the whole table.

## Out of scope

- Ollama rewrite of explanations  
- Sectors / countries  
- Buzz spike alerts / Inngest  
- Changing stock-detail sentiment card  
- Merging multi-source averages on the list

## Success criteria

1. Watchlist symbols show a badge on movers; panel lists watchlist buzz for active source (or empty CTA).  
2. Hottest / Quietest / Falling toggles change the table without reload or extra trending fetch.  
3. Why? loads explain text for that ticker+source on demand.  
4. Existing hottest + days=7 enrich behavior still green in Vitest.  
5. README fork section updated.

## Quota sketch (personal use)

| Action | Approx. calls |
|--------|----------------|
| Existing movers (4 sources × trending + enrich) | Already paid |
| Watchlist panel (4 × compare, ≤20 tickers each) | +4 / hour cache |
| Explain (per click) | +1 |

---

Spec self-review: no placeholders; features independently shippable; quota constraints explicit.
