import "./globals.css";
import type { Metadata } from "next";
import { Inter, Roboto_Mono } from "next/font/google";

/* ===========================================================
   Font configuration
   -----------------------------------------------------------
   We load Google Fonts (Inter for sans-serif, Roboto Mono for monospace)
   using Next/font. Each is assigned to a CSS variable so it can be
   referenced in Tailwind or global CSS tokens.
   =========================================================== */
const sans = Inter({
  subsets: ["latin"],        // only load Latin characters
  display: "swap",           // render fallback font until loaded
  variable: "--font-sans",   // bind to CSS variable for global use
});

const mono = Roboto_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-mono",
});


/* ===========================================================
   Metadata
   -----------------------------------------------------------
   Next.js will inject this metadata into the <head> tag.
   Used by browsers, crawlers, and link previews.
   =========================================================== */
export const metadata: Metadata = {
  title: "MSQT — Bloch Sphere",
  description: "Single-qubit gates, noise channels, and Bloch sphere visualization",
};


/* ===========================================================
   Root Layout
   -----------------------------------------------------------
   Wraps all pages in a consistent HTML shell.
   - Applies font variables as class names on <html>, making them
     available globally through CSS variables (--font-sans/--font-mono).
   - Applies Tailwind utilities on <body> for default font & colors.
   =========================================================== */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable}`}>
      <body className="font-sans bg-black text-zinc-100">
        {children}
      </body>
    </html>
  );
}
