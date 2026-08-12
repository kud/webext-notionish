// Loaded via manifest content_scripts (classic script, no ES modules available), so
// preferences here duplicate src/lib/storage.js's defaults rather than importing it.
const DEFAULT_PREFS = {
  docsEnabled: true,
  sheetsEnabled: true,
  fontOverride: false,
}

// The families Docs and Sheets set body text in. Deliberately sans-only: a document
// that asked for Times New Roman asked for a serif, and silently answering with
// Inter would be a content change rather than a chrome one.
const OVERRIDDEN_FACES = [
  "Arial",
  "Helvetica",
  "Roboto",
  "Google Sans",
  "Calibri",
  "Verdana",
]

const FONT_STYLE_ID = "notionish-font"

// The one place JavaScript touches the document, and the reason is specific.
// Docs paints body text into <canvas>, which no selector reaches — but canvas
// resolves font families through the same machinery as the DOM, so redefining a
// family the document uses does change what gets painted. The catch is origin:
// Firefox injects content_scripts CSS at *user* origin, where the page's font
// resolution never sees an @font-face. Proven live on 2026-08-11 — the identical
// rule did nothing from content/docs.css and worked immediately as an injected
// <style>. So this element, additively, and nothing else.
//
// Off by default, and the reason is worse than metric drift. Docs does not merely
// wrap against the original font's metrics — it positions each formatting run at an
// absolute x-coordinate derived from them. Substitute a font with different advance
// widths and adjacent runs land on top of each other: observed 2026-08-11 as
// "see the**Pnocess**oggle", bold colliding with the text either side of it. The
// document is unreadable, not merely reflowed.
//
// A metric-compatible substitute (Arimo, Liberation Sans) renders cleanly, but those
// exist precisely to look like Arial — which defeats the point. So this ships as an
// experiment someone can switch on knowingly, never as a default. The damage is
// local to this browser; nobody else's view of the document changes.
const applyFontOverride = (enabled) => {
  const existing = document.getElementById(FONT_STYLE_ID)
  if (!enabled) return existing?.remove()
  if (existing) return

  const url = browser.runtime.getURL("src/fonts/inter-variable.woff2")
  const face = (family) =>
    `@font-face{font-family:"${family}";` +
    `src:url("${url}") format("woff2-variations");` +
    `font-weight:100 900;font-display:swap}`

  const style = document.createElement("style")
  style.id = FONT_STYLE_ID
  style.textContent = OVERRIDDEN_FACES.map(face).join("")

  // Appended to documentElement rather than head: this runs at document_start, so
  // head may not exist yet, and registering the faces before Docs paints its first
  // canvas tile avoids a repaint that Docs would otherwise never trigger.
  document.documentElement.append(style)
}

// docs.google.com hosts both Docs (/document/*) and Docs-embedded Sheets
// (/spreadsheets/*); sheets.google.com is a separate host that redirects into the
// same app. Path-based detection is required — the host alone doesn't say which
// surface a tab is on. Anything else (Slides at /presentation/*, Drive itself) is
// deliberately left untouched.
const detectSurface = (url) => {
  if (url.hostname === "sheets.google.com") return "sheets"
  if (url.hostname !== "docs.google.com") return null
  if (url.pathname.startsWith("/spreadsheets")) return "sheets"
  if (url.pathname.startsWith("/document")) return "docs"
  return null
}

const surface = detectSurface(new URL(location.href))

const applySurface = (prefs) => {
  const root = document.documentElement
  const enabled =
    surface === "docs"
      ? prefs.docsEnabled
      : surface === "sheets"
        ? prefs.sheetsEnabled
        : false

  if (enabled) {
    root.dataset.notionishSurface = surface
    if (!root.dataset.notionishFocus) root.dataset.notionishFocus = "on"
  } else {
    delete root.dataset.notionishSurface
    delete root.dataset.notionishFocus
  }

  applyFontOverride(enabled && prefs.fontOverride)
}

// Only wire up listeners when we're actually on a Docs/Sheets document — nothing to
// toggle or watch preferences for otherwise.
if (surface) {
  browser.storage.sync.get(DEFAULT_PREFS).then(applySurface)

  browser.storage.onChanged.addListener((changes, area) => {
    if (area !== "sync") return
    browser.storage.sync.get(DEFAULT_PREFS).then(applySurface)
  })

  // Answers with the state it landed on, rather than returning nothing. A toggle
  // that reports back is the difference between "the message arrived and did
  // something" and "the message arrived at a tab where the gate was never set" —
  // which sendMessage alone cannot tell apart, since both resolve identically.
  // The early return above is one of those cases: content.js is present and
  // listening, so there is a receiving end, but there is nothing to toggle.
  browser.runtime.onMessage.addListener((message) => {
    if (message?.type !== "notionish:toggle-focus") return
    const root = document.documentElement
    if (!root.dataset.notionishSurface) return
    const focus = root.dataset.notionishFocus === "on" ? "off" : "on"
    root.dataset.notionishFocus = focus
    return Promise.resolve({ focus })
  })
}
