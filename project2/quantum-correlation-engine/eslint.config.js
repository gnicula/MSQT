// ----------------------------------------------------------
// ESLint configuration for a TypeScript + React project
// ----------------------------------------------------------

import js from '@eslint/js';                           // Base ESLint JS rules
import globals from 'globals';                        // Predefined global variables
import reactHooks from 'eslint-plugin-react-hooks';   // Lint rules for React hooks
import reactRefresh from 'eslint-plugin-react-refresh'; // Lint rules for Vite React Refresh
import tseslint from 'typescript-eslint';            // TypeScript-specific lint rules
import { defineConfig, globalIgnores } from 'eslint/config'; // ESLint config helpers

// Export ESLint configuration using the new "defineConfig" API
export default defineConfig([
  // --------------------------------------------------------
  // Global ignores
  // --------------------------------------------------------
  globalIgnores(['dist']),  // Ignore build output directory

  // --------------------------------------------------------
  // Main linting rules for TS/TSX files
  // --------------------------------------------------------
  {
    files: ['**/*.{ts,tsx}'],   // Apply only to TypeScript files
    extends: [
      js.configs.recommended,                   // Standard JS rules
      tseslint.configs.recommended,             // Recommended TypeScript rules
      reactHooks.configs['recommended-latest'], // React hooks rules
      reactRefresh.configs.vite,                // Vite + React Refresh integration
    ],
    languageOptions: {
      ecmaVersion: 2020,        // Allow modern JS syntax
      globals: globals.browser, // Browser globals like `window` and `document`
    },
  },
]);
