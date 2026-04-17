import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './App.css';

/**
 * React 应用入口
 * 挂载根组件到 DOM
 */
ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <App />
    </React.StrictMode>
);
