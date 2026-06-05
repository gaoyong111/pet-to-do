import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { initCharacter } from './character/characterPhrases';
import './App.css';

async function bootstrap(): Promise<void> {
    await initCharacter();
    ReactDOM.createRoot(document.getElementById('root')!).render(
        <React.StrictMode>
            <App />
        </React.StrictMode>
    );
}

bootstrap();
