import { PublicClientApplication } from '@azure/msal-browser';

// MSAL requires the Web Crypto API which is only available in secure contexts
// (HTTPS or localhost). On plain HTTP (e.g. IP-only staging), construction throws
// crypto_nonexistent — catch it so the rest of the app still renders.
let msalInstance = null;
try {
    msalInstance = new PublicClientApplication({
        auth: {
            clientId: import.meta.env.VITE_MICROSOFT_CLIENT_ID,
            authority: 'https://login.microsoftonline.com/common',
            redirectUri: window.location.origin,
        },
        cache: {
            cacheLocation: 'sessionStorage',
        },
    });
} catch (e) {
    console.warn('[MSAL] Skipping initialization — secure context required:', e.message);
}
export { msalInstance };

export const msalLoginRequest = {
    scopes: ['openid', 'profile', 'email'],
};
