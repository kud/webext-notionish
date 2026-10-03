import { homedir } from "node:os"
import { join } from "node:path"
import { defineConfig } from "wxt"

// `npm run dev` runs against a persistent Nightly profile so a Google sign-in
// survives between runs; `npm run dev:clean` sets NOTIONISH_DEV_CLEAN for a
// throwaway one. web-ext needs the directory to exist, which the dev script
// guarantees.
const devProfile = process.env.NOTIONISH_DEV_CLEAN
  ? undefined
  : join(homedir(), ".cache", "notionish-dev-profile")

export default defineConfig({
  manifestVersion: 2,
  // Every entrypoint imports what it uses. Auto-imports would also rewrite the
  // bare `browser` global every entrypoint here calls directly.
  imports: false,
  manifest: {
    name: "Notionish",
    description:
      "Restyles Google Docs and Sheets to read like Notion, hiding the chrome around the document.",
    browser_specific_settings: {
      gecko: {
        id: "notionish@kud.io",
        strict_min_version: "142.0",
        data_collection_permissions: {
          required: ["none"],
        },
      },
    },
    web_accessible_resources: ["fonts/inter-variable.woff2"],
    permissions: [
      "storage",
      "https://docs.google.com/*",
      "https://sheets.google.com/*",
    ],
    // Merged under the popup entrypoint's browser_action, which only supplies
    // default_popup and default_title.
    browser_action: {
      default_icon: {
        48: "icons/icon.svg",
      },
    },
    commands: {
      "toggle-focus": {
        suggested_key: {
          default: "Alt+Shift+N",
        },
        description: "Toggle Notionish focus mode on the current tab",
      },
    },
    icons: {
      48: "icons/icon.svg",
      96: "icons/icon.svg",
      128: "icons/icon.svg",
    },
  },
  webExt: {
    binaries: { firefox: "nightly" },
    firefoxProfile: devProfile,
    keepProfileChanges: devProfile !== undefined,
  },
  vite: () => ({
    build: {
      // Matches strict_min_version, so the minifier leaves color-scheme and
      // the tokens' dark-mode rules as written instead of lowering them.
      cssTarget: "firefox142",
    },
  }),
  zip: {
    excludeSources: ["web-ext-artifacts/**"],
  },
})
