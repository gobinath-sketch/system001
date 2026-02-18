import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

if (import.meta.env.DEV && typeof window !== 'undefined') {
  const blockedMessages = [
    '[vite] connecting...',
    '[vite] connected.',
    '[Violation] \'message\' handler took',
    '[Violation] \'requestAnimationFrame\' handler took',
  ];

  const shouldBlock = (args) =>
    args.some((arg) => {
      if (typeof arg !== 'string') return false;
      return blockedMessages.some((msg) => arg.includes(msg));
    });

  const originalLog = console.log.bind(console);
  const originalWarn = console.warn.bind(console);
  const originalError = console.error.bind(console);
  const originalInfo = console.info.bind(console);
  const originalDebug = console.debug.bind(console);

  console.log = (...args) => {
    if (shouldBlock(args)) return;
    originalLog(...args);
  };

  console.warn = (...args) => {
    if (shouldBlock(args)) return;
    originalWarn(...args);
  };

  console.error = (...args) => {
    if (shouldBlock(args)) return;
    originalError(...args);
  };

  console.info = (...args) => {
    if (shouldBlock(args)) return;
    originalInfo(...args);
  };

  console.debug = (...args) => {
    if (shouldBlock(args)) return;
    originalDebug(...args);
  };
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
