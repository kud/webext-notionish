document.addEventListener("DOMContentLoaded", async () => {
  const docsEl = document.getElementById("docs-enabled")
  const sheetsEl = document.getElementById("sheets-enabled")
  const fontEl = document.getElementById("font-override")
  const zoomEl = document.getElementById("zoom-factor")

  const prefs = await settings.get()
  docsEl.checked = prefs.docsEnabled
  sheetsEl.checked = prefs.sheetsEnabled
  fontEl.checked = prefs.fontOverride
  // A stored factor with no matching <option> would leave the select showing the
  // first entry — 100% — while the tab renders at something else. Add the value
  // rather than silently misreport it.
  if (![...zoomEl.options].some((o) => Number(o.value) === prefs.zoomFactor)) {
    zoomEl.add(
      new Option(`${Math.round(prefs.zoomFactor * 100)}%`, prefs.zoomFactor),
    )
  }
  zoomEl.value = String(prefs.zoomFactor)

  docsEl.addEventListener("change", () =>
    settings.set({ docsEnabled: docsEl.checked }),
  )
  sheetsEl.addEventListener("change", () =>
    settings.set({ sheetsEnabled: sheetsEl.checked }),
  )
  fontEl.addEventListener("change", () =>
    settings.set({ fontOverride: fontEl.checked }),
  )
  zoomEl.addEventListener("change", () =>
    settings.set({ zoomFactor: Number(zoomEl.value) }),
  )
})
