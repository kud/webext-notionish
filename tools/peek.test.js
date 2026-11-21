// Pins the hover-reveal decision in src/content.js without a browser.
// Run with: node --test tools/peek.test.js
//
// content.js is a classic content script, not a module, so it is evaluated in a
// vm context with just enough of the WebExtension globals stubbed for its top level
// to run. The URL is a Slides deck — a surface Notionish ignores — so no listener is
// wired and only the declarations remain, which later scripts in the same context
// can call.
import { test } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import vm from "node:vm"

const source = readFileSync(
  new URL("../src/content.js", import.meta.url),
  "utf8",
)

const context = vm.createContext({
  URL,
  location: { href: "https://docs.google.com/presentation/d/x/edit" },
  settings: { defaults: {} },
  window: { dispatchEvent() {}, addEventListener() {}, innerWidth: 1200 },
  Event: class {},
  document: { documentElement: { dataset: {} } },
})
vm.runInContext(source, context)

const peekWanted = (state) =>
  vm.runInContext("peekWanted", context)(state)

// An element stand-in: closest() answers for whichever selectors it was built to
// sit inside, the way a real element would for its ancestors.
const inside = (...selectors) => ({
  closest(list) {
    const hit = list.split(",").some((s) => selectors.includes(s.trim()))
    return hit ? this : null
  },
})

const page = inside(".kix-appview-editor")
const header = inside("#docs-header-container")
const bars = inside("#docs-bars")
const menu = inside(".goog-menu")

test("the header band reveals the row", () => {
  assert.equal(peekWanted({ peeking: false, y: 40, target: header }), true)
})

test("the top edge reveals the row even if the band is renamed", () => {
  assert.equal(peekWanted({ peeking: false, y: 0, target: page }), true)
  assert.equal(peekWanted({ peeking: false, y: 6, target: page }), true)
  assert.equal(peekWanted({ peeking: false, y: 7, target: page }), false)
})

test("the document never reveals the row", () => {
  assert.equal(peekWanted({ peeking: false, y: 300, target: page }), false)
})

test("the revealed row and its menus hold it open", () => {
  assert.equal(peekWanted({ peeking: true, y: 90, target: bars }), true)
  assert.equal(peekWanted({ peeking: true, y: 200, target: menu }), true)
})

test("the row and its menus do not reveal it on their own", () => {
  // A stray menu (a right-click on the page) must not pull the toolbar in.
  assert.equal(peekWanted({ peeking: false, y: 200, target: menu }), false)
})

test("leaving for the document lets it go", () => {
  assert.equal(peekWanted({ peeking: true, y: 300, target: page }), false)
})

test("a target without closest() is treated as outside", () => {
  assert.equal(peekWanted({ peeking: true, y: 300, target: null }), false)
  assert.equal(peekWanted({ peeking: true, y: 300, target: {} }), false)
})
