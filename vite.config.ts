import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    target: 'es2022',
    sourcemap: true,
    modulePreload: { polyfill: false },
  },
  test: {
    environment: 'node',
    coverage: {
      reporter: ['text', 'json-summary'],
    },
  },
});
