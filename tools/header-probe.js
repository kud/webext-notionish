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
  // Sprite-sheet icons report the entire sheet as their box — 7692px wide, starting
  // thousands of pixels off-screen left — so a gap measured either side of one is
  // meaningless, and a table full of them buries the handful of rows that are not.
  // Excluded by shape rather than by class name: anything wider than the header it
  // sits in is not a thing in the header's layout.
  const bandWidth = header.getBoundingClientRect().width

  const leaves = [...header.querySelectorAll("*")]
    .filter(visible)
    .filter((el) => ![...el.children].some(visible))
    .filter((el) => el.getBoundingClientRect().width <= bandWidth)
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

  // Backgrounds sit on containers, and the gap table above deliberately reports only
  // leaves — so a two-tone band is invisible in it. Asked separately: every element
  // in the header actually painting a colour, whatever its depth.
  //
  // Reported as a list of what IS painted rather than a check of what should be,
  // because the elements keeping Docs' header colour are exactly the ones nobody
  // thought to name. Deciding which to clear is a judgement about each colour — the
  // Share pill's blue is wanted and the band's #f9fbfd is not — so the probe hands
  // back colours and lets that call be made with them in view.
  const painted = [...header.querySelectorAll("*")]
    .filter(visible)
    .filter((el) => {
      const bg = getComputedStyle(el).backgroundColor
      return bg !== "transparent" && !/rgba\(0, 0, 0, 0\)/.test(bg)
    })
    .map((el) => {
      const r = el.getBoundingClientRect()
      return {
        el: label(el),
        bg: getComputedStyle(el).backgroundColor,
        left: Math.round(r.left),
        right: Math.round(r.right),
        w: Math.round(r.width),
        h: Math.round(r.height),
        depth: (() => {
          let d = 0
          for (let n = el; n && n !== header; n = n.parentElement) d++
          return d
        })(),
      }
    })
    .sort((a, b) => a.left - b.left)

  console.log("painted backgrounds in the header:")
  console.table(painted)

  // A tint the header does not paint is still a tint you can see — it comes from an
  // ancestor showing through, or a sibling sitting behind. Both are outside every
  // query above, so the band can read as two-tone while this probe reports one
  // painted region and nothing wrong. Walk up as well as down.
  const behind = []
  for (let el = header.parentElement; el && el !== document.documentElement; el = el.parentElement) {
    const cs = getComputedStyle(el)
    behind.push({
      el: label(el),
      bgColor: cs.backgroundColor,
      bgImage: cs.backgroundImage === "none" ? "—" : cs.backgroundImage.slice(0, 50),
      w: Math.round(el.getBoundingClientRect().width),
    })
  }
  console.log("ancestors behind the header:")
  console.table(behind)

  // Reported separately because background-image is invisible to a background-color
  // rule, and a cleared colour over a surviving gradient is another change that
  // looks exactly like no change.
  const imaged = [...header.querySelectorAll("*")]
    .filter(visible)
    .filter((el) => getComputedStyle(el).backgroundImage !== "none")
    .filter((el) => el.getBoundingClientRect().width <= bandWidth)
    .map((el) => ({
      el: label(el),
      bgImage: getComputedStyle(el).backgroundImage.slice(0, 60),
      left: Math.round(el.getBoundingClientRect().left),
      w: Math.round(el.getBoundingClientRect().width),
    }))
  console.log("background images in the header:")
  console.table(imaged)

  const payload = JSON.stringify({ row, painted }, null, 2)
  try {
    copy(payload)
    console.log("%c↑ copied to clipboard", "color:#22C55E")
  } catch {
    console.log(payload)
  }
})()
