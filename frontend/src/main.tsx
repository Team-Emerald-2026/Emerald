import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './app/App';
import './styles/index.css';

// 初期テーマ適用（描画前のチラつき防止）。
// localStorage に値がなければ OS の prefers-color-scheme に追随する。
(() => {
  const stored = localStorage.getItem('theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const dark = stored ? stored === 'dark' : prefersDark;
  document.documentElement.classList.toggle('dark', dark);
})();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
