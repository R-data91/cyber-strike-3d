import { defineConfig } from 'vite';

export default defineConfig({
  base: './', // GitHub Pagesなどのサブディレクトリ公開に対応する相対パス設定
  server: {
    port: 5173,
    open: false,
  },
  build: {
    target: 'esnext',
  }
});
