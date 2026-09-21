import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  base: './', // GitHub Pagesなどのサブディレクトリ公開に対応する相対パス設定
  server: {
    port: 5173,
    open: false,
  },
  plugins: [
    {
      name: 'mobile-rewrite-plugin',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (req.url === '/mobile') {
            req.url = '/mobile/';
          }
          next();
        });
      }
    }
  ],
  build: {
    target: 'esnext',
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        mobile: resolve(__dirname, 'mobile/index.html')
      }
    }
  }
});

