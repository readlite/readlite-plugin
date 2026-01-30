import { defineConfig } from 'wxt';

export default defineConfig({
    modules: ['@wxt-dev/module-react', '@wxt-dev/i18n/module'],
    imports: false,
    manifest: {
      name: "ReadLite - Simple Reading Mode",
    description: "A simple reading mode extension to make web reading more comfortable",
    version: "1.0.9",
    permissions: ["activeTab", "scripting", "storage"],
    host_permissions: ["<all_urls>"],
    default_locale: "en",
    action: {
      default_icon: {
        "16": "assets/icon-16.png",
        "32": "assets/icon-32.png",
        "48": "assets/icon-48.png",
        "128": "assets/icon-128.png",
      },
    },
    icons: {
      "16": "assets/icon-16.png",
      "32": "assets/icon-32.png",
      "48": "assets/icon-48.png",
      "128": "assets/icon-128.png",
    },
    web_accessible_resources: [
      {
        resources: ["content-scripts/content.css"],
        matches: ["<all_urls>"],
      },
      {
        resources: ["assets/fonts/*", "assets/icon-*.png"],
        matches: ["<all_urls>"],
      },
    ],
    browser_specific_settings: {
      gecko: {
        id: "readlite@zhongyi.dev",
        strict_min_version: "140.0",
        // @ts-ignore Firefox requires this key; wxt types don't include yet
        data_collection_permissions: {
          required: ["none"],
        },
      },
    },
  },
});
