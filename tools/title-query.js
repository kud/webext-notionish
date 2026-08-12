;(() => {
  const el = document.querySelector(".docs-title-input")
  if (!el) return console.error("Notionish: no .docs-title-input on this page")

  // Arms itself and waits, rather than measuring now. The state worth measuring is
  // rename mode, and clicking into the console to run a snippet blurs the title —
  // so any probe that reads the DOM at paste time can only ever report the resting
  // state, while reporting it as though it were the one you asked about.
  const report = () => measure()
  el.addEventListener("focus", report, { once: true })
  console.log(
    "%cArmed — click into the document title now. Measuring on focus.",
    "color:#22C55E;font-weight:bold",
  )

  function measure() {
  const cs = getComputedStyle(el)
  const header = el.closest("#docs-header-container")

  // scrollWidth > clientWidth is the whole question. Greater means the input is
  // genuinely too narrow for its own value and the text is being clipped; equal
  // means the box merely fits tightly and what looks like a cut is padding.
  console.table([
    {
      what: "input",
      value: el.value,
      inlineWidth: el.style.width || "—",
      clientWidth: el.clientWidth,
      scrollWidth: el.scrollWidth,
      clipping: el.scrollWidth > el.clientWidth ? "YES — too narrow" : "no",
      boxSizing: cs.boxSizing,
      padding: `${cs.paddingLeft} / ${cs.paddingRight}`,
      border: `${cs.borderLeftWidth} / ${cs.borderRightWidth}`,
      fontSize: cs.fontSize,
      font: cs.fontFamily.slice(0, 30),
    },
  ])

  console.log("header zoom:", header ? getComputedStyle(header).zoom : "(no header)")
  console.log(
    "--notionish-header-scale:",
    getComputedStyle(document.documentElement)
      .getPropertyValue("--notionish-header-scale")
      .trim() || "(unset)",
  )
  console.log("devicePixelRatio:", devicePixelRatio)
  }
})()
