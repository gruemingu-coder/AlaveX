import { spawnSync } from "node:child_process";

const bundles =
  process.platform === "darwin" ? "app,dmg" : process.platform === "win32" ? "msi" : "deb";

const result = spawnSync("npx", ["tauri", "build", "--bundles", bundles], {
  stdio: "inherit",
  shell: true,
});

process.exit(result.status ?? 1);
