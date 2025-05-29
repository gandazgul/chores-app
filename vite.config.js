import { defineConfig } from 'vite'
import solid from 'vite-plugin-solid'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    solid(),
    VitePWA({
      registerType: 'autoUpdate', // Automatically update the service worker when a new version is available
      injectRegister: 'script', // Use 'script' to let the plugin handle registration via virtual module
      devOptions: {
        enabled: true,
        type: 'module',
        /* when using generateSW the PWA plugin will switch to classic */
        // navigateFallback: 'index.html', 
        // suppressWarnings: true,
      },
      strategies: 'injectManifest', // Explicitly set the strategy
      srcDir: 'src', // directory where sw.js is located
      filename: 'sw.js', // name of the service worker file
      workbox: {
        // globPatterns: ['**/*.{js,css,html,ico,png,svg,json,webmanifest,txt}'], // Default, adjust if needed
        // swDest is not needed here, it's controlled by srcDir and filename for injectManifest
        // For injectManifest strategy, swSrc is configured via srcDir and filename options at the plugin root
        // injectionPoint is not needed here as it's handled by the plugin
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
})
