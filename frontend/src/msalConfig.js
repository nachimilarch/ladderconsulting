import { PublicClientApplication } from '@azure/msal-browser';

// authority "common" — any Microsoft 365 / personal account can attempt sign-in;
// the backend is what actually restricts this to hr_staff/admin by email match.
export const msalInstance = new PublicClientApplication({
    auth: {
        clientId: import.meta.env.VITE_MICROSOFT_CLIENT_ID,
        authority: 'https://login.microsoftonline.com/common',
        redirectUri: window.location.origin,
    },
    cache: {
        cacheLocation: 'sessionStorage',
    },
});

export const msalLoginRequest = {
    scopes: ['openid', 'profile', 'email'],
};
