import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// IMPORTANT: Change 'running-plans' below to match your GitHub repository name exactly.
// For example, if your repo URL is https://github.com/yourname/xc-plans, set base to '/xc-plans/'
export default defineConfig({
  plugins: [react()],
  base: '/',
})
