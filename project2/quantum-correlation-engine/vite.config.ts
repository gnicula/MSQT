// ----------------------------------------------------------
// Vite configuration
// ----------------------------------------------------------

import { defineConfig } from 'vite';       // Vite configuration helper
import react from '@vitejs/plugin-react';  // React plugin for JSX, fast refresh, and SWC support
import tsconfigPaths from 'vite-tsconfig-paths'; // Resolve TS path aliases automatically

export default defineConfig({
  // --------------------------------------------------------
  // Vite plugins
  // --------------------------------------------------------
  plugins: [
    react(),          // Enable React support with fast refresh
    tsconfigPaths(),  // Allow using TypeScript path aliases in imports
  ],
});
