export const DEFAULT_PREFS = {
  docsEnabled: true,
  sheetsEnabled: true,
  fontOverride: false,
  zoomFactor: 1.3,
}

export const getPrefs = () => browser.storage.sync.get(DEFAULT_PREFS)

export const setPrefs = (prefs) => browser.storage.sync.set(prefs)
