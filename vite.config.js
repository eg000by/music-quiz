import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        // Выносим тяжёлый и редко меняющийся Firebase SDK в отдельный чанк, чтобы он
        // кэшировался у вернувшихся пользователей между деплоями приложения.
        manualChunks(id) {
          if (id.includes('/firebase/') || id.includes('/@firebase/')) return 'firebase';
        },
      },
    },
  },
})
