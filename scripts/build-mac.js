const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const PRODUCT_NAME = 'StoryCardWriter LITE';
const ARCHITECTURES = Object.freeze({
  arm64: {
    builderDirectory: 'mac-arm64',
    outputDirectory: 'mac-arm64',
    appName: `${PRODUCT_NAME} - Apple Silicon.app`,
  },
  x64: {
    builderDirectory: 'mac',
    outputDirectory: 'mac-x64',
    appName: `${PRODUCT_NAME} - Intel.app`,
  },
});

function outputSettings(arch) {
  const settings = ARCHITECTURES[arch];
  if (!settings) throw new Error(`未対応のアーキテクチャです: ${arch}`);
  return settings;
}

function finalizeMacOutput(projectDirectory, arch) {
  const settings = outputSettings(arch);
  const distDirectory = path.join(projectDirectory, 'dist');
  const builderDirectory = path.join(distDirectory, settings.builderDirectory);
  const outputDirectory = path.join(distDirectory, settings.outputDirectory);

  if (builderDirectory !== outputDirectory) {
    fs.rmSync(outputDirectory, { recursive: true, force: true });
    fs.renameSync(builderDirectory, outputDirectory);
  }

  const originalApp = path.join(outputDirectory, `${PRODUCT_NAME}.app`);
  const namedApp = path.join(outputDirectory, settings.appName);
  fs.rmSync(namedApp, { recursive: true, force: true });
  fs.renameSync(originalApp, namedApp);
  return namedApp;
}

function build(arch) {
  outputSettings(arch);
  const projectDirectory = path.resolve(__dirname, '..');
  const builderCli = require.resolve('electron-builder/cli.js');
  const result = spawnSync(
    process.execPath,
    [builderCli, '--mac', 'dir', `--${arch}`],
    { cwd: projectDirectory, stdio: 'inherit' },
  );
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);

  const appPath = finalizeMacOutput(projectDirectory, arch);
  console.log(`Macアプリを生成しました: ${appPath}`);
}

if (require.main === module) build(process.argv[2] || 'x64');

module.exports = Object.freeze({ ARCHITECTURES, outputSettings, finalizeMacOutput });
