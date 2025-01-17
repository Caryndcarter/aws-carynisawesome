// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  devtools: { enabled: true },
  extends: ["@nuxt/ui-pro"],
  modules: ["@nuxt/eslint", "@nuxt/test-utils/module", "@nuxt/ui"],
  compatibilityDate: "2024-12-20",
  future: {
    compatibilityVersion: 4,
  },
});
