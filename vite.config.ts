import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

/**
 * Static, host-agnostic production build. A relative base keeps asset URLs
 * valid on GitHub Pages, other subdirectory hosts, and local file previews.
 */
export default defineConfig({
  plugins: [react()],
  base: "./",
});
