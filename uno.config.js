import { defineConfig, presetIcons, presetAttributify, presetWind3 } from 'unocss';
import mdi from "@iconify-json/mdi/icons.json" with { type: "json" };

export default defineConfig({
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
