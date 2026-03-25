import { defineConfig, presetIcons, presetAttributify, presetWind3 } from 'unocss';

export default defineConfig({
  presets: [
    presetWind3(),
    presetAttributify(),
    presetIcons({
      collections: {
        // You can auto-install icon sets by using the collection name (e.g. mdi, carbon, fa)
        // or add specific ones you need.
      },
    }),
  ],
});
