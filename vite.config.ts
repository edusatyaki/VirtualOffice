import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // Relative asset paths so the build works under /VirtualOffice/ on GitHub Pages.
  base: './',
  plugins: [react()],
  server: { port: 5190, strictPort: true },
});
