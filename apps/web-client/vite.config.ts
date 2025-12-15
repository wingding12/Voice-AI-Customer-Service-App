import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  
  return {
    plugins: [react()],
    
    // Define environment variables for client-side use
    define: {
      'import.meta.env.VITE_API_URL': JSON.stringify(env.VITE_API_URL || ''),
      'import.meta.env.VITE_WS_URL': JSON.stringify(env.VITE_WS_URL || ''),
    },
    
    server: {
      port: 5173,
      proxy: {
        '/api': {
          target: env.VITE_API_URL || 'http://localhost:3001',
          changeOrigin: true,
        },
        '/socket.io': {
          target: env.VITE_API_URL || 'http://localhost:3001',
          ws: true,
        },
      },
    },
    
    // Production build settings
    build: {
      outDir: 'dist',
      sourcemap: false,
      minify: 'terser',
      rollupOptions: {
        output: {
          manualChunks: {
            vendor: ['react', 'react-dom', 'react-router-dom'],
            socket: ['socket.io-client'],
          },
        },
      },
    },
    
    // Preview settings (for serving built files)
    preview: {
      port: 5173,
    },
  };
});
