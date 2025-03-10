import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'
export default defineConfig({
  plugins: [
    tailwindcss(),
  ],
  server: {
    allowedHosts: [
      'db85-2409-40f2-304c-c52a-6d0a-945b-fe95-818f.ngrok-free.app',
      'e4dc-2409-40f2-304c-c52a-6d0a-945b-fe95-818f.ngrok-free.app',
      'fece-2400-4f20-11-c00-31e9-c732-86d7-87c9.ngrok-free.app'
    ]
  }
})