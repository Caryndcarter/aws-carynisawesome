// @ts-check
import jaypie from "@jaypie/eslint";
import { withNuxt } from "./.nuxt/eslint.config.mjs";

export default withNuxt(...jaypie, {
  languageOptions: {
    globals: {
      defineNuxtConfig: "readonly",
    },
  },
  rules: {
    "@typescript-eslint/no-explicit-any": "off",
  },
});
