import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { msalInstance } from './msalConfig';
import './index.css';

// msal-browser requires initialize() before any other call.
// If we're in a popup window that Microsoft redirected back to us, let MSAL
// handle the auth code and post the result to the opener — don't render React.
const renderApp = () => {
  ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </React.StrictMode>
  );
};

if (msalInstance) {
  msalInstance.initialize().then(async () => {
    if (window.opener && window.opener !== window) {
      await msalInstance.handleRedirectPromise().catch(() => {});
      return;
    }
    renderApp();
  });
} else {
  // HTTP context — MSAL unavailable, render without it (Microsoft SSO button hidden)
  renderApp();
}