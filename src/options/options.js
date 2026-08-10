import { getPrefs, setPrefs } from "../lib/storage.js"

document.addEventListener("DOMContentLoaded", async () => {
  const docsEl = document.getElementById("docs-enabled")
  const sheetsEl = document.getElementById("sheets-enabled")

  const prefs = await getPrefs()
  docsEl.checked = prefs.docsEnabled
  sheetsEl.checked = prefs.sheetsEnabled

  docsEl.addEventListener("change", () =>
    setPrefs({ docsEnabled: docsEl.checked }),
  )
  sheetsEl.addEventListener("change", () =>
    setPrefs({ sheetsEnabled: sheetsEl.checked }),
  )
})
