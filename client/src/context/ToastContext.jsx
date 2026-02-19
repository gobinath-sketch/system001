import { createContext, useContext, useState, useCallback } from 'react';
import { X, CheckCircle, AlertCircle, Info } from 'lucide-react';
const ToastContext = createContext();
export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};
const Toast = ({
  id,
  message,
  type,
  onClose
}) => {
  const bgColors = {
    success: 'bg-green-50 border-green-200',
    error: 'bg-red-50 border-red-200',
    info: 'bg-blue-50 border-blue-200',
    warning: 'bg-yellow-50 border-yellow-200'
  };
  const textColors = {
    success: 'text-green-800',
    error: 'text-red-800',
    info: 'text-blue-800',
    warning: 'text-yellow-800'
  };
  const icons = {
    success: <CheckCircle className="w-5 h-5 text-green-500" />,
    error: <AlertCircle className="w-5 h-5 text-red-500" />,
    info: <Info className="w-5 h-5 text-blue-500" />,
    warning: <AlertCircle className="w-5 h-5 text-yellow-500" />
  };
  return <div className={`flex items-start p-4 rounded-lg border shadow-lg mb-3 w-80 transform transition-all duration-300 ease-in-out animate-slide-in ${bgColors[type] || bgColors.info}`}>
            <div className="flex-shrink-0 mr-3">
                {icons[type] || icons.info}
            </div>
            <div className={`flex-1 text-sm font-medium ${textColors[type] || textColors.info}`}>
                {message}
            </div>
            <button onClick={() => onClose(id)} className="ml-3 flex-shrink-0 text-gray-400 hover:text-gray-600 focus:outline-none">
                <X className="w-4 h-4" />
            </button>
        </div>;
};
export const ToastProvider = ({
  children
}) => {
  const [toasts, setToasts] = useState([]);
  const addToast = useCallback((message, type = 'info') => {
    const id = Date.now();
    setToasts(prev => [...prev, {
      id,
      message,
      type
    }]);

    // Auto remove after 5 seconds
    setTimeout(() => {
      setToasts(prev => prev.filter(toast => toast.id !== id));
    }, 5000);
  }, []);
  const removeToast = useCallback(id => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  }, []);
  return <ToastContext.Provider value={{
    addToast,
    removeToast
  }}>
            {children}
            <div className="fixed top-24 right-5 z-50 flex flex-col items-end pointer-events-none">
                <div className="pointer-events-auto">
                    {toasts.map(toast => <Toast key={toast.id} {...toast} onClose={removeToast} />)}
                </div>
            </div>
        </ToastContext.Provider>;
};