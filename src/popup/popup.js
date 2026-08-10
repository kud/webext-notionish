import { getPrefs, setPrefs } from "../lib/storage.js"

const SURFACE_LABEL = { docs: "Docs", sheets: "Sheets" }
const SURFACE_PREF_KEY = { docs: "docsEnabled", sheets: "sheetsEnabled" }

// Mirrors the detection in src/content.js — kept separate because the popup
// resolves the surface from the active tab's URL, not from a page it's injected
// into, so sharing a single function across both contexts isn't practical.
const detectSurface = (url) => {
  if (url.hostname === "sheets.google.com") return "sheets"
  if (url.hostname !== "docs.google.com") return null
  if (url.pathname.startsWith("/spreadsheets")) return "sheets"
  if (url.pathname.startsWith("/document")) return "docs"
  return null
}

document.addEventListener("DOMContentLoaded", async () => {
  const dotEl = document.getElementById("dot")
  const statusEl = document.getElementById("status")
  const enableRowEl = document.getElementById("enable-row")
  const enableLabelEl = document.getElementById("enable-label")
  const enabledEl = document.getElementById("enabled")
  const actionEl = document.getElementById("action")
  const optionsEl = document.getElementById("options")

  optionsEl.addEventListener("click", (event) => {
    event.preventDefault()
    browser.runtime.openOptionsPage()
  })

  const [tab] = await browser.tabs.query({ active: true, currentWindow: true })
  const surface = tab?.url ? detectSurface(new URL(tab.url)) : null

  if (!surface) {
    statusEl.textContent = "Not a Google Docs or Sheets tab."
    enableRowEl.remove()
    actionEl.disabled = true
    return
  }

  const prefKey = SURFACE_PREF_KEY[surface]
  const prefs = await getPrefs()

  const render = (enabled) => {
    enableLabelEl.textContent = `Enabled on ${SURFACE_LABEL[surface]}`
    enabledEl.checked = enabled
    dotEl.dataset.tone = enabled ? "on" : "off"
    actionEl.disabled = !enabled
    statusEl.textContent = enabled
      ? `Focus mode is available on this ${SURFACE_LABEL[surface]} tab.`
      : `${SURFACE_LABEL[surface]} is disabled — Google's UI stays as-is.`
  }

  render(prefs[prefKey])

  enabledEl.addEventListener("change", async () => {
    await setPrefs({ [prefKey]: enabledEl.checked })
    render(enabledEl.checked)
  })

  actionEl.addEventListener("click", () => {
    browser.tabs.sendMessage(tab.id, { type: "notionish:toggle-focus" })
    window.close()
  })
})
