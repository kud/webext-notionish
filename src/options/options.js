import { getPrefs, setPrefs } from "../lib/storage.js"

document.addEventListener("DOMContentLoaded", async () => {
  const docsEl = document.getElementById("docs-enabled")
  const sheetsEl = document.getElementById("sheets-enabled")
  const fontEl = document.getElementById("font-override")
  const zoomEl = document.getElementById("zoom-factor")

  const prefs = await getPrefs()
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
    setPrefs({ docsEnabled: docsEl.checked }),
  )
  sheetsEl.addEventListener("change", () =>
    setPrefs({ sheetsEnabled: sheetsEl.checked }),
  )
  fontEl.addEventListener("change", () =>
    setPrefs({ fontOverride: fontEl.checked }),
  )
  zoomEl.addEventListener("change", () =>
    setPrefs({ zoomFactor: Number(zoomEl.value) }),
  )
})
