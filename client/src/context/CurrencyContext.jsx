import { createContext, useContext, useEffect, useState } from 'react';
import axios from 'axios';
import { useAuth } from './AuthContext';
import { API_BASE, API_ENDPOINTS } from '../config/api';
const CurrencyContext = createContext();
export const CurrencyProvider = ({
  children
}) => {
  const [currency, setCurrency] = useState('INR');
  const {
    user
  } = useAuth();

  useEffect(() => {
    const token = sessionStorage.getItem('token');
    if (!token || !user) {
      setCurrency('INR');
      return;
    }
    let cancelled = false;
    const loadCurrency = async () => {
      try {
        const res = await axios.get(`${API_BASE}${API_ENDPOINTS.settings.me}`, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });
        const nextCurrency = res?.data?.settings?.preferences?.defaultCurrency || 'INR';
        if (!cancelled) setCurrency(nextCurrency);
      } catch {
        if (!cancelled) setCurrency('INR');
      }
    };
    loadCurrency();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  useEffect(() => {
    const syncFromSettings = (event) => {
      const nextCurrency = event?.detail?.settings?.preferences?.defaultCurrency;
      if (nextCurrency === 'INR' || nextCurrency === 'USD') {
        setCurrency(nextCurrency);
      }
    };
    window.addEventListener('settings-updated', syncFromSettings);
    return () => window.removeEventListener('settings-updated', syncFromSettings);
  }, []);

  const toggleCurrency = () => {
    setCurrency(prev => prev === 'INR' ? 'USD' : 'INR');
  };
  return <CurrencyContext.Provider value={{
    currency,
    setCurrency,
    toggleCurrency
  }}>
            {children}
        </CurrencyContext.Provider>;
};
export const useCurrency = () => {
  const context = useContext(CurrencyContext);
  if (!context) {
    throw new Error('useCurrency must be used within a CurrencyProvider');
  }
  return context;
};
