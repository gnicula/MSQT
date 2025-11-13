/** 
 * Tailwind CSS configuration
 * ----------------------------------------------------------
 * Configures content paths, dark mode, theme extensions,
 * and plugins for the project.
 */

/** @type {import('tailwindcss').Config} */
export default {
  // Enable dark mode using a CSS class (e.g., <html class="dark">)
  darkMode: ["class"],

  // Specify files Tailwind should scan for class names
  // This ensures only used classes are included in the final build
  content: [
    "./index.html",                      // main HTML entry
    "./src/**/*.{ts,tsx,js,jsx}",        // source code files
    "./components/**/*.{ts,tsx,js,jsx}", // reusable UI components
  ],

  // Theme customization
  theme: {
    extend: {}, // placeholder for extending default Tailwind theme (colors, spacing, etc.)
  },

  // Tailwind plugins
  plugins: [], // add official or third-party plugins here if needed
};
