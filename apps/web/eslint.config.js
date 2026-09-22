import js from '@eslint/js';
import globals from 'globals';
import hooks from 'eslint-plugin-react-hooks';
import refresh from 'eslint-plugin-react-refresh';
import react from 'eslint-plugin-react';

const legacyAppDeadCode='^(CalendarDays|Inbox|Map|Users|DashCard)$';

export default [
  {ignores:['dist']},
  {
    files:['**/*.{js,jsx}'],
    languageOptions:{
      ecmaVersion:2022,
      globals:{...globals.browser,...globals.node},
      parserOptions:{ecmaVersion:'latest',ecmaFeatures:{jsx:true},sourceType:'module'}
    },
    plugins:{react,'react-hooks':hooks,'react-refresh':refresh},
    settings:{react:{version:'detect'}},
    rules:{
      ...js.configs.recommended.rules,
      ...react.configs.recommended.rules,
      ...react.configs['jsx-runtime'].rules,
      ...hooks.configs.recommended.rules,
      'no-unused-vars':['error',{argsIgnorePattern:'^_'}],
      'react/prop-types':'off',
      'react-refresh/only-export-components':['warn',{allowConstantExport:true}]
    }
  },
  {
    files:['src/App.jsx'],
    rules:{
      // Pre-existing dead imports/helper are isolated to the legacy single-file app while
      // the web surface is decomposed. All other unused variables remain CI failures.
      'no-unused-vars':['error',{argsIgnorePattern:'^_',varsIgnorePattern:legacyAppDeadCode}]
    }
  }
];
