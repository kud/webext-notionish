;(() => {
  const root = document.documentElement
  const gate = {
    surface:
      root.dataset.notionishSurface ?? "(UNSET — content.js did not gate)",
    focus: root.dataset.notionishFocus ?? "(UNSET)",
    url: location.pathname,
  }

  const SELECTORS = [
    "#docs-titlebar",
    "#docs-menubar",
    "#docs-toolbar-wrapper",
    ".docs-ruler-container",
    ".docs-tabbar-container",
    ".docs-gm-addon-bar",
    ".kix-appview-editor",
    ".kix-page",
    ".waffle",
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
    el.closest(".kix-page, .kix-paginateddocumentplugin")

  const describe = (el) => {
    const r = el.getBoundingClientRect()
    return {
      tag: el.tagName.toLowerCase(),
      id: el.id || "—",
      class: (el.getAttribute("class") || "—").slice(0, 100),
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

  const furniture = [...document.querySelectorAll("body *")]
    .filter((el) => visible(el) && !inDocumentBody(el) && isChromeRegion(el))
    .filter((el) => !el.querySelector(":scope > *") || el.children.length <= 6)
    .slice(0, 45)
    .map(describe)

  console.log("%cNotionish probe", "font-weight:bold;font-size:14px")
  console.log("gate:", gate)
  console.table(matches)
  console.log("visible chrome we are NOT hiding:")
  console.table(furniture)

  const payload = JSON.stringify({ gate, matches, furniture }, null, 2)
  try {
    copy(payload)
    console.log("%c↑ full report copied to clipboard", "color:#22C55E")
  } catch {
    console.log(payload)
  }
})()
