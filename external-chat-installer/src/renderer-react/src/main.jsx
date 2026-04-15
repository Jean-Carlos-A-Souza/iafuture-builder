import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { DesktopAppProvider } from './context/DesktopAppContext';
import './styles/app.css';

function registerPwaRuntime() {
  if (!('serviceWorker' in navigator) || window.location.protocol === 'file:') {
    return;
  }

  let reloading = false;

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloading) {
      return;
    }

    reloading = true;
    window.location.reload();
  });

  navigator.serviceWorker.register('./sw.js')
    .then((registration) => {
      registration.update().catch(() => {});

      const activateWaitingWorker = () => {
        if (registration.waiting) {
          registration.waiting.postMessage({ type: 'SKIP_WAITING' });
        }
      };

      if (registration.waiting) {
        activateWaitingWorker();
      }

      registration.addEventListener('updatefound', () => {
        const nextWorker = registration.installing;
        if (!nextWorker) {
          return;
        }

        nextWorker.addEventListener('statechange', () => {
          if (nextWorker.state === 'installed' && navigator.serviceWorker.controller) {
            activateWaitingWorker();
          }
        });
      });
    })
    .catch(() => {});
}

registerPwaRuntime();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <DesktopAppProvider>
      <App />
    </DesktopAppProvider>
  </React.StrictMode>,
);
