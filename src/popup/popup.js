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

const anyEnabled = (prefs) => prefs.docsEnabled || prefs.sheetsEnabled

document.addEventListener("DOMContentLoaded", async () => {
  const dotEl = document.getElementById("dot")
  const statusEl = document.getElementById("status")
  const enableRowEl = document.getElementById("enable-row")
  const enableLabelEl = document.getElementById("enable-label")
  const enabledEl = document.getElementById("enabled")
  const actionEl = document.getElementById("action")
  const disableEl = document.getElementById("disable")
  const optionsEl = document.getElementById("options")

  optionsEl.addEventListener("click", (event) => {
    event.preventDefault()
    browser.runtime.openOptionsPage()
  })

  const prefs = await settings.get()

  // Wired before the surface check below, which returns early on any other tab.
  // Turning Notionish off is exactly the thing you want to reach from a tab where
  // it is misbehaving, and that tab is often not the Doc itself.
  //
  // This flips both surface prefs rather than disabling the add-on in Firefox's
  // sense — an extension cannot disable itself without the management permission,
  // which would be a heavy ask for a cosmetic restyler. With both prefs off,
  // content.js sets no attributes and every rule is inert, which is the same
  // observable result. It stays a toggle rather than a one-way switch: the
  // per-surface control is removed on non-Docs tabs, so a disable-only button
  // would strand you in the options page to undo it.
  const renderDisable = (current) => {
    // "off everywhere" against the action button's "on this tab". The two do the
    // same thing to the page and differ entirely in scope and memory — one flips an
    // attribute on this document until it reloads, the other writes storage.sync and
    // reaches every Docs tab on every synced machine. Buttons that look alike and
    // read alike are indistinguishable in use, whatever the code does.
    disableEl.textContent = anyEnabled(current)
      ? "Turn off everywhere"
      : "Turn on everywhere"
  }

  renderDisable(prefs)

  disableEl.addEventListener("click", async () => {
    const next = !anyEnabled(await settings.get())
    await settings.set({ docsEnabled: next, sheetsEnabled: next })
    window.close()
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

  // The zoom actually applied can be below the one in options, because a page that
  // does not fit the window gets clamped to what does. Silently differing from a
  // number the user set is the kind of thing that reads as the setting not working,
  // so the popup says which it is.
  const zoomNote = async (enabled) => {
    if (!enabled || surface !== "docs" || prefs.zoomFactor <= 1) return ""
    const zoom = await browser.tabs.getZoom(tab.id).catch(() => null)
    if (zoom === null || Math.abs(zoom - prefs.zoomFactor) < 0.01) return ""
    return ` Zoom is ${Math.round(zoom * 100)}%, capped from ${Math.round(prefs.zoomFactor * 100)}% to fit this window.`
  }

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
  zoomNote(prefs[prefKey]).then((note) => {
    if (note) statusEl.textContent += note
  })

  enabledEl.addEventListener("change", async () => {
    await settings.set({ [prefKey]: enabledEl.checked })
    render(enabledEl.checked)
    renderDisable(await settings.get())
  })

  // Closing the popup on the same tick as the send is how this failure hid for two
  // sessions: window.close() destroys the only context that could have reported the
  // rejection, so a message that never arrived and one that toggled the page look
  // exactly alike. Close only once the content script has answered; on anything
  // else, stay open and say what happened.
  actionEl.addEventListener("click", async () => {
    actionEl.disabled = true
    try {
      const reply = await browser.tabs.sendMessage(tab.id, {
        type: "notionish:toggle-focus",
      })
      // A reply of undefined means the listener ran and declined — the tab is a Doc,
      // the content script is live, but the gate attributes are not set. Reloading
      // is the fix, and it is not what "no receiving end" would have told us.
      if (!reply) {
        statusEl.textContent =
          "Notionish is loaded here but not active yet — reload the tab."
        actionEl.disabled = false
        return
      }
      window.close()
    } catch (error) {
      statusEl.textContent = /receiving end/i.test(error?.message ?? "")
        ? "This tab was open before Notionish loaded — reload it and try again."
        : `Could not reach this tab: ${error?.message ?? error}`
      actionEl.disabled = false
    }
  })
})
