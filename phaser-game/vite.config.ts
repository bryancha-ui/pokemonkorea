import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  server: { port: 3000 },
  build: {
    outDir: 'dist',
    // Stable framework chunks let returning mobile players reuse Phaser/Three/
    // Firebase from HTTP cache while individual story scenes remain lazy.
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (id.includes('/phaser/')) return 'vendor-phaser';
          if (id.includes('/three/')) return 'vendor-three';
          if (id.includes('/firebase/') || id.includes('/@firebase/')) return 'vendor-firebase';
          return 'vendor';
        },
      },
    },
    chunkSizeWarningLimit: 1800,
  },
});
