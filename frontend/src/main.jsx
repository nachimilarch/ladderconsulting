import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { msalInstance } from './msalConfig';
import './index.css';

// msal-browser requires initialize() before any other call.
// If we're in a popup window that Microsoft redirected back to us, let MSAL
// handle the auth code and post the result to the opener — don't render React.
msalInstance.initialize().then(async () => {
  if (window.opener && window.opener !== window) {
    // Running inside the MSAL login popup — process the redirect response
    // (sends token to opener window) then close. No React rendering needed.
    await msalInstance.handleRedirectPromise().catch(() => {});
    return;
  }

  ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </React.StrictMode>
  );
});