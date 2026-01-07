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
    action: {},
    web_accessible_resources: [
      {
        resources: ["content-scripts/content.css"],
        matches: ["<all_urls>"],
      },
    ],
    browser_specific_settings: {
      gecko: {
        id: "readlite@zhongyi.dev",
        strict_min_version: "109.0",
      },
    },
  },
});
