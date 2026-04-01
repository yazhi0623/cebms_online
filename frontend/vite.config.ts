import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const hmrHost = env.VITE_DEV_HMR_HOST?.trim();

  return {
    plugins: [react()],
    server: {
      host: "0.0.0.0",
      port: 5173,
      strictPort: true,
      ...(hmrHost
        ? {
            hmr: {
              host: hmrHost,
              protocol: "ws" as const,
              port: 5173,
            },
          }
        : {}),
    },
    test: {
      environment: "jsdom",
      setupFiles: "./src/test/setup.ts",
    },
  };
});
