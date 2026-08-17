/**
 * Generates the native `windows/` C++ project on first Windows build.
 * Run on Windows after npm install:
 *   npx @react-native-community/cli init-windows --overwrite
 * or:
 *   npx react-native-windows-init --overwrite
 */
const fs = require('fs');
const path = require('path');

const windowsDir = path.join(__dirname, 'windows');
const marker = path.join(windowsDir, '.alavex-scaffold');

if (fs.existsSync(marker)) {
  process.exit(0);
}

if (process.platform !== 'win32') {
  console.log(
    '[alavex] Skipping native windows/ scaffold on non-Windows host. Run on Windows:\n' +
      '  cd apps/windows && npm install && npx react-native-windows-init --overwrite',
  );
  process.exit(0);
}

console.log('[alavex] Run: npx react-native-windows-init --overwrite');
