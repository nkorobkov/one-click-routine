/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './src/components/AppPage.tsx',
    './src/components/TaskEditor.tsx',
    './src/components/SettingsPage.tsx',
    './src/components/Header.tsx',
    './src/components/ListSelector.tsx',
    './src/components/ListManager.tsx',
  ],
  corePlugins: {
    preflight: false,
  },
  theme: {
    extend: {},
  },
  plugins: [],
}
