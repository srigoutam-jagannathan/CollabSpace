const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);

// .claude/worktrees holds other checkouts of this repo (each with its own
// node_modules); Metro must not watch or resolve from them.
config.resolver.blockList = [
  ...[].concat(config.resolver.blockList ?? []),
  /[\\/]\.claude[\\/]worktrees[\\/].*/,
];

module.exports = withNativeWind(config, { input: "./global.css" });
