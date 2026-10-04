import js from '@eslint/js';
import globals from 'globals';

const sharedGlobals = Object.fromEntries(
  [
    'LMCore',
    'LMMotion',
    'LMMotifs',
    'LMLayout',
    'LMAnnotations',
    'LMChoreography',
    'LMSongProfiles',
    'LMPresets'
  ].map((name) => [name, 'readonly'])
);
const panelGlobals = Object.fromEntries(
  [
    'LMBridge',
    'LMRender',
    'LMVideo',
    'LMMP4',
    'Mp4Muxer',
    'LMLocal',
    'LMStylesUI',
    'LMTranslation',
    'LMTranslationCache',
    'LMSubtitles',
    'LMDemo'
  ].map((name) => [name, 'readonly'])
);
const aeGlobals = Object.fromEntries(
  [
    'app',
    'system',
    'File',
    'Folder',
    'CompItem',
    'FolderItem',
    'FootageItem',
    'ImportOptions',
    'Shape',
    'TextLayer',
    'ParagraphJustification',
    'KeyframeInterpolationType',
    'GetSettingsFormat',
    'RQItemStatus',
    'BlendingMode',
    'ImportAsType',
    '$'
  ].map((name) => [name, 'readonly'])
);

export default [
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      'artifacts/**',
      '.local/**',
      'reference/**',
      'coverage/**',
      'assets/vendor/**'
    ]
  },
  {
    files: ['**/*.{js,mjs,cjs,jsx}'],
    ...js.configs.recommended,
    rules: {
      ...js.configs.recommended.rules,
      'no-empty': ['error', { allowEmptyCatch: true }],
      'no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', caughtErrors: 'none', varsIgnorePattern: '^_' }
      ]
    }
  },
  {
    files: ['**/*.mjs'],
    languageOptions: { ecmaVersion: 2022, sourceType: 'module', globals: globals.node }
  },
  {
    files: ['**/*.cjs'],
    languageOptions: { ecmaVersion: 2020, sourceType: 'commonjs', globals: globals.node }
  },
  {
    files: ['src/panel/*.js', 'src/data/*.js'],
    languageOptions: {
      ecmaVersion: 2020,
      sourceType: 'script',
      globals: { ...globals.browser, ...sharedGlobals, ...panelGlobals }
    },
    // CEP in supported AE versions predates Error.cause.
    rules: { 'preserve-caught-error': 'off' }
  },
  {
    files: ['src/shared/*.js'],
    languageOptions: {
      ecmaVersion: 3,
      sourceType: 'script',
      globals: { ...sharedGlobals, module: 'readonly' }
    },
    rules: { 'no-redeclare': ['error', { builtinGlobals: false }] }
  },
  {
    files: ['src/host/*.jsx'],
    languageOptions: {
      ecmaVersion: 3,
      sourceType: 'script',
      globals: { ...aeGlobals, ...sharedGlobals, AVLayer: 'readonly' }
    },
    // ExtendScript needs escaped slashes inside regex classes and lacks Error.cause.
    rules: { 'preserve-caught-error': 'off', 'no-useless-escape': 'off' }
  },
  {
    files: [
      'tests/integration/*.mjs',
      'scripts/*panel*.mjs',
      'scripts/*demo*.mjs',
      'scripts/*sheet*.mjs',
      'scripts/research-*.mjs'
    ],
    languageOptions: { globals: { ...globals.browser, ...sharedGlobals, ...panelGlobals } }
  }
];
