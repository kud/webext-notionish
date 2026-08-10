# Selector reliance

Notionish is CSS-first: `src/content.js` tags the document with
`data-notionish-surface` / `data-notionish-focus` attributes, and the stylesheets in
`src/content/*.css` do all the actual hiding and restyling, gated behind those
attributes. If `content.js` never runs (blocked, Google reshuffled the URL shape) or
a selector below stops matching, the corresponding rule is simply inert — the
default is always "stock Google UI stays visible", never a hidden or broken page.
See the comment header in each stylesheet for the same summary in-place.

None of the selectors below have been verified against a live Google Docs/Sheets
session this build cycle — they're sourced from general knowledge of the app's DOM
and long-standing conventions in the Docs/Sheets codebase. Re-verify against a live
document before relying on this for anything beyond casual daily use, and expect the
LOW tier to need occasional adjustment as Google ships UI changes.

## Confidence tiers

**HIGH** — given as stable in the project brief, or long-standing ids/classes used
purely as structural anchors:

- `.kix-appview-editor` — Docs editing-canvas container. Anchor only, never hidden.
- `.docs-gm` — top-level "Docs Material" marker class. Not currently used by any
  rule, kept here as the documented anchor for future scoping.
- `.waffle` — Sheets grid-canvas container. Anchor only, never hidden.
- `#docs-titlebar` — the blue product/title bar (Docs and Sheets share this id).
- `#docs-menubar` — the File/Edit/View… menu row (shared).
- `#docs-toolbar-wrapper` — the Material toolbar row (shared).

**MEDIUM** — id/class form is a reasonable guess but the exact form has not been
checked live:

- `.docs-ruler-container` — the horizontal ruler. If this doesn't match, the ruler
  just stays visible; it has no effect on anything else.

**LOW** — recently-shipped Google features or narrowly-scoped guesses, most likely
to need correction:

- `.docs-tabbar-container` — the multi-tab-per-document strip (a 2024+ Docs
  feature). Class name unverified.
- `.docs-gm-addon-bar` — the right-hand app rail (Explore / add-ons icons).
  Unverified.
- `#t-formula-bar-container`, `.formula-bar-container` — Sheets' formula bar. Two
  alternate forms are listed to raise the odds of a hit; if neither matches, the
  formula bar stays visible.
- `.goog-menu`, `.goog-menuitem`, `.modal-dialog` (in `shared.css`) — Closure
  Library base classes that Docs/Sheets context menus and dialogs are historically
  built on. Framework classes are lower-risk than app-specific ones, but still
  unverified this session. Failure mode here is purely cosmetic (an unstyled but
  fully functional menu/dialog), never a hidden one.

## Rule of thumb for future edits

Prefer adding a new, narrowly-scoped selector over broadening an existing one. A
selector that fails to match costs nothing but a slightly less-hidden toolbar; a
selector that's too broad can take the document canvas down with it. Never target
`.kix-appview-editor` or `.waffle` with `display: none` or similar — those are the
documents themselves.
