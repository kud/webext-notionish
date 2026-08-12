;(() => {
  // Same guard as tools/selector-probe.js, for the same reason: run from the Browser
  // Console and every measurement below silently describes browser.xhtml — Firefox's
  // own interface — and reports a plausible ledger of gaps that belong to no
  // document at all. A wrong-document run has to fail loudly, because its output is
  // indistinguishable from a real one.
  if (!/^(docs|sheets)\.google\.com$/.test(location.hostname)) {
    console.error(
      "%cNotionish spacing probe: wrong document.%c\n" +
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
  const surface = location.pathname.startsWith("/spreadsheets")
    ? "sheets"
    : "docs"

  const gate = {
    surface: root.dataset.notionishSurface ?? "(UNSET — content.js did not gate)",
    focus: root.dataset.notionishFocus ?? "(UNSET)",
    // Measuring with the gate on tells you what the gaps are *after* Notionish; with
    // it off, what Google shipped. Both are worth having, and mixing them up is the
    // easiest way to chase a gap that a rule already closed. Toggle with Alt+Shift+N
    // and run twice.
    measuring: root.dataset.notionishFocus === "on" ? "Notionish ON" : "stock Google",
  }

  const px = (v) => Math.round(parseFloat(v) || 0)

  const label = (el) =>
    el === document.documentElement
      ? "html"
      : el === document.body
        ? "body"
        : `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ""}` +
          `${el.classList.length ? `.${[...el.classList].slice(0, 2).join(".")}` : ""}`

  // The whole point of the ledger. A gap above the page is worth nothing as a number
  // — it is worth knowing which element and which property produced it, because
  // that is the only form of the answer a CSS rule can act on.
  const box = (el) => {
    const cs = getComputedStyle(el)
    const r = el.getBoundingClientRect()
    return {
      el: label(el),
      top: Math.round(r.top),
      height: Math.round(r.height),
      marginTop: px(cs.marginTop),
      paddingTop: px(cs.paddingTop),
      borderTop: px(cs.borderTopWidth),
      marginBottom: px(cs.marginBottom),
      paddingBottom: px(cs.paddingBottom),
      position: cs.position,
      overflowY: cs.overflowY,
    }
  }

  const chainTo = (el) => {
    const chain = []
    for (let node = el; node; node = node.parentElement) chain.unshift(node)
    return chain
  }

  const ANCHORS = {
    docs: {
      page: ".kix-page-paginated",
      scroller: ".kix-appview-editor",
      header: "#docs-header-container",
    },
    sheets: {
      page: "#waffle-grid-container",
      scroller: "#waffle-grid-container",
      header: "#docs-header-container",
    },
  }[surface]

  const page = document.querySelector(ANCHORS.page)
  const header = document.querySelector(ANCHORS.header)

  if (!page) {
    console.error(
      `Notionish spacing probe: no element matches ${ANCHORS.page} — the anchor ` +
        "selector has moved. Run tools/selector-probe.js first; there is nothing to " +
        "measure from until it is correct.",
    )
    return
  }

  const boxes = chainTo(page).map(box)

  // Space between two elements that neither one's own margin or padding explains —
  // contributed by a sibling, a pseudo-element, or a positioned offset. This is the
  // number that matters: the properties above are what you can already see in the
  // inspector, and this is what you cannot.
  const ledger = chainTo(page)
    .slice(1)
    .map((el) => {
      const parent = el.parentElement
      const pcs = getComputedStyle(parent)
      const pr = parent.getBoundingClientRect()
      const contentTop = pr.top + px(pcs.borderTopWidth) + px(pcs.paddingTop)
      const gap = Math.round(el.getBoundingClientRect().top - contentTop)
      return {
        child: label(el),
        inside: label(parent),
        gapAboveChild: gap,
        explainedBy:
          gap === 0
            ? "—"
            : px(getComputedStyle(el).marginTop) === gap
              ? "the child's own margin-top"
              : "UNACCOUNTED — a sibling, ::before, or an offset",
      }
    })
    .filter((row) => row.gapAboveChild !== 0)

  // The gap the plan actually cares about, stated as one number.
  const headerToPage = header
    ? Math.round(
        page.getBoundingClientRect().top -
          header.getBoundingClientRect().bottom,
      )
    : "(no header element — selector moved?)"

  // Docs sets the page's own width and padding in the DOM, and paints the text
  // inside it to canvas. If paddingLeft here reads as a real number, the text inset
  // is DOM after all and step 9's "canvas geometry, not reachable" is wrong — the
  // same way the @font-face note was wrong. Report it rather than assume it.
  const pcs = getComputedStyle(page)
  const pageGeometry = {
    selector: ANCHORS.page,
    width: Math.round(page.getBoundingClientRect().width),
    inlineStyle: page.getAttribute("style")?.slice(0, 160) ?? "—",
    paddingTop: px(pcs.paddingTop),
    paddingLeft: px(pcs.paddingLeft),
    paddingRight: px(pcs.paddingRight),
    paddingBottom: px(pcs.paddingBottom),
    verdict:
      px(pcs.paddingLeft) > 0
        ? "padding is DOM — the text inset IS reachable, contrary to the plan"
        : "no DOM padding — the inset is canvas geometry, as assumed",
  }

  const viewport = {
    innerWidth,
    innerHeight,
    pageLeft: Math.round(page.getBoundingClientRect().left),
    pageRight: Math.round(innerWidth - page.getBoundingClientRect().right),
  }

  console.log("%cNotionish spacing probe", "font-weight:bold;font-size:14px")
  console.log("gate:", gate)
  console.log(`header bottom → page top: ${headerToPage}px`)
  console.log("page geometry:", pageGeometry)
  console.log("viewport:", viewport)
  console.log("box model, html → page:")
  console.table(boxes)
  console.log("unexplained vertical gaps:")
  console.table(ledger)

  const payload = JSON.stringify(
    { gate, surface, headerToPage, pageGeometry, viewport, boxes, ledger },
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
