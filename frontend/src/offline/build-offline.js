const esbuild = require("esbuild");
const path = require("path");

esbuild
  .build({
    entryPoints: [path.join(__dirname, "index.tsx")],
    bundle: true,
    outfile: path.join(__dirname, "../../../backend/app/static/offline_player.js"),
    minify: true,
    sourcemap: false,
    target: ["es2020"],
    loader: {
      ".png": "dataurl",
      ".svg": "text",
      ".css": "text",
    },
    alias: {
      "@/stores/app/useUserStore": path.resolve(__dirname, "mocks/useUserStore.ts"),
      "@": path.resolve(__dirname, "../"),
    },
    define: {
      "process.env.NODE_ENV": '"production"',
    },
    jsx: "automatic",
  })
  .then(() => {
    console.log("離線播放器打包成功：backend/app/static/offline_player.js");
  })
  .catch((err) => {
    console.error("離線播放器打包失敗：", err);
    process.exit(1);
  });
