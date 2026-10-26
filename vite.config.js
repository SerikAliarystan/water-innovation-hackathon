import { defineConfig } from 'vite';

// base: './' — сайт работает из любой подпапки (GitHub Pages, любой статический хостинг)
export default defineConfig({
  base: './',
  build: { target: 'es2019', cssCodeSplit: false, assetsInlineLimit: 8192 },
});
