// Loaded via manifest content_scripts (classic script, no ES modules available), so
// preferences here duplicate src/lib/storage.js's defaults rather than importing it.
const DEFAULT_PREFS = {
  docsEnabled: true,
  sheetsEnabled: true,
  fontOverride: false,
  zoomFactor: 1.3,
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
const UI_FONT_STYLE_ID = "notionish-ui-font"

// Registers the bundled Inter under a name the document will never ask for, so the
// chrome can be set in it while the canvas stays exactly as Docs painted it. That
// distinction is the whole safety argument: applyFontOverride below aliases families
// the *document* uses (Arial, Roboto), which is why it wrecks layout and ships off by
// default. This one invents a family, so nothing in the document resolves to it and
// there is nothing to misplace.
//
// Injected into the page rather than declared in content/*.css for the reason
// established on 2026-08-11: Firefox injects content_scripts CSS at user origin,
// where the page's font resolution never sees an @font-face. Same mechanism, opposite
// risk profile.
const applyUiFont = (enabled) => {
  const existing = document.getElementById(UI_FONT_STYLE_ID)
  if (!enabled) return existing?.remove()
  if (existing) return

  const url = browser.runtime.getURL("src/fonts/inter-variable.woff2")
  const style = document.createElement("style")
  style.id = UI_FONT_STYLE_ID
  style.textContent =
    `@font-face{font-family:"Notionish Inter";` +
    `src:url("${url}") format("woff2-variations");` +
    `font-weight:100 900;font-display:swap}`
  document.documentElement.append(style)
}

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

// Type size is the one thing chrome removal cannot reach: Docs paints body text
// into a canvas, so no selector sets its size and the @font-face route above only
// swaps the family. Browser zoom is the lever that does work, and it works for a
// specific reason — full page zoom changes the pixel ratio Docs renders against, so
// it repaints the canvas at the new size rather than resampling one. CSS `zoom` or
// a transform would scale the bitmap Docs already drew, and the text would come back
// soft. This is real, sharp, Docs-laid-out text at a larger size.
//
// It is also a view setting rather than a document one, which is what makes it
// usable where pageless mode was not: nobody else's copy of the document changes.
//
// tabs.setZoom lives on an API no content script can reach, so this asks the
// background script instead. Scope and the reason for it are documented there.
// A Docs page is 816 CSS px — US Letter at 96dpi — and does not change with zoom,
// since CSS pixels are what zoom scales the viewport *against*. Measured rather than
// trusted once a page exists, because A4 documents are 794; the constant only has to
// carry the first call, at document_start, when there is no page to measure.
const DEFAULT_PAGE_WIDTH = 816
const CHROME_ALLOWANCE = 64

const pageWidth = () =>
  document.querySelector(".kix-page-paginated")?.getBoundingClientRect().width ||
  DEFAULT_PAGE_WIDTH

let appliedZoom = 1

const askZoom = () =>
  browser.runtime
    .sendMessage({ type: "notionish:zoom-get" })
    .then((reply) => reply?.zoom ?? null)
    .catch(() => null)

// Zoom past what the window can hold and the page stops fitting: Docs pins an
// overflowing page to the left of its scroll area and the right-hand text is simply
// off screen. 130% of an 816px page needs about 1060px plus room for a scrollbar, so
// on a 1007px window the honest answer is 115%, not 130%.
//
// innerWidth is in CSS px and shrinks as zoom rises, so innerWidth * currentZoom is
// invariant — the width the window would have at 100%. That invariance is what stops
// the resize handler oscillating: applying a zoom changes innerWidth and leaves this
// product alone, so recomputing after the change returns the same answer and the
// second pass is a no-op.
const fitFactor = (wanted, currentZoom) => {
  const widthAtHundred = window.innerWidth * currentZoom
  const largestThatFits = (widthAtHundred - CHROME_ALLOWANCE) / pageWidth()
  return Math.max(1, Math.min(wanted, largestThatFits))
}

const applyZoom = async (wanted) => {
  // Falling back to the last applied value rather than to 1: a failed query would
  // otherwise read as "the window is tiny" and clamp the zoom away entirely.
  const currentZoom = (await askZoom()) ?? appliedZoom
  const factor = wanted <= 1 ? 1 : fitFactor(wanted, currentZoom)
  appliedZoom = factor

  // Browser zoom scales the whole page, header included — and the header is the one
  // part that should not grow. It is chrome, and a title bar rendered at 130% is
  // heavy in precisely the way this extension exists to fix.
  //
  // Unlike the document, the header is DOM, so it can be scaled back by the exact
  // reciprocal. Computed here rather than as calc(1 / var(…)) in the stylesheet: CSS
  // cannot read a preference, and handing it a plain number avoids depending on
  // calc() being accepted where a <number> is expected.
  document.documentElement.style.setProperty(
    "--notionish-header-scale",
    String(1 / factor),
  )

  return browser.runtime
    .sendMessage({ type: "notionish:zoom", factor })
    .catch((error) => console.error("Notionish: zoom request failed", error))
}

const surface = detectSurface(new URL(location.href))

// The toggle listener runs synchronously and needs the zoom factor, which lives in
// storage. Cached on every apply rather than re-read, so Alt+Shift+N cannot land
// between the keypress and a storage round-trip.
let currentPrefs = DEFAULT_PREFS

// Docs only. Sheets cell text is painted to canvas the same way and would zoom
// just as well, but a spreadsheet at 130% shows fewer rows — that is a change to
// how much you can see, not to how comfortably you can read it, and it is not what
// this option is for.
const zoomFor = (focus) =>
  surface === "docs" && focus === "on" ? currentPrefs.zoomFactor : 1

// Docs centres the page by computing a left offset in JavaScript and writing it
// onto .kix-rotatingtilemanager-content, rather than by any CSS we can override —
// the page itself is position:absolute at left:5px inside it. That calculation happens once,
// against the widths present at the time, and hiding the left rail afterwards frees
// space Docs never recounts: measured 2026-08-12 at 301px left against 186px right
// in a 1303px viewport, which is half a rail's width off centre.
//
// The gate is set asynchronously — storage.sync.get has to resolve first — so our
// hiding always lands after Docs has laid out, whatever the timing. Docs recomputes
// on window resize, so this says one happened. A synthetic event rather than a real
// size change because there is nothing to actually resize; ResizeObserver would not
// see this, but Docs is not using one here or the rail's disappearance would have
// triggered it already.
const nudgeRelayout = () => window.dispatchEvent(new Event("resize"))

const applySurface = (prefs) => {
  currentPrefs = prefs
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

  applyUiFont(enabled)
  applyFontOverride(enabled && prefs.fontOverride)
  applyZoom(zoomFor(root.dataset.notionishFocus))
  nudgeRelayout()
}

// Only wire up listeners when we're actually on a Docs/Sheets document — nothing to
// toggle or watch preferences for otherwise.
if (surface) {
  browser.storage.sync.get(DEFAULT_PREFS).then(applySurface)

  // What fits depends on the window, so the answer changes when the window does.
  // Debounced because a drag fires this continuously, and each pass costs a message
  // round trip to the background script.
  let resizeTimer
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer)
    resizeTimer = setTimeout(
      () => applyZoom(zoomFor(document.documentElement.dataset.notionishFocus)),
      150,
    )
  })

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
    // Focus off means the full Google UI is back, and a Doc at 130% is not that.
    applyZoom(zoomFor(focus))
    // Toggling puts the rail back, which frees and reclaims the same width — so the
    // recentring is owed in both directions.
    nudgeRelayout()
    return Promise.resolve({ focus })
  })
}
