/**
 * The one declaration of what Notionish persists.
 *
 * Loaded as a classic script by the popup, the options page and the content
 * script, none of which can share an ES module — a manifest content script is
 * not a module, so an `import` is a syntax error there, and a background script
 * declared via "background.scripts" is classic too. This file replaces the three
 * separate `DEFAULT_PREFS` declarations that arrangement used to force.
 *
 * `DEFAULT_PREFS` stays named because content.js needs the defaults
 * synchronously, before the first storage read resolves.
 */
const DEFAULT_PREFS = {
  docsEnabled: true,
  sheetsEnabled: true,
  fontOverride: false,
  zoomFactor: 1.3,
}

const settings = webext.defineSettings(DEFAULT_PREFS, { area: "sync" })
