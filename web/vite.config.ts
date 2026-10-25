/// <reference types="vitest/config" />
import { resolve } from "node:path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig, type Plugin } from "vite"
import { APP_PORT } from "./server/config.ts"
import { GOOGLE_API, createGoogleAuth } from "./server/google-auth.ts"

// `npm run dev` gets the same Google sign-in endpoints as server/serve.ts, so Drive sync
// works with hot reload too. Both use the one handler in server/google-auth.ts.
function googleAuth(): Plugin {
  return {
    name: "dsa-google-auth",
    configureServer(server) {
      const handle = createGoogleAuth({ root: import.meta.dirname })
      server.middlewares.use(GOOGLE_API, (req, res) => {
        const url = new URL(req.url ?? "/", "http://localhost")
        void handle(req, res, { route: url.pathname, query: url.searchParams, port: APP_PORT })
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), googleAuth()],
  resolve: {
    alias: {
      "@": resolve(import.meta.dirname, "./src"),
    },
  },
  server: {
    // 127.0.0.1 is the redirect address registered for Google sign-in (Desktop OAuth client)
    host: "127.0.0.1",
    port: APP_PORT,
    strictPort: true,
    // No CORS headers, like server/serve.ts: pages on other origins (another localhost port)
    // must not read what this server returns, the Google access token above all
    cors: false,
    fs: {
      // The dev server serves files from web/ as is: keep the Google secrets out of reach.
      // Setting deny replaces Vite's default list, so that list is repeated here.
      deny: [
        ".env",
        ".env.*",
        "*.{crt,pem}",
        "**/.git/**",
        "google-oauth.json",
        "google-token.json",
      ],
    },
  },
  build: {
    // Shiki grammars are split into their own lazy chunks; the warning is about those
    chunkSizeWarningLimit: 1000,
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    css: false,
  },
})
