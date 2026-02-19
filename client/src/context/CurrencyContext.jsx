import { createContext, useContext, useState } from 'react';
const CurrencyContext = createContext();
export const CurrencyProvider = ({
  children
}) => {
  const [currency, setCurrency] = useState('INR'); // Default to INR

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