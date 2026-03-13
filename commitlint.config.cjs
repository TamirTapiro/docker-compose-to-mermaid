module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      ['feat', 'fix', 'chore', 'docs', 'test', 'refactor', 'perf', 'ci', 'build', 'revert'],
    ],
    'subject-max-length': [2, 'always', 100],
    'body-max-line-length': [0], // disable — long bodies are fine
  },
};
