# Selector reliance

Notionish is CSS-first: `src/content.js` tags the document with
`data-notionish-surface` / `data-notionish-focus` attributes, and the stylesheets in
`src/content/*.css` do all the actual hiding and restyling, gated behind those
attributes. If `content.js` never runs (blocked, Google reshuffled the URL shape) or
a selector below stops matching, the corresponding rule is simply inert — the
default is always "stock Google UI stays visible", never a hidden or broken page.
See the comment header in each stylesheet for the same summary in-place.

**Sheets was verified live on 2026-08-11** with `tools/selector-probe.js`, against a
real spreadsheet in a signed-in session. Docs has **not** been — every Docs-only
selector below is still an unverified guess.

The verification pass mattered more than expected: two selectors carried as HIGH and
LOW respectively matched **zero** nodes, and the header band turned out to be wider
than the element we were hiding. Treat an unverified tier as a hypothesis, not a
confidence level — the tier records how sure someone felt, and the probe is the only
thing that records what is true.

## Confidence tiers

**CONFIRMED** — matched against a live Sheet on 2026-08-11, and observed to hide
when the gate is on:

- `#docs-titlebar` — the product/title bar. Present, hides cleanly.
- `#docs-menubar` — the File/Edit/View… menu row. Present, hides cleanly.
- `#docs-toolbar-wrapper` — the Material toolbar row. Present, hides cleanly.
- `#docs-header-container` — the full 32px header band, and the parent of
  `#docs-titlebar`. Hiding the titlebar alone leaves the logo, title, star,
  cloud-status, revision history, comments, Share, Ask Gemini and the account chip
  stranded in a row across the top; they are siblings, not children.
- `#waffle-grid-container` — Sheets grid container. Anchor only, never hidden.
- `.goog-menu` — 23 nodes present. Closure menus are real, and Notionish's
  restyling of them is live.

**CONFIRMED ABSENT** — matched zero nodes on a live 2026 Sheet. Do not reinstate
without a probe run showing otherwise:

- `.waffle` — carried as HIGH from the project brief. Does not exist. The grid
  container is `#waffle-grid-container`; superseded above.
- `#t-formula-bar-container`, `.formula-bar-container` — both guessed forms miss.
  The formula bar's real selector is still unknown. `tools/selector-probe.js` greps
  the DOM for `formula` to find it; the rules have been removed from `sheets.css`
  rather than left in place looking like coverage.

Docs was verified live the same day, against a real document:

- `#docs-header-container`, `#docs-titlebar`, `#docs-menubar`,
  `#docs-toolbar-wrapper` — present and hiding cleanly. The `#docs-*` shell really
  is shared between Docs and Sheets.
- `.docs-ruler` — the class shared by `#kix-horizontal-ruler` and
  `#kix-vertical-ruler`. **There are two rulers**, not one: a vertical 16px strip
  runs down the left edge as well.
- `#kix-horizontal-ruler-container` — the 16px band the horizontal ruler sits in.
  Hiding only the ruler leaves the band's height behind.
- `.left-sidebar-container` — the left rail, holding the document outline and the
  per-document tab strip. One container, not the two separate things the brief
  described.
- `.kix-appview-editor` — present. Also `.kix-appview-editor-container`, its parent.
- `.kix-page-paginated` — a document page. Carries `canvas-first-page` and
  `kix-page-canvas-compact-mode` alongside.

**CONFIRMED ABSENT — Docs.** Matched zero nodes on a live 2026 Doc:

- `.kix-page` — superseded by `.kix-page-paginated`.
- `.docs-ruler-container` — superseded by `.docs-ruler`.
- `.docs-tabbar-container` — the tab strip is not a separate top bar; it lives in
  `.left-sidebar-container`.
- `.docs-gm-addon-bar` — no right-hand app rail exists. The rail is on the left.

**Still unverified:**

- `.docs-gm` — no rule uses it.
- `.modal-dialog` (in `shared.css`) — inconclusive rather than absent: both probe
  runs happened with no dialog open, so zero matches proves nothing either way.

## Specificity, not just existence

A selector can match and still lose. Notionish's `display: none` rules carry
`!important` and won; its **restyling** rules originally did not, so the backdrop
recolour on `.kix-appview-editor` no-opped against Google's own stylesheet while
matching perfectly. That failure is invisible — it looks identical to a wrong
selector — so every restyling rule now carries `!important` too. When the probe
reports `found: 1, stillVisible: 1`, specificity is the first suspect, not the
selector.

## `docs-ui-unprintable`

Google tags its own chrome with `docs-ui-unprintable` — both rulers and the left
sidebar carry it. It is essentially a maintained "this is not the document" marker,
and hiding it would take out several pieces of furniture in one rule. Deliberately
**not** used: it is exactly the kind of broad selector the rule of thumb below warns
against, and nothing guarantees its membership stays limited to things we want gone.
Recorded here because it is the obvious shortcut and someone will reach for it.

## Rule of thumb for future edits

Prefer adding a new, narrowly-scoped selector over broadening an existing one. A
selector that fails to match costs nothing but a slightly less-hidden toolbar; a
selector that's too broad can take the document canvas down with it. Never target
`.kix-appview-editor` or `.waffle` with `display: none` or similar — those are the
documents themselves.

## Verifying these live

`tools/selector-probe.js` is the instrument for this. Open a Google Doc, press
`Cmd+Opt+K` for the page console (not the Browser Console), paste the file's
contents, and read the three outputs:

- **`gate`** — whether `content.js` set `data-notionish-surface` / `data-notionish-focus`.
  Unset means no rule can fire and the selectors below are irrelevant; the fault is
  in `content.js`, the stored prefs, or a stale add-on that was never reloaded.
- **`matches`** — per selector, how many nodes exist and how many are _still visible_.
  `found: 0` means the selector is simply wrong. `found: 1, stillVisible: 1` means it
  matched and `display: none !important` lost anyway — a specificity or shadow-DOM
  problem, and a different fix entirely.
- **`furniture`** — visible chrome we are failing to hide, with real class names,
  excluding anything inside `.kix-page` so document content doesn't drown the signal.

Update the confidence tiers above from what it reports. Nothing in this file has
been confirmed against a live document yet.
