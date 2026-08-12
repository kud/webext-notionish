;(() => {
  // The horizontal twin of tools/spacing-probe.js. That one asks which element owns
  // each vertical gap between the header and the page; this asks the same question
  // along the header row itself, where the answer decides whether a fix belongs on
  // the element, its neighbour, or the flex container holding both.
  const header = document.querySelector("#docs-header-container")
  if (!header) {
    return console.error(
      "Notionish: no #docs-header-container — wrong page, or the selector moved. " +
        "Run npm run probe:selectors before trusting anything else.",
    )
  }

  const px = (v) => Math.round((parseFloat(v) || 0) * 100) / 100

  const label = (el) =>
    `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ""}` +
    `${el.classList.length ? `.${[...el.classList].slice(0, 2).join(".")}` : ""}`

  const visible = (el) => {
    const r = el.getBoundingClientRect()
    return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== "hidden"
  }

  // Leaves rather than every node. A container's rect spans its children, so
  // reporting both produces a list where half the entries overlap the other half and
  // no gap in it means anything.
  const leaves = [...header.querySelectorAll("*")]
    .filter(visible)
    .filter((el) => ![...el.children].some(visible))
    .sort((a, b) => a.getBoundingClientRect().left - b.getBoundingClientRect().left)

  let previous = null
  const row = leaves.map((el) => {
    const r = el.getBoundingClientRect()
    const cs = getComputedStyle(el)
    const parent = getComputedStyle(el.parentElement)
    const gap = previous
      ? Math.round(r.left - previous.getBoundingClientRect().right)
      : "—"
    previous = el
    return {
      el: label(el),
      text: (el.value ?? el.textContent ?? "").trim().slice(0, 22) || "—",
      gapBefore: gap,
      left: Math.round(r.left),
      w: Math.round(r.width),
      h: Math.round(r.height),
      marginX: `${px(cs.marginLeft)} / ${px(cs.marginRight)}`,
      paddingX: `${px(cs.paddingLeft)} / ${px(cs.paddingRight)}`,
      parent: label(el.parentElement),
      parentDisplay: parent.display,
      parentGap: parent.gap === "normal" ? "—" : parent.gap,
      parentAlign: parent.alignItems,
    }
  })

  console.log("%cNotionish header probe", "font-weight:bold;font-size:14px")
  console.log(
    "header zoom:",
    getComputedStyle(header).zoom,
    "· band height:",
    Math.round(header.getBoundingClientRect().height),
    "· scale var:",
    getComputedStyle(document.documentElement)
      .getPropertyValue("--notionish-header-scale")
      .trim() || "(unset)",
  )
  console.table(row)

  const payload = JSON.stringify(row, null, 2)
  try {
    copy(payload)
    console.log("%c↑ copied to clipboard", "color:#22C55E")
  } catch {
    console.log(payload)
  }
})()
