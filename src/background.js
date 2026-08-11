// Background scripts declared via manifest "background.scripts" load as classic
// scripts (no "type": "module" support in MV2), so this can't import
// src/lib/storage.js — the two default keys are duplicated here instead.
const DEFAULT_PREFS = {
  docsEnabled: true,
  sheetsEnabled: true,
  fontOverride: false,
}

// Defaults are deliberately NOT written to storage on install. Every read goes
// through storage.sync.get(DEFAULT_PREFS), which already substitutes a default for
// any absent key — so persisting them buys nothing and costs the ability to ever
// change one. Writing them eagerly froze fontOverride at its original `true` for
// anyone who had already installed, and flipping the constant afterwards had no
// effect at all: get() only fills in keys that are missing, and that one no longer
// was. Found the hard way on 2026-08-11.

browser.commands.onCommand.addListener(async (command) => {
  if (command !== "toggle-focus") return

  const [tab] = await browser.tabs.query({ active: true, currentWindow: true })
  if (!tab) return

  browser.tabs
    .sendMessage(tab.id, { type: "notionish:toggle-focus" })
    .catch((error) => {
      // "No receiving end" is expected on any tab without the content script. Anything
      // else — a missing host permission, say — is a real fault, and swallowing it
      // silently is why the shortcut appeared to do nothing at all.
      if (!/receiving end/i.test(error?.message ?? "")) console.error(error)
    })
})
