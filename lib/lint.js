const {ESLint} = require('eslint');
const path = require('path');
const fs = require('fs');
const globals = require('globals');

function getBaseRules() {
  return {
    'no-cond-assign': 'off',
    'no-irregular-whitespace': 'error',
    'no-unexpected-multiline': 'error',
    'curly': ['error', 'multi-line'],
    'guard-for-in': 'error',
    'no-caller': 'error',
    'no-extend-native': 'error',
    'no-extra-bind': 'error',
    'no-invalid-this': 'off',
    'no-multi-spaces': 'error',
    'no-multi-str': 'error',
    'no-new-wrappers': 'error',
    'no-throw-literal': 'error',
    'no-with': 'error',
    'prefer-promise-reject-errors': 'error',
    'no-unused-vars': ['error', {
      args: 'none',
      caughtErrors: 'none',
      varsIgnorePattern: '^_',
    }],
    'array-bracket-spacing': ['error', 'never'],
    'block-spacing': ['error', 'never'],
    'brace-style': 'error',
    'camelcase': ['error', {properties: 'never'}],
    'comma-spacing': 'error',
    'comma-style': 'error',
    'computed-property-spacing': 'error',
    'eol-last': ['error', 'always'],
    'func-call-spacing': 'error',
    'key-spacing': 'error',
    'keyword-spacing': 'error',
    'linebreak-style': 'error',
    'max-len': ['error', {
      code: 120,
      tabWidth: 2,
      ignoreUrls: true,
      ignoreStrings: true,
      ignoreTemplateLiterals: true,
      ignoreRegExpLiterals: true,
      ignoreComments: true,
    }],
    'new-cap': 'error',
    'no-array-constructor': 'error',
    'no-mixed-spaces-and-tabs': 'error',
    'no-multiple-empty-lines': ['error', {max: 2}],
    'no-new-object': 'error',
    'no-tabs': 'error',
    'no-trailing-spaces': 'error',
    'one-var': ['error', {
      var: 'never',
      let: 'never',
      const: 'never',
    }],
    'operator-linebreak': 'off',
    'padded-blocks': ['error', 'never'],
    'quotes': [
      'error',
      'single',
      {avoidEscape: true, allowTemplateLiterals: true},
    ],
    'require-jsdoc': 'off',
    'valid-jsdoc': 'off',
    'semi': ['error', 'always'],
    'semi-spacing': 'error',
    'space-before-blocks': 'error',
    'spaced-comment': ['error', 'always'],
    'switch-colon-spacing': 'error',
    'arrow-parens': ['error', 'always'],
    'constructor-super': 'error',
    'generator-star-spacing': ['error', 'after'],
    'no-new-symbol': 'error',
    'no-this-before-super': 'error',
    'no-var': 'error',
    'prefer-const': ['error', {destructuring: 'all'}],
    'prefer-rest-params': 'error',
    'prefer-spread': 'error',
    'rest-spread-spacing': 'error',
    'yield-star-spacing': ['error', 'after'],
    'no-console': 'off',
  };
}

function getConfig(customOverrides = {}) {
  const baseRules = Object.assign(getBaseRules(), customOverrides.rules || {});

  return [
    {
      ignores: [
        '**/node_modules/**',
        '**/dist/**',
        '**/build/**',
        '**/coverage/**',
        '**/.git/**',
      ],
    },
    // Node / CommonJS files (lib, bin, root index, etc.)
    {
      files: ['**/*.js', '**/*.cjs'],
      ignores: ['static/**', 'test/**'],
      languageOptions: {
        ecmaVersion: 2022,
        sourceType: 'commonjs',
        globals: {
          ...globals.node,
          ...globals.es2021,
        },
      },
      rules: baseRules,
    },
    // Test files (Mocha, Node)
    {
      files: ['test/**/*.js', '**/*.test.js', '**/*.spec.js'],
      languageOptions: {
        ecmaVersion: 2022,
        sourceType: 'commonjs',
        globals: {
          ...globals.node,
          ...globals.mocha,
          ...globals.es2021,
        },
      },
      rules: baseRules,
    },
    // Frontend / Client files (static) - ES Modules & Browser
    {
      files: ['static/**/*.js', '**/*.mjs'],
      languageOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
        globals: {
          ...globals.browser,
          ...globals.es2021,
        },
      },
      rules: baseRules,
    },
  ];
}

async function run(args = [], cwd = process.cwd()) {
  const fix = args.includes('--fix');
  const rawPaths = args.filter((arg) => !arg.startsWith('--'));

  let targetPaths = rawPaths;
  if (targetPaths.length === 0) {
    const candidates = ['lib', 'test', 'static', 'bin', 'index.js'];
    targetPaths = candidates.filter((item) =>
      fs.existsSync(path.join(cwd, item)));
    if (targetPaths.length === 0) {
      targetPaths = ['.'];
    }
  }

  const eslint = new ESLint({
    cwd,
    fix,
    overrideConfigFile: true,
    overrideConfig: getConfig(),
  });

  const results = await eslint.lintFiles(targetPaths);

  if (fix) {
    await ESLint.outputFixes(results);
  }

  const formatter = await eslint.loadFormatter('stylish');
  const resultText = formatter.format(results);

  if (resultText && resultText.trim()) {
    console.log(resultText);
  }

  const errorCount = results.reduce((acc, r) => acc + r.errorCount, 0);

  if (errorCount === 0) {
    const fileCount = results.length;
    if (!resultText || !resultText.trim()) {
      console.log(
          `✔ Apper Lint passed: ${fileCount} file(s) checked with 0 errors.`,
      );
    }
    return 0;
  }

  return 1;
}

module.exports = {
  getBaseRules,
  getConfig,
  run,
};
