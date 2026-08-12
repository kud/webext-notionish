// Background scripts declared via manifest "background.scripts" load as classic
// scripts (no "type": "module" support in MV2), so this can't import
// src/lib/storage.js — the two default keys are duplicated here instead.
const DEFAULT_PREFS = {
  docsEnabled: true,
  sheetsEnabled: true,
  fontOverride: false,
  zoomFactor: 1.3,
}

// Defaults are deliberately NOT written to storage on install. Every read goes
// through storage.sync.get(DEFAULT_PREFS), which already substitutes a default for
// any absent key — so persisting them buys nothing and costs the ability to ever
// change one. Writing them eagerly froze fontOverride at its original `true` for
// anyone who had already installed, and flipping the constant afterwards had no
// effect at all: get() only fills in keys that are missing, and that one no longer
// was. Found the hard way on 2026-08-11.

// tabs.setZoom needs no "tabs" permission — the host permissions for
// docs.google.com and sheets.google.com already in the manifest are enough. That
// matters for what this extension is allowed to know: "tabs" would hand a cosmetic
// restyler the URL of every open tab, and nothing here needs one.
//
// Scope is per-origin, and not by choice. This first shipped asking for per-tab —
// precisely to avoid writing the site zoom Firefox remembers for docs.google.com —
// and Firefox rejected it outright: "Unsupported zoom settings: {mode: automatic,
// scope: per-tab}". per-tab is only offered alongside mode "manual", where the
// browser stops applying zoom and the extension is expected to scale the page
// itself. For a canvas document that means a CSS transform over a bitmap Docs has
// already painted, which is the soft-text outcome the whole approach exists to
// avoid. automatic is the only mode that repaints, and automatic means per-origin.
//
// So this does write the site zoom, and the mitigation is discipline rather than
// scope: content.js calls setZoom(1) whenever focus goes off or the surface is
// disabled, on every load. The one hole left is uninstalling with focus on, which
// leaves docs.google.com zoomed with nothing on screen to explain why — said plainly
// in the options page rather than engineered around, because there is no uninstall
// hook to hang a reset on.
//
// Not calling setZoomSettings at all: automatic/per-origin is already the default,
// and asking for it explicitly only creates another way to be rejected.
//
// Not an async listener: one would return a promise for *every* message, including
// ones meant for another listener, and answer them all with undefined.
browser.runtime.onMessage.addListener((message, sender) => {
  if (message?.type !== "notionish:zoom") return
  const tabId = sender.tab?.id
  if (tabId == null) return

  return browser.tabs
    .setZoom(tabId, message.factor)
    .then(() => ({ zoom: message.factor }))
})

browser.commands.onCommand.addListener(async (command) => {
  if (command !== "toggle-focus") return

  const [tab] = await browser.tabs.query({ active: true, currentWindow: true })
  if (!tab) return

  browser.tabs
    .sendMessage(tab.id, { type: "notionish:toggle-focus" })
    .then((reply) => {
      // The content script answers with the state it landed on. Resolving with
      // nothing means it listened and declined — a Docs tab whose gate attributes
      // were never set — which is a third outcome that neither the success path nor
      // the catch below would otherwise distinguish from a working toggle.
      if (!reply) {
        console.warn(
          "Notionish: toggle reached the tab but no gate was set — reload it.",
        )
      }
    })
    .catch((error) => {
      // "No receiving end" is expected on any tab without the content script. Anything
      // else — a missing host permission, say — is a real fault, and swallowing it
      // silently is why the shortcut appeared to do nothing at all.
      //
      // Prefixed like every other line we emit, and for a reason beyond tidiness: the
      // Browser Console carries all of Firefox, so it is read through a filter or not
      // at all. An unprefixed error is not merely hard to find — filtering on
      // "Notionish" actively hides it, and a filter that returns nothing reads as
      // "no faults" rather than "the one fault worth seeing is spelled differently".
      if (!/receiving end/i.test(error?.message ?? ""))
        console.error("Notionish: toggle failed —", error)
    })
})
