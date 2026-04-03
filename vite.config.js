import { defineConfig } from 'vite'
import { resolve } from 'path'

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        home: resolve(__dirname, 'home.html'),
        inutech: resolve(__dirname, 'inutech.html'),
        joanie: resolve(__dirname, 'joanie.html'),
      }
    }
  }
})
