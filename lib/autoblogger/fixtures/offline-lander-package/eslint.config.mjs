const config = [{
  files: ['**/*.mjs'],
  languageOptions: { ecmaVersion: 'latest', sourceType: 'module', globals: { console: 'readonly' } },
  rules: { 'no-undef': 'error', 'no-unused-vars': 'error', 'no-unreachable': 'error', 'valid-typeof': 'error' },
}];
export default config;
