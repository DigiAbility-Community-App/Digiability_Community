module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      [
        'module-resolver',
        {
          root: ['./'],
          alias: {
            '@assets': './assets',
            '@components': './src/components',
            '@screens': './src/screens',
            '@navigation': './src/navigation',
            '@hooks': './src/hooks',
            '@store': './src/store',
            '@services': './src/services',
            '@utils': './src/utils',
            '@config': './src/config',
          },
        },
      ],
    ],
    env: {
      // Release bundles (EAS sets NODE_ENV=production) ship without
      // console.log/info/debug — they leak data to `adb logcat` and cost
      // performance. error/warn stay for crash diagnosis.
      production: {
        plugins: [['transform-remove-console', { exclude: ['error', 'warn'] }]],
      },
    },
  };
};