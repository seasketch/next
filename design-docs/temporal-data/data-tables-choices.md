# Choices ledger — Data Tables Temporal Support

This file is the full audit. The session chat restated these same
entries more briefly for the handback; nothing from that chat is missing
here. The chat did not add extra notes.

Audited: uncommitted tree as of 2026-08-31 (plan
`data_tables_temporal_support_fa9c3aea` plus later session work).
Plan-specified items (ephemeral `temporal_config`, `_when_*` as BIGINT
epoch seconds, `when.start`/`when.end` intersection filter, sites stay
painted, clock not persisted, dedicated Temporal wizard, stored
availability bins *as a capability*) are not re-listed.

User-directed later calls (no-data size/stroke/color; “range must
recalculate via the query engine”; hide Play in Range) are not invented
choices.

Related: [Temporal Data](temporal-data.md) · [Timeslider UI References](timeslider-ui-references.md)

---

## Review these first

1. **Window bubble sizes follow the all-time series scale, not the selected range** (needs-user, low)
2. **The slider histogram prefers live, filter-aware series counts over the stored TOC histogram** (needs-user, low–medium)
3. **Range-mode queries are not debounced or aborted while the thumbs move** (unsound, medium)

---

## needs-user

### Window bubble sizes use the all-time series scale

- **When:** Phase 5 query wiring, kept when Range was switched to an engine query (2026-08-31).
- **The choice:** In Range mode, circle sizes are still stretched against the min/max of the *whole table series*, not the min/max of the years you picked.

  You turn on Fish Transects, Instant, year 2024. The biggest site that
  year has mean count 3.3; the legend’s biggest bubble is 3.3. You switch
  to Range and drag 2008–2024. The engine correctly recomputes each
  site’s **mean** over those years (the number on the feature). But the
  **size** of the bubble is still “where does this number sit between the
  smallest and largest *single-year* means in the cached series,” which
  was computed across every year, not across this window.

  A **series** here is one `/query` with `when.step=year` over the
  table’s full coverage: the server returns a mean per site per year, plus
  a global `scaleMin`/`scaleMax`. Instant mode paints one year from that
  cache. Range mode now asks for a single mean over `[2008, 2025)` and,
  if that series cache exists, still uses the series’ `scaleMin`/`scaleMax`
  so a site that is “medium in 2024” stays the same size when you add
  years.

  The unbuilt alternative: after a range query returns, rebuild the
  legend from *that* window’s min/max. Adding quiet years would shrink
  every bubble; Instant ↔ Range would jump.

- **The gap:** The plan said Range is a clock window and Instant is
  default. It never said whether symbol size is “compared to all time” or
  “compared to this window.”
- **The reach:** Any later “compare two ranges” or “export the legend”
  inherits this. Report widgets that reuse the same scale helpers will
  too.
- **Verdict:** needs-user. Taste + map-reading, not a correctness bug
  (the *numbers* are the engine’s). **Provisional call:** keep the
  all-time series scale so Instant and Range do not jump. **Reverse:** in
  `paintCached`, pass the window result’s own `scaleMin`/`scaleMax` when
  `clock.mode === "window"`.
- **Confidence:** low.

### Live filtered series counts override the stored histogram

- **When:** Phase 5 timeslider, after `when.step` existed.
- **The choice:** The grey bars on the time slider are *not* (once a
  query has run) the histogram stored on the table at reprocess time.
  They are “how many rows matched the current map filters in each year,”
  taken from the latest `when.step` series.

  You activate UPC with `classcode = BOULD`. The table’s
  `TemporalInfo.availability` (written at reprocess) is “all UPC rows per
  day/year,” including every classcode. After the series query returns,
  `histogramCountForStep` prefers `queryStepCounts[table][year]` — only
  BOULD rows. A year that has lots of UPC but no BOULD goes to a flat
  bar.

  **Stored histogram:** row counts baked into `overlay_data_tables.temporal`
  at ingest, shipped on every table-of-contents payload.
  **Live series counts:** `series.stepStats` from `/query?when.step=…`.

  The plan said: slider track shows **stored row-count bins (no live
  stats queries)**. The work still *writes* those bins, then ignores them
  for the track as soon as a series arrives. Range mode fires a second
  series fetch in the background just to keep those bars.

  The unbuilt alternative (the plan): always roll
  `temporal.availability` up to Year/Month/Day. Filters would not change
  the bars. No extra series fetch in Range.

- **The gap:** The plan forbade live stats but did not say what happens
  when the map is already filtered (species, site group). GFW/Kepler
  histograms are usually “what you are looking at.”
- **The reach:** TOC payloads still carry daily bins (KFM-scale: hundreds
  to thousands of `{start, count}` objects on `ClientOverlayDataTable`).
  You pay that *and* a series scan. Future “stats in the slider” will
  copy whichever source of truth you keep.
- **Verdict:** needs-user. **Provisional call:** keep live,
  filter-aware bars (they match the map); treat stored bins as the
  fallback before the first query. **Reverse:** stop passing
  `queryStepCounts` into `layoutTimeSliderCoverageMarks`; drop
  `refreshSeriesHistogram` in Range.
- **Confidence:** low–medium.

### Instant → Range starts as a one-step window

- **When:** Phase 5 TimeSlider toggle.
- **The choice:** Clicking Range does not select “the whole table.” It
  turns the current Instant year (or month/day) into a window of that
  same width — two thumbs on top of each other at 2024 — and you drag to
  expand.

  Instant clock for 2024 is `{ start: "2024", end: "2025" }` (end is
  exclusive: “up to but not including 2025”). The toggle calls
  `windowClockForRange(clock.start, clock.end)`, so Range is also
  2024-only until you move a thumb.

  The unbuilt alternative: Range opens as the full coverage (1966–2024)
  or as “from domain start through the current year.” One click would
  change every site’s mean and fire a wide engine query immediately.

- **The gap:** Plan said Instant is default and Range gets a second
  thumb. It did not say the initial window.
- **The reach:** First-time users will think Range “does nothing” until
  they discover the second thumb. Playback used to walk that width;
  Play is now hidden, so this is only about the first paint.
- **Verdict:** needs-user. **Provisional call:** keep the one-step
  start so the toggle does not jump values. **Reverse:** on toggle, set
  `windowClockForRange(domain.start, clock.end, resolution)` (or domain
  end).
- **Confidence:** medium.

---

## unsound

### Range queries are not debounced or cancelled

- **When:** Phase 5 said “debounced ~150ms for scrubbing/playback.”
  Instant later moved to a cached series + `requestAnimationFrame`.
  When Range was fixed to hit the engine (2026-08-31), each clock change
  starts a new `/query` immediately. In-flight fetches are never aborted
  (`fetchInFlight` comment: “never aborted on clock change”).
- **The choice:** Dragging the Range start thumb from 2024 back to 2008
  can start a query for 2012–2025, then 2011–2025, then 2010–2025, and so
  on — one parquet scan per intermediate year. Only the latest generation
  is *painted*, but the others still run and fill a 32-entry result
  cache.

  Instant does not have this problem: one series, then paint from
  memory. Range is the slow path.

  The general property the plan named: **clock changes faster than
  queries; the engine should see a settled window.** A 150ms debounce
  (or abort of the previous window query) guarantees that. “Year-level
  drags are few enough” does not — Day resolution over 25 years is
  thousands of thumbs.

- **The gap:** After Instant became a cache-scrub, nobody reapplied the
  plan’s debounce to the remaining engine-backed mode.
- **The reach:** Overlay Data Server cost, browser connection pile-up,
  and a cache that evicts useful Instant series if you drag a wide day
  range. Any future “live stats in the slider” will copy this scheduler.
- **Verdict:** unsound. **Redo from:** window-mode engine queries are
  issued for the *settled* clock (debounce and/or abort stale
  `when.start`/`when.end` fetches). Instant may stay un-debounced
  because it does not hit the engine per tick.
- **Confidence:** medium.

### Stored availability bins by start-truncation, not interval overlap

- **When:** Phase 3 lambda (`deriveWhenColumns` DuckDB `date_trunc` on
  `_when_start`).
- **The choice:** The histogram baked into `TemporalInfo` counts a row
  in exactly one bin: the calendar bucket of its **start** timestamp.

  A row mapped as a span “2018–2021” (start/end columns, half-open
  `[2018, 2021)`) increments only the 2018 bar. The query engine’s
  `when.step` path does the opposite: `stepsOverlappingInterval` puts
  that row in 2018, 2019, *and* 2020. Instant scrub and the live
  histogram (once a series returns) follow overlap. The stored TOC
  histogram, and the track *before* the first query, follow start-only.

  Pilots are mostly survey *days* (a one-day interval lives in one
  bin either way). The plan still required start/end span columns “for
  completeness.”

  Design doc rule: counts are “how many expanded intervals **intersect**
  this bin.”

- **The gap:** Plan said “availability histogram via DuckDB group-by” and
  did not specify start-trunc vs intersection.
- **The reach:** Any span-mapped table, plus any later “use stored bins
  only” (if you reverse the live-histogram choice) will show the wrong
  shape. Preview and lambda can drift if only one is fixed.
- **Verdict:** unsound. **Redo from:** stored `availability.bins` use
  the same overlap rule as `when.start`/`when.end` / `when.step` (a row
  contributes to every native bin it intersects). Point-date rows stay
  one bin.
- **Confidence:** medium (high that the *property* is right; medium that
  it matters before a real span table ships).

---

## sound

### Instant map paint is a slice of one `when.step` series

- **When:** Phase 5, after per-tick `when.start`/`when.end` felt too
  slow to scrub.
- **The choice:** The query server grew a new public parameter
  `when.step` (year/month/day/…). One request over the table’s full
  coverage returns every site’s mean for every slider step. Dragging
  Instant only re-paints from that cache. Range no longer *combines*
  those yearly means (that was wrong); it asks the engine for the
  window. The series remains for Instant and for the live histogram.

  **`when.step`:** “also group the same filter by calendar step; attach
  a `series` summary (global scale, per-step row counts).”

  The plan’s alternative: debounce ~150ms and refetch
  `when.start`/`when.end` for the visible Instant year. Every tick is a
  scan. Daily 25-year Instant would be unusable.

- **The gap:** The plan specified the filter params, not a series mode.
  Instant UX (“scrub live”) forced a cache.
- **The reach:** This is now part of the Overlay Data Server contract.
  Report time-series widgets, other clients, and the 40k step cap all
  assume it. Do not “remove `when.step`” without a replacement for
  Instant.
- **Verdict:** sound. The Instant product does not work without a
  series-or-equivalent cache. Combining series bins to fake a Range mean
  was the unsound *use*; that use is gone.
- **Confidence:** medium (user wanted the scrub; they never named this
  API).

### Step cap is 40_000 (plan said 2_000)

- **When:** After `when_step_limit` errors on daily KFM-scale ranges;
  user asked whether daily ~25 years was actually too expensive.
- **The choice:** `MAX_WHEN_STEPS` / `TIME_SLIDER_MAX_STEPS` = 40_000
  (~109 years of days). The view-resolution picker still hides
  resolutions that would exceed the cap.

  2_000 was a safety number copied from an older slider constant, not a
  measured scan cost. A series query does one parquet pass; extra work
  is grouping rows onto steps they overlap.

- **The gap:** Plan said clamp so step count stays under `MAX_STEPS`
  (2000). It did not say 2000 was a server physics limit.
- **The reach:** Public `{ code: "when_step_limit", maxSteps }` and
  which resolutions the picker offers. Raising it again is a one-line
  pair of constants — keep them in sync.
- **Verdict:** sound. Matches the user’s “daily over this table should
  work” call; 40k is a named ceiling, not a magic “this fixture passed.”
- **Confidence:** medium–high.

### One changelog event for temporal metadata and temporal reprocess

- **When:** After History/tooltip work (not in the original plan;
  requested mid-implementation).
- **The choice:** `data_table:temporal` is a new
  `change_log_field_group`. Resolution-only saves and parquet reprocess
  share it. Extra JSON `reprocessed: true|false` (and version identity)
  tells History whether to show “temporal settings” vs “v3 → v4.”

  The alternative: reuse `data_table:replaced` for reprocess (wrong:
  that event means a new CSV) or invent two enums.

- **The gap:** Plan mentioned `updateOverlayDataTableTemporal` vs
  reprocess, not History.
- **The reach:** Publish summaries, badge copy, and any future
  “undo temporal” all key off this enum. Do not add a second group
  without migrating rows.
- **Verdict:** sound. Fits existing changelog patterns.
- **Confidence:** medium–high.

### Slider steps are equal-width ordinal slots

- **When:** Phase 5 `layoutTimeSliderSteps`.
- **The choice:** 2018, 2019, and 2020 each get 10% of the track if
  there are ten years — not 365/366-day pixel widths, not “1966–2024
  stretched by real time” (which would crush recent years).

- **The gap:** Plan did not specify geometry.
- **The reach:** All thumbs, histograms, and keyboard snaps share this
  scale. Changing it later moves every handle.
- **Verdict:** sound. Right for sparse/irregular tables.
- **Confidence:** high.

### Preview URL is derived from `queryUrl`

- **When:** Phase 4 wizard; GraphQL `temporalPreviewUrl` was considered
  and dropped.
- **The choice:** Replace the `/query` suffix on `queryUrl` with
  `/temporal-preview`. No extra column, no TOC field.

- **The gap:** Plan named the route, not how the client finds it.
- **The reach:** If `queryUrl` ever loses a `/query` suffix, the wizard
  breaks. ACL/`ns` query params already ride on `queryUrl`.
- **Verdict:** sound.
- **Confidence:** high.

---

## Trivial discretion (not expanded)

Nine internal calls: `RESULT_CACHE_LIMIT = 32`; series `steps` array
still lists empty calendar ticks while `stepStats` omits them; tooltip
delay 120ms / skip-delay 300ms; Radix Tooltip (vs Floating UI) for
History; “Save and Reprocess” label; no-data/zero radius ratios after
the user set the targets; leftover `combineSeriesSteps` helper still
tested; `DATA_TABLE_PAINT_TRANSITION` 450ms; play/pause icon set.

---

## Plan fog

Choices cluster on **Phase 5 query + slider stats**: the plan specified
`when.start`/`when.end` and “stored bins, no live stats,” then Instant
scrub, Range correctness, and histogram-vs-filters were filled in by
the implementer. If this area keeps growing, reslice “map query
contract” and “slider track source of truth” as their own spec instead
of triaging another generation of the same choices.
