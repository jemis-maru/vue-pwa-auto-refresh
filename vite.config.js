import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    vue(),
    VitePWA({
      registerType: "autoUpdate",
      srcDir: 'src',
      filename: 'sw.js',
      strategies: 'injectManifest',
      injectManifest: {
        injectionPoint: undefined, // Prevent Workbox from modifying your file
      },
      manifest: {
        name: "Vue 3 PWA",
        short_name: "VuePWA",
        start_url: "/",
        display: "standalone",
        background_color: "#ffffff",
        theme_color: "#42b883",
        icons: [
          {
            src: "/vite.svg",
            sizes: "192x192",
            type: "image/png",
          },
        ],
      },
      workbox: {
        runtimeCaching: [],
      },
      devOptions: {
        enabled: true,
        type: "module",
      },
    }),
  ],
});
