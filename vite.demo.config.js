// Build da versão de demonstração (npm run build:demo).
// Troca src/lib/supabase.js pelo banco de mentira em memória (src/demo/supabaseDemo.js),
// então a demo nunca acessa o Supabase real.
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [{ find: /^(\.\.?\/)+(lib\/)?supabase$/, replacement: fileURLToPath(new URL('./src/demo/supabaseDemo.js', import.meta.url)) }]
  },
  build: {
    outDir: 'dist-demo',
    rollupOptions: { input: 'demo.html' }
  }
})
