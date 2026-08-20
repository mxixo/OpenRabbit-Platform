import js from '@eslint/js';
import globals from 'globals';
import hooks from 'eslint-plugin-react-hooks';
import refresh from 'eslint-plugin-react-refresh';
import react from 'eslint-plugin-react';
export default [{ignores:['dist']},{files:['**/*.{js,jsx}'],languageOptions:{ecmaVersion:2022,globals:{...globals.browser,...globals.node},parserOptions:{ecmaVersion:'latest',ecmaFeatures:{jsx:true},sourceType:'module'}},plugins:{react,'react-hooks':hooks,'react-refresh':refresh},settings:{react:{version:'detect'}},rules:{...js.configs.recommended.rules,...react.configs.recommended.rules,...react.configs['jsx-runtime'].rules,...hooks.configs.recommended.rules,'no-unused-vars':['error',{argsIgnorePattern:'^_'}],'react/prop-types':'off','react-refresh/only-export-components':['warn',{allowConstantExport:true}]}}];
