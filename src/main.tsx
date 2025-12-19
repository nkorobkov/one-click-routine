import { render } from 'preact'
import './index.css'
import { App } from './app.tsx'
import { getStoredTheme, applyTheme } from './themes'

// Apply theme on initial load
applyTheme(getStoredTheme())

render(<App />, document.getElementById('app')!)
