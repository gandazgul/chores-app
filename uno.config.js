import {
  defineConfig,
  presetAttributify,
  presetIcons,
  presetWind3,
} from "unocss";
import mdi from "@iconify-json/mdi/icons.json" with { type: "json" };

export default defineConfig({
  theme: {
    colors: {
      primary: "#005f6a",
      accent: "#ffbf00",
      "primary-bg": "#ffffff",
      "primary-text": "#1f2937",
      "muted-text": "#6b7280",
    },
  },
  presets: [
    presetWind3(),
    presetAttributify(),
    presetIcons({
      collections: {
        mdi: () => mdi,
      },
    }),
  ],
});
