import { defineSettings } from "@kud/webext"

/**
 * The one declaration of what Notionish persists.
 *
 * Imported by the popup, the options page and the content script. This file
 * replaces the three separate `DEFAULT_PREFS` declarations those contexts used to
 * keep.
 */
export const settings = defineSettings(
  {
    docsEnabled: true,
    sheetsEnabled: true,
    fontOverride: false,
    zoomFactor: 1.3,
  },
  { area: "sync" },
)
