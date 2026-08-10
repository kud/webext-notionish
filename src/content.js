// Loaded via manifest content_scripts (classic script, no ES modules available), so
// preferences here duplicate src/lib/storage.js's defaults rather than importing it.
const DEFAULT_PREFS = { docsEnabled: true, sheetsEnabled: true }

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
}

// Only wire up listeners when we're actually on a Docs/Sheets document — nothing to
// toggle or watch preferences for otherwise.
if (surface) {
  browser.storage.sync.get(DEFAULT_PREFS).then(applySurface)

  browser.storage.onChanged.addListener((changes, area) => {
    if (area !== "sync") return
    browser.storage.sync.get(DEFAULT_PREFS).then(applySurface)
  })

  browser.runtime.onMessage.addListener((message) => {
    if (message?.type !== "notionish:toggle-focus") return
    const root = document.documentElement
    if (!root.dataset.notionishSurface) return
    root.dataset.notionishFocus =
      root.dataset.notionishFocus === "on" ? "off" : "on"
  })
}
