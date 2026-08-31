module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      [
        'babel-preset-expo',
        {
          // src/lib/install-message-event-polyfill.ts deep-requires a private
          // react-native module on purpose (RN doesn't expose MessageEvent as
          // a global) — silence the resulting dev-only deprecation warning.
          disableDeepImportWarnings: true,
        },
      ],
    ],
  };
};
