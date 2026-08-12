;(async () => {
  // Same guard as the other two probes, and it matters more here: this one refetches
  // location.href, so pointing it at the wrong document does not merely report
  // nonsense, it fetches something unrelated and reports nonsense about that.
  if (!/^(docs|sheets)\.google\.com$/.test(location.hostname)) {
    console.error(
      "%cNotionish model probe: wrong document.%c\n" +
        `Evaluating against ${location.href}\nwhich is not a Google Docs or Sheets page.`,
      "color:#EF4444;font-weight:bold;font-size:14px",
      "color:inherit",
    )
    return
  }

  // The question this probe exists to answer.
  //
  // Docs inlines its document model into the page HTML as `DOCS_modelChunk = {...}`,
  // then sets the global to undefined the moment the loader has taken it — so by the
  // time anything can run in a console, it is gone. Capturing it live needs a
  // property trap installed at document_start from a page-world script, which the
  // page's CSP may or may not permit.
  //
  // This route sidesteps all of that. The model is in the *HTML*, and a same-origin
  // fetch with credentials asks for that HTML again. If Docs serves the same
  // bootstrapped page to a fetch as it does to a navigation, there is no injection,
  // no CSP question and no timing window — just a request. If it does not, we learn
  // that here for the price of one request rather than after building the trap.
  console.log("%cNotionish model probe", "font-weight:bold;font-size:14px")
  console.log("refetching", location.href)

  const html = await fetch(location.href, { credentials: "include" })
    .then((response) =>
      response.ok
        ? response.text()
        : Promise.reject(new Error(`HTTP ${response.status}`)),
    )
    .catch((error) => {
      console.error("fetch failed:", error)
      return null
    })

  if (html === null) return

  // Brace-matching rather than a regex. The model is a single JSON object containing
  // the document's entire text, which will happily contain braces, quotes and
  // escaped quotes of its own — a lazy `/DOCS_modelChunk = (.*?);/` truncates at the
  // first `};` inside a string and hands back something that parses as valid JSON
  // while being a fragment of the document. That failure is silent and reads as
  // success, which is the worst shape available.
  const extractAt = (source, start) => {
    let depth = 0
    let inString = false
    let escaped = false
    for (let i = start; i < source.length; i++) {
      const char = source[i]
      if (inString) {
        if (escaped) escaped = false
        else if (char === "\\") escaped = true
        else if (char === '"') inString = false
        continue
      }
      if (char === '"') inString = true
      else if (char === "{") depth++
      else if (char === "}" && --depth === 0) return source.slice(start, i + 1)
    }
    return null
  }

  const MARKER = "DOCS_modelChunk = "
  const chunks = []
  for (let at = html.indexOf(MARKER); at !== -1; at = html.indexOf(MARKER, at + 1)) {
    const start = html.indexOf("{", at)
    // `DOCS_modelChunk = undefined;` appears too — a marker with no object after it
    // is that, not a parse failure.
    if (start === -1 || start > at + MARKER.length + 2) continue
    const raw = extractAt(html, start)
    if (raw) chunks.push(raw)
  }

  if (!chunks.length) {
    console.error(
      "%cNo model in the refetched HTML.%c\n" +
        `Got ${html.length} bytes back. This is the answer the probe was built to get:\n` +
        "Docs serves a different page to a fetch than to a navigation, so the refetch\n" +
        "route is out and capture has to go through a document_start property trap.\n" +
        "Check whether the response is a login page or an app shell before concluding.",
      "color:#EF4444;font-weight:bold",
      "color:inherit",
    )
    console.log("first 500 bytes:", html.slice(0, 500))
    return
  }

  const models = chunks.map((raw) => JSON.parse(raw))
  const entries = models.flatMap((model) => model.chunk ?? [])

  // Every "ty" the model uses, counted. The shape of this table is what says whether
  // the document is fully described here or only partly — a rich document with three
  // images and a nested list should show is/as/ae/te, and a count of `as` in the
  // dozens rather than the single figures.
  const byType = Object.entries(
    entries.reduce((acc, e) => ({ ...acc, [e.ty]: (acc[e.ty] ?? 0) + 1 }), {}),
  ).map(([ty, count]) => ({ ty, count }))

  const text = entries
    .filter((e) => e.ty === "is")
    .map((e) => e.s)
    .join("")

  // The model's index space starts at 1, not 0 — the sole "is" entry carries
  // "ibi": 1, and every si/ei is stated in those terms with ei inclusive. So a span
  // maps onto a JS string as slice(si - 1, ei), and getting it wrong costs exactly
  // one character at the front of every bold run, every link, every heading.
  //
  // Worth knowing how this was found: the first run of this probe printed the bold
  // runs as "rocess", "alance Transfer", "dd Transfer Pairs". Had it printed only
  // counts — 7 bold runs, 1 link, as a summary table does by default — the offset
  // would have been invisible here and would have surfaced later as a renderer that
  // bolds from the second letter of every word it is asked to bold. Print the text,
  // not the tally.
  const sliceModel = (from, to) => text.slice(from - 1, to)

  const styleSpans = entries.filter((e) => e.ty === "as")
  const byStyle = Object.entries(
    styleSpans.reduce((acc, e) => ({ ...acc, [e.st]: (acc[e.st] ?? 0) + 1 }), {}),
  ).map(([st, count]) => ({ st, count }))

  const links = styleSpans
    .filter((e) => e.sm?.lnks_link?.ulnk_url)
    .map((e) => ({
      from: e.si,
      to: e.ei,
      text: sliceModel(e.si, e.ei),
      url: e.sm.lnks_link.ulnk_url,
    }))

  const bold = styleSpans
    .filter((e) => e.sm?.ts_bd === true && e.sm?.ts_bd_i === false)
    .map((e) => ({ from: e.si, to: e.ei, text: sliceModel(e.si, e.ei) }))

  const images = entries
    .filter((e) => e.ty === "ae" && e.et === "inline")
    .map((e) => ({
      id: e.id,
      blob: e.epm?.ee_eo?.i_cid ?? "—",
      width: e.epm?.ee_eo?.i_wth ?? "—",
      height: e.epm?.ee_eo?.i_ht ?? "—",
    }))

  const placements = entries
    .filter((e) => e.ty === "te")
    .map((e) => ({ id: e.id, atIndex: e.spi }))

  console.log(
    `%c✓ model captured — ${chunks.length} chunk(s), ${text.length} chars of text`,
    "color:#22C55E;font-weight:bold;font-size:14px",
  )
  console.log("revision:", models.map((m) => m.revision).join(", "))
  console.log("entry types:")
  console.table(byType)
  console.log("style spans by kind:")
  console.table(byStyle)
  console.log(`links (${links.length}):`)
  console.table(links)
  console.log(`bold runs (${bold.length}):`)
  console.table(bold.slice(0, 20))
  console.log(`images (${images.length}) and where they sit:`)
  console.table(images)
  console.table(placements)
  console.log("first 600 chars of document text:\n", text.slice(0, 600))

  // Inline images occupy one character in the text — a literal "*" at the index each
  // "te" entry names. A renderer has to replace those rather than print them, and
  // has to do it before any span offsets are recomputed against its own output.
  console.log(
    "entity placeholders (should each read \"*\"):",
    placements.map((p) => JSON.stringify(sliceModel(p.atIndex, p.atIndex))),
  )

  // Left on the window deliberately. The summary above answers "did it work"; the
  // next question is always "what does <this bit> look like", and that wants poking
  // at by hand rather than another probe run.
  window.__notionishModel = { models, entries, text }
  console.log(
    "%cwindow.__notionishModel is set — { models, entries, text }",
    "color:#615d59",
  )
})()
