// Background scripts declared via manifest "background.scripts" load as classic
// scripts (no "type": "module" support in MV2), so this can't import
// src/lib/storage.js — the two default keys are duplicated here instead.
const DEFAULT_PREFS = { docsEnabled: true, sheetsEnabled: true }

browser.runtime.onInstalled.addListener(async () => {
  const stored = await browser.storage.sync.get(DEFAULT_PREFS)
  await browser.storage.sync.set(stored)
})

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
