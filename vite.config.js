import { defineConfig } from 'vite'
import solid from 'vite-plugin-solid'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig(({ mode }) => ({
  plugins: [
    solid(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'script',
      devOptions: {
        enabled: true,
        type: 'module',
      },
      strategies: 'injectManifest',
      srcDir: 'src',
      // filename: mode === 'development' ? 'dev-sw.js' : 'sw.js',
      filename: 'sw.js',
      workbox: {
        // globPatterns: ['**/*.{js,css,html,ico,png,svg,json,webmanifest,txt}'],
      },
      manifest: {
        name: 'Chores App',
        short_name: 'Chores',
        description: 'A simple app to manage chores.',
        start_url: '/',
        display: 'standalone',
        background_color: '#ffffff',
        theme_color: '#bada55',
        icons: [
          {
            src: '/android-chrome-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/android-chrome-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          }
        ],
        screenshots: [
          {
            src: '/screenshot-wide.png',
            sizes: '1834x1938',
            type: 'image/png',
            form_factor: 'wide',
            label: 'Chores App Desktop View'
          },
          {
            src: '/screenshot-mobile.png',
            sizes: '786x1750',
            type: 'image/png',
            form_factor: 'narrow',
            label: 'Chores App Mobile View'
          }
        ]
      }
    })
  ],
});
