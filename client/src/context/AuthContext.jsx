import { createContext, useState, useEffect, useContext } from 'react';
import axios from 'axios';
import { API_BASE } from '../config/api';
const AuthContext = createContext();
export const useAuth = () => useContext(AuthContext);
export const AuthProvider = ({
  children
}) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    // Clear legacy persistent auth keys (migrated to sessionStorage-only auth).
    localStorage.removeItem('token');
    localStorage.removeItem('user');

    // Check if user is already logged in from sessionStorage
    const storedUser = sessionStorage.getItem('user');
    const storedToken = sessionStorage.getItem('token');
    if (storedUser && storedToken) {
      try {
        // Basic token expiry check (if JWT format)
        const payload = JSON.parse(atob(storedToken.split('.')[1]));
        const isExpired = payload.exp * 1000 < Date.now();
        if (isExpired) {
          sessionStorage.removeItem('user');
          sessionStorage.removeItem('token');
          setUser(null);
        } else {
          setUser(JSON.parse(storedUser));
        }
      } catch (e) {
        console.error('Failed to parse stored user or token', e);
        sessionStorage.removeItem('user');
        sessionStorage.removeItem('token');
      }
    }
    setLoading(false);
  }, []);
  const login = async (email, password) => {
    const res = await axios.post(`${API_BASE}/api/auth/login`, {
      email,
      password
    });
    sessionStorage.setItem('token', res.data.token);
    sessionStorage.setItem('user', JSON.stringify(res.data.user));
    setUser(res.data.user);
    return res.data.user;
  };
  const updateUserRole = role => {
    if (user) {
      setUser({
        ...user,
        role
      });
    }
  };
  const updateUser = patch => {
    if (!user) return;
    const nextUser = {
      ...user,
      ...(patch || {})
    };
    setUser(nextUser);
    sessionStorage.setItem('user', JSON.stringify(nextUser));
  };
  const logout = () => {
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('user');
    setUser(null);
  };
  return <AuthContext.Provider value={{
    user,
    login,
    logout,
    updateUserRole,
    updateUser,
    loading
  }}>
            {!loading && children}
        </AuthContext.Provider>;
};
