module.exports = {
  root: true,
  extends: ['universe/native', 'universe/shared/typescript-analysis'],
  parserOptions: { project: './tsconfig.json' },
  rules: {
    '@typescript-eslint/no-floating-promises': 'error'
  }
};
