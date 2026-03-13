module.exports = {
  'packages/*/src/**/*.ts': [
    'eslint --fix',
    'prettier --write',
  ],
  '*.{json,yaml,yml,md}': [
    'prettier --write',
  ],
};
