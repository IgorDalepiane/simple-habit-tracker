import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Para GitHub Pages: use base igual ao nome do repo (ex: /simple-habit-tracker/)
// Para desenvolvimento local deixe base: '/'
export default defineConfig({
  plugins: [react()],
  base: process.env.GITHUB_PAGES === 'true' ? '/simple-habit-tracker/' : '/',
});
