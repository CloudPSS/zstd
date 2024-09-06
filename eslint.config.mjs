import eslint from '@cloudpss/eslint-config';

export default eslint({
  rules: {
    '@typescript-eslint/no-floating-promises': [
      'error',
      {
        allowForKnownSafeCalls: [
          {
            from: 'package',
            package: 'node:test',
            name: ['test', 'it', 'describe', 'suite', 'only', 'skip', 'todo'],
          },
        ],
      },
    ],
  },
});
