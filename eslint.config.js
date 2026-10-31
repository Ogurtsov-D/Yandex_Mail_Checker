// Конфигурация ESLint без внешних пакетов (запуск: npm run lint)
const browserGlobals = {
    chrome: 'readonly',
    browser: 'readonly',
    fetch: 'readonly',
    AbortController: 'readonly',
    URL: 'readonly',
    setTimeout: 'readonly',
    clearTimeout: 'readonly',
    console: 'readonly'
};

const nodeGlobals = {
    ...browserGlobals,
    process: 'readonly',
    Buffer: 'readonly',
    setImmediate: 'readonly',
    structuredClone: 'readonly'
};

const rules = {
    'no-undef': 'error',
    'no-unused-vars': ['error', { ignoreRestSiblings: true }],
    'no-unreachable': 'error',
    'no-dupe-keys': 'error',
    'no-duplicate-imports': 'error',
    'no-redeclare': 'error',
    'no-self-assign': 'error',
    'no-unsafe-finally': 'error',
    'no-async-promise-executor': 'error',
    'no-constant-condition': ['error', { checkLoops: false }],
    'no-empty': 'error',
    'no-var': 'error',
    'prefer-const': 'error',
    eqeqeq: ['error', 'smart']
};

export default [
    { ignores: ['dist/**', 'node_modules/**'] },
    {
        files: ['src/**/*.js'],
        languageOptions: { ecmaVersion: 2022, sourceType: 'module', globals: browserGlobals },
        rules
    },
    {
        files: ['tests/**/*.js', 'scripts/**/*.mjs', '*.js'],
        languageOptions: { ecmaVersion: 'latest', sourceType: 'module', globals: nodeGlobals },
        rules
    }
];
