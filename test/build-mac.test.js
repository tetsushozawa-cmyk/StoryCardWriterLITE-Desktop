const test = require('node:test');
const assert = require('node:assert/strict');
const { outputSettings } = require('../scripts/build-mac.js');

test('Apple Silicon版の出力先とFinder表示名を設定する', () => {
  assert.deepEqual(outputSettings('arm64'), {
    builderDirectory: 'mac-arm64',
    outputDirectory: 'mac-arm64',
    appName: 'StoryCardWriter LITE - Apple Silicon.app',
  });
});

test('Intel版の出力先とFinder表示名を設定する', () => {
  assert.deepEqual(outputSettings('x64'), {
    builderDirectory: 'mac',
    outputDirectory: 'mac-x64',
    appName: 'StoryCardWriter LITE - Intel.app',
  });
});

test('未対応アーキテクチャを拒否する', () => {
  assert.throws(() => outputSettings('universal'), /未対応のアーキテクチャ/);
});
