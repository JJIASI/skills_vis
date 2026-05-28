import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import os from "os";

export default defineConfig({
  define: {
    __HOME__: JSON.stringify(os.homedir()),
  },
  plugins: [vue()],
  server: {
    proxy: {
      "/api": "http://127.0.0.1:8001",
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setupCanvas.js"],
  },
});
