const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");
const path = require("path");

const config = getDefaultConfig(__dirname);

// Allow Metro to resolve files from the parent convex/ directory
config.watchFolders = [path.resolve(__dirname, "../convex")];

module.exports = withNativeWind(config, { input: "./global.css" });
