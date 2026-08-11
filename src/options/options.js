import { getPrefs, setPrefs } from "../lib/storage.js"

document.addEventListener("DOMContentLoaded", async () => {
  const docsEl = document.getElementById("docs-enabled")
  const sheetsEl = document.getElementById("sheets-enabled")
  const fontEl = document.getElementById("font-override")

  const prefs = await getPrefs()
  docsEl.checked = prefs.docsEnabled
  sheetsEl.checked = prefs.sheetsEnabled
  fontEl.checked = prefs.fontOverride

  docsEl.addEventListener("change", () =>
    setPrefs({ docsEnabled: docsEl.checked }),
  )
  sheetsEl.addEventListener("change", () =>
    setPrefs({ sheetsEnabled: sheetsEl.checked }),
  )
  fontEl.addEventListener("change", () =>
    setPrefs({ fontOverride: fontEl.checked }),
  )
})
