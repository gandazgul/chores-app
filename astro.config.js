// Polyfill for Astro's Vite CJS evaluator in Deno
globalThis.exports = globalThis.exports || {};
// @ts-ignore: Deno requires this polyfill
globalThis.module = globalThis.module || { exports: globalThis.exports };

import { defineConfig, passthroughImageService } from "astro/config";
import deno from "@deno/astro-adapter";
import unocss from "unocss/astro";

import solidJs from "@astrojs/solid-js";
import { assignedNagSchedulerIntegration } from "./src/scheduler/astroIntegration.ts";

// https://astro.build/config
export default defineConfig({
  output: "server",
  // middleware.ts enforces exact origin matching for ALL unsafe requests,
  // including JSON, against PUBLIC_ORIGIN behind TLS-terminating ingress.
  security: { checkOrigin: false },
  server: {
    port: 8080,
    host: "0.0.0.0",
  },
  adapter: deno({
    port: 8080,
    hostname: "0.0.0.0",
  }),
  integrations: [
    unocss({ injectReset: true }),
    solidJs(),
    assignedNagSchedulerIntegration(),
  ],
  image: {
    service: passthroughImageService(),
  },
  vite: {
    build: {
      rollupOptions: {
        external: ["node:sqlite", "@std/assert"],
      },
    },
    ssr: {
      external: ["node:sqlite"],
    },
  },
});
