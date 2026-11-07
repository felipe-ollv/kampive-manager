import { defineConfig } from "vite";
export default defineConfig({
  base: "/manager/",
  server: {
    host: "127.0.0.1",
    port: 5174,
    // Real authentication is served through the existing HTTPS gateway.
    // Keep the old preview URL as an explicit redirect instead of weakening Secure cookies.
  },
  plugins: [
    {
      name: "secure-local-entry",
      configureServer(server) {
        server.middlewares.use((request, response, next) => {
          if (request.headers.accept?.includes("text/html")) {
            response.statusCode = 302;
            response.setHeader("Location", "https://localhost:8443/manager/");
            response.end();
            return;
          }
          next();
        });
      },
    },
  ],
});
