import { X } from 'lucide-react';
const AlertModal = ({
  isOpen,
  onClose,
  title,
  message,
  onConfirm,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  type = 'info'
}) => {
  if (!isOpen) return null;
  return <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{
    backgroundColor: 'rgba(0, 0, 0, 0.4)'
  }}>
            <div className="bg-white rounded-lg shadow-xl w-full max-w-md transform transition-all">
                {/* Header */}
                <div className={`flex justify-between items-center p-4 border-b ${type === 'warning' ? 'bg-orange-50' : 'bg-blue-50'} rounded-t-lg`}>
                    <h3 className={`text-lg font-semibold ${type === 'warning' ? 'text-orange-700' : 'text-blue-700'}`}>
                        {title}
                    </h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
                        <X size={20} />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6">
                    <p className="text-gray-700">{message}</p>
                </div>

                {/* Footer */}
                <div className="flex justify-end gap-3 p-4 border-t bg-gray-50 rounded-b-lg">
                    <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors">
                        {cancelText}
                    </button>
                    <button onClick={onConfirm} className={`px-4 py-2 text-sm font-medium text-white rounded-md transition-colors ${type === 'warning' ? 'bg-orange-600 hover:bg-orange-700' : 'bg-blue-600 hover:bg-blue-700'}`}>
                        {confirmText}
                    </button>
                </div>
            </div>
        </div>;
};
export default AlertModal;