;(() => {
  // Run in the Browser Console (or the Web Console switched to the chrome context)
  // and every query below silently targets browser.xhtml — Firefox's own UI — which
  // reports a plausible-looking 45 rows of toolbar and zero selector matches. Bail
  // loudly instead: a wrong-document run is indistinguishable from "every selector
  // is broken" once it reaches the report.
  if (!/^(docs|sheets)\.google\.com$/.test(location.hostname)) {
    console.error(
      "%cNotionish probe: wrong document.%c\n" +
        `Evaluating against ${location.href}\nwhich is not a Google Docs or Sheets page.\n\n` +
        "If that URL ends in browser.xhtml, the console is attached to Firefox's own\n" +
        "interface rather than the tab. Open the Doc, right-click the page → Inspect →\n" +
        'Console, check the context picker reads "Top", and re-run.',
      "color:#EF4444;font-weight:bold;font-size:14px",
      "color:inherit",
    )
    return
  }

  const root = document.documentElement

  // Reads the ungated --notionish-css beacon in shared.css. Firefox injects
  // content_scripts CSS at user-stylesheet origin, so document.styleSheets never
  // lists it (Chrome does, which is the trap) — a custom property is the one signal
  // that survives. Being ungated, it separates "the add-on isn't loaded in this tab"
  // from "it's loaded but content.js never set the gate": opposite fixes, identical
  // symptom otherwise.
  const cssLoaded =
    getComputedStyle(root).getPropertyValue("--notionish-css").trim() ===
    "loaded"

  const gate = {
    surface:
      root.dataset.notionishSurface ?? "(UNSET — content.js did not gate)",
    focus: root.dataset.notionishFocus ?? "(UNSET)",
    stylesheet: cssLoaded
      ? "injected"
      : "(ABSENT — the add-on is not loaded in this tab, or predates the beacon)",
    url: location.href,
  }

  const SELECTORS = [
    "#docs-titlebar",
    "#docs-menubar",
    "#docs-toolbar-wrapper",
    ".docs-ruler-container",
    ".docs-tabbar-container",
    ".docs-gm-addon-bar",
    ".kix-appview-editor",
    ".kix-page-paginated",
    ".docs-ruler",
    ".left-sidebar-container",
    "#t-formula-bar-container",
    ".formula-bar-container",
    ".waffle",
    ".goog-menu",
    ".modal-dialog",
  ]

  const visible = (el) => {
    const r = el.getBoundingClientRect()
    return (
      r.width > 0 &&
      r.height > 0 &&
      getComputedStyle(el).visibility !== "hidden"
    )
  }

  const matches = SELECTORS.map((selector) => {
    const found = [...document.querySelectorAll(selector)]
    return {
      selector,
      found: found.length,
      stillVisible: found.filter(visible).length,
    }
  })

  const inDocumentBody = (el) =>
    el.closest(".kix-page-paginated, .kix-paginateddocumentplugin")

  // Google's chrome is heavily ARIA-labelled, and those labels are translated
  // product strings rather than build output — they survive redesigns that rotate
  // every generated class name. Report them so a fix can prefer
  // [aria-label="Ruler"] over whatever .docs-*-container happens to exist today.
  const describe = (el) => {
    const r = el.getBoundingClientRect()
    return {
      tag: el.tagName.toLowerCase(),
      id: el.id || "—",
      class: (el.getAttribute("class") || "—").slice(0, 100),
      aria: el.getAttribute("aria-label") || "—",
      role: el.getAttribute("role") || "—",
      top: Math.round(r.top),
      left: Math.round(r.left),
      w: Math.round(r.width),
      h: Math.round(r.height),
    }
  }

  // Chrome hides in three places: a band across the top, and a narrow column down
  // either edge. Anything inside the paginated document itself is content, not
  // furniture, so it is excluded rather than reported as a miss.
  const isChromeRegion = (el) => {
    const r = el.getBoundingClientRect()
    if (r.width * r.height < 1500) return false
    const topBand = r.top < 240 && r.bottom > 0
    const leftRail = r.left < 90 && r.width < 140 && r.height > 60
    const rightRail =
      r.right > innerWidth - 90 && r.width < 140 && r.height > 60
    return topBand || leftRail || rightRail
  }

  const candidates = [...document.querySelectorAll("body *")]
    .filter((el) => visible(el) && !inDocumentBody(el) && isChromeRegion(el))
    .filter((el) => !el.querySelector(":scope > *") || el.children.length <= 6)

  // Document order, so a deeply-nested header spends the whole budget before the
  // report ever reaches the toolbar or the grid — and a truncated list is
  // indistinguishable from "there is nothing else down there". Say so explicitly.
  const FURNITURE_LIMIT = 120
  const furniture = candidates.slice(0, FURNITURE_LIMIT).map(describe)
  const furnitureTruncated =
    candidates.length > FURNITURE_LIMIT
      ? `${candidates.length} candidates — showing the first ${FURNITURE_LIMIT}; raise FURNITURE_LIMIT`
      : false

  // The selectors that keep missing name real, described things — Google's own ids
  // and classes say "formula", "ruler", "tabbar". Grepping the DOM for the word finds
  // what a fourth guess at the selector shape will not, and reports it whether the
  // element is currently visible or not (the formula bar can be toggled off in View).
  const HUNT = ["formula", "ruler", "tabbar", "tab-bar", "addon", "sidekick", "menu", "rail", "header-container"]
  const hunted = [...document.querySelectorAll("[id], [class]")]
    .filter((el) => {
      const haystack =
        `${el.id} ${el.getAttribute("class") || ""}`.toLowerCase()
      return HUNT.some((word) => haystack.includes(word))
    })
    .slice(0, 40)
    .map((el) => ({ ...describe(el), visible: visible(el) }))

  console.log("%cNotionish probe", "font-weight:bold;font-size:14px")
  console.log("gate:", gate)
  console.table(matches)
  console.log("visible chrome we are NOT hiding:")
  console.table(furniture)
  if (furnitureTruncated) console.warn("truncated:", furnitureTruncated)
  console.log("keyword hunt for the selectors that keep missing:")
  console.table(hunted)

  const payload = JSON.stringify(
    { gate, matches, furniture, furnitureTruncated, hunted },
    null,
    2,
  )
  try {
    copy(payload)
    console.log("%c↑ full report copied to clipboard", "color:#22C55E")
  } catch {
    console.log(payload)
  }
})()
