import { defineConfig } from 'vite';
import { createNotlyServer } from './sunucu/server';

export default defineConfig({
  server: {
    port: 5173,
  },
  plugins: [
    {
      name: 'notly-embedded-api-server',
      configureServer(viteServer) {
        const apiServer = createNotlyServer();
        viteServer.middlewares.use((req, res, next) => {
          if (req.url && req.url.startsWith('/api/')) {
            apiServer.emit('request', req, res);
          } else {
            next();
          }
        });
      },
    },
  ],
});
