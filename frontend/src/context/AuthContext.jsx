import { createContext, useContext, useState, useEffect } from 'react';
import api from '../api/axios';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Complete a Microsoft redirect login if main.jsx stored a pending token
        const msalToken = sessionStorage.getItem('__msal_redirect_token');
        if (msalToken) {
            sessionStorage.removeItem('__msal_redirect_token');
            api.post('/auth/microsoft', { idToken: msalToken })
                .then(({ data }) => setUser(data.user))
                .catch(() => setUser(null))
                .finally(() => setLoading(false));
            return;
        }
        // Restore session on page reload
        api.get('/auth/me')
            .then(({ data }) => setUser(data.user))
            .catch(() => setUser(null))
            .finally(() => setLoading(false));
    }, []);

    const login = async (email, password) => {
        const { data } = await api.post('/auth/login', { email, password });
        setUser(data.user);
        return data.user;
    };

    const loginWithMicrosoft = async (idToken) => {
        const { data } = await api.post('/auth/microsoft', { idToken });
        setUser(data.user);
        return data.user;
    };

    const loginWithGoogle = async (idToken, role) => {
        const { data } = await api.post('/auth/google', { idToken, role });
        setUser(data.user);
        return data.user;
    };

    const logout = async () => {
        await api.post('/auth/logout');
        setUser(null);
    };

    return (
        <AuthContext.Provider value={{ user, loading, login, loginWithMicrosoft, loginWithGoogle, logout, setUser }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);