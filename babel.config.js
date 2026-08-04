module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    // Must stay last — it rewrites worklets for the UI thread.
    plugins: ['react-native-worklets/plugin'],
  };
};
