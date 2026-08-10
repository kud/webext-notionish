<div align="center">

📝

# Notionish

![Firefox](https://img.shields.io/badge/Firefox-FF7139?style=flat-square&logo=firefoxbrowser&logoColor=white)
![Manifest V2](https://img.shields.io/badge/Manifest-V2-663399?style=flat-square)
![MIT](https://img.shields.io/badge/licence-MIT-22C55E?style=flat-square)

**Restyles Google Docs and Sheets to read like Notion, hiding the chrome around the document.**

[Features](#-features) • [Install](#install) • [How it works](#-how-it-works) • [Development](#-development)

</div>

Google Docs and Sheets are visually loud: a blue product bar, a dense Material toolbar, a ruler, a document tab strip, a right-hand app rail, and a grey backdrop with a paper drop-shadow around every page. Notion's appeal is the opposite — the page is nearly the only thing on screen. Notionish borrows that restraint for Docs and Sheets.

v1 is deliberately cosmetic and narrow: it hides the furniture around the document. It does not touch the document itself.

## 🌟 Features

- 🙈 **Hides the furniture** — removes Docs' blue product bar, menu row, toolbar, ruler, document tab strip, and right-hand app rail.
- 📊 **Sheets, decluttered** — hides the menu row, toolbar, and formula bar while leaving the grid untouched.
- 🎨 **Warm surface treatment** — swaps Google's grey backdrop and paper drop-shadow for a continuous, Notion-ish page.
- ✍️ **Notion-ish chrome typography** — restyles the UI that survives (comment cards, dialogs, context menus) to match.
- ⌨️ **One-key toggle** — `Alt+Shift+N`, or the popup button, brings the full Google UI back instantly without disabling the extension.
- 🎚 **Per-surface control** — enable or disable Docs and Sheets independently from the popup or options page, synced via `browser.storage.sync`.
- 🛡 **Fails safe** — if a selector stops matching after a Google redesign, the affected element simply stays visible; the page is never left broken.

## Install

### From Firefox Add-ons (remote)

[Notionish on Firefox Add-ons](https://addons.mozilla.org/firefox/addon/notionish/)

The listing goes live once the add-on clears AMO review — until then, install from source below.

### From source (local)

```sh
git clone https://github.com/kud/webext-notionish.git
cd webext-notionish
npm install
npm run build
```

Load it in Firefox: `about:debugging#/runtime/this-firefox` → **Load Temporary Add-on** → select `manifest.json` (or the built package in `web-ext-artifacts/`). Temporary add-ons are dropped on restart and must be reloaded after every change.

## 🚀 Quick Start

Once installed, Notionish is on by default for both Docs and Sheets — open any document or spreadsheet and the chrome is already gone.

- Press `Alt+Shift+N` (or click the toolbar icon, then **Toggle focus mode**) to bring the full Google UI back on the current tab, without disabling the extension.
- Open the popup to see whether the current tab is enabled, and to flip it for that surface.
- Open the options page (via the popup's **Open options** link) to enable or disable Docs and Sheets independently — the choice is persisted in `browser.storage.sync`.

## 🧭 How it works

Notionish is CSS-first by design. `src/content.js` runs at `document_start`, resolves which surface the tab is on from the URL, and — once `browser.storage.sync` confirms that surface is enabled — tags `<html>` with `data-notionish-surface` and `data-notionish-focus` attributes. Every hiding and restyling rule lives in `src/content/{shared,docs,sheets}.css`, gated behind those attributes. No JavaScript touches the document itself.

That split is deliberate: **if the JS never runs, or a selector stops matching after a Google redesign, the corresponding attribute is simply never set and the rule stays inert.** The failure mode is always "you see Google's normal interface" — never a hidden or broken page.

Surface detection is URL-based rather than host-based: `docs.google.com` hosts both Docs (`/document/*`) and Docs-embedded Sheets (`/spreadsheets/*`), while `sheets.google.com` is a separate host that redirects into the same app — so the host alone can't say which surface a tab is on. Slides and Drive itself are left untouched.

Every selector the stylesheets rely on is tracked in [`SELECTORS.md`](SELECTORS.md) with a confidence tier — HIGH, MEDIUM, or LOW. The MEDIUM and LOW entries have not yet been verified against a live Doc or Sheet; they're sourced from general knowledge of Google's DOM rather than a live check.

## 🚫 Out of scope

These are informed exclusions, not gaps:

- **Document body text and cell contents.** Both are painted to `<canvas>`, so CSS cannot reach their typography, measure, or layout — this is a hard technical boundary, not an oversight.
- **A Notion-style Drive navigation sidebar.** Injecting one is a v2 project of its own; it needs Drive API OAuth.
- **Google Slides.**
- **Chrome / Chromium.** Firefox only — the manifest targets `browser_specific_settings.gecko` and ships no Chromium build.

## ⚠️ Known limitations

- **The icon is a placeholder.** `src/icons/icon.svg` is a plain gradient square and must be replaced before any AMO submission.
- **Selectors are unverified against a live session.** They're sourced from general knowledge of Google's DOM and long-standing Docs/Sheets conventions, not confirmed against a running Doc or Sheet this build cycle — see [`SELECTORS.md`](SELECTORS.md) for the full confidence breakdown before relying on this beyond casual daily use.

## 🔧 Development

```sh
git clone https://github.com/kud/webext-notionish.git
cd webext-notionish
npm install
npm run dev
```

`npm run dev` runs `web-ext run --firefox=nightly`, which launches Firefox Nightly with the extension already loaded and live-reloaded on file changes. For a one-off manual load instead, use `about:debugging#/runtime/this-firefox` → **Load Temporary Add-on** → `manifest.json`.

```
src/
├── background.js          # MV2 background script — install defaults, command handling
├── content.js              # runs at document_start, resolves surface, tags <html>
├── content/
│   ├── shared.css          # rules shared by Docs and Sheets
│   ├── docs.css             # Docs-specific hiding/restyling
│   └── sheets.css           # Sheets-specific hiding/restyling
├── icons/icon.svg           # placeholder — replace before AMO submission
├── lib/storage.js           # browser.storage.sync helpers (popup/options only)
├── options/                 # options page
└── popup/                   # toolbar popup
```

| Script            | What it does                                                                  |
| ----------------- | ----------------------------------------------------------------------------- |
| `npm run dev`     | Launches Firefox Nightly with the extension loaded and watched                |
| `npm run lint`    | Runs `web-ext lint`                                                           |
| `npm run build`   | Builds a signable package into `web-ext-artifacts/`                           |
| `npm run version` | Syncs `manifest.json`'s version from `package.json` (used by release tooling) |
| `npm run publish` | Builds and opens the AMO Developer Hub for a first manual submission          |

Both `src/background.js` and `src/content.js` load as classic (non-module) scripts under Manifest V2, so they duplicate `DEFAULT_PREFS` from `src/lib/storage.js` rather than importing it — `storage.js` itself is only imported by the popup and options page, which do run as ES modules.

Releases are signed and uploaded to AMO automatically by [`.github/workflows/release.yml`](.github/workflows/release.yml) on every `v*` tag push. The very first submission of a new add-on can't go through that pipeline — AMO requires it manually via the Developer Hub — so `npm run publish` builds the package and opens the Hub for that one-off step.

## 🏗 Tech Stack

| Component    | Choice                                                       |
| ------------ | ------------------------------------------------------------ |
| Platform     | WebExtensions, Manifest V2                                   |
| Browser      | Firefox only (`browser_specific_settings.gecko`)             |
| Language     | Vanilla JavaScript — ES modules where the manifest allows it |
| Styling      | Hand-written CSS, gated by `data-notionish-*` attributes     |
| Storage      | `browser.storage.sync`                                       |
| Tooling      | `web-ext` 10.6.0 — pinned exact, drives lint/run/build/sign  |
| CI / Release | GitHub Actions — signs and uploads to AMO on `v*` tag push   |

---

MIT © [kud](https://github.com/kud) — Made with ❤️
