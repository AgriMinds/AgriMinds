// Monorepo-aware Metro config (pnpm workspace with hoisted node_modules at the repo root).
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '..');

const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

// Block react-native-worklets from being bundled — it conflicts with reanimated 4.x
// which ships its own worklets runtime.
const { exclusionList } = require('metro-config');
config.resolver.blockList = exclusionList([
  /node_modules\/react-native-worklets\/.*/,
]);

module.exports = config;
