import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },
  build: {
    // This configuration prevents console.log and debugger statements
    // from being stripped out during the production build process.
    // It's useful for debugging deployed applications.
    // For final production builds where you don't need console logs,
    // you would typically set drop_console and drop_debugger to true.
    minify: 'terser', // Ensure Terser is used for minification
    terserOptions: {
      compress: {
        drop_console: false, // Set to false to keep console.log statements
        drop_debugger: false, // Set to false to keep debugger statements
      },
      // You can add other Terser options here if needed
    },
  },
});