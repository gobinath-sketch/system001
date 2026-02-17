import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { X } from 'lucide-react';
import { useToast } from '../../context/ToastContext';

const SetTargetModal = ({ onClose, onSuccess }) => {
    const { addToast } = useToast();
    const [teamMembers, setTeamMembers] = useState([]);
    const [formData, setFormData] = useState({
        userId: '',
        period: 'Yearly',
        year: new Date().getFullYear(),
        amount: ''
    });
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        fetchTeamMembers();
    }, []);

    const fetchTeamMembers = async () => {
        try {
            const token = localStorage.getItem('token');
            const response = await axios.get('http://localhost:5000/api/dashboard/manager/team-performance', {
                headers: { Authorization: `Bearer ${token}` }
            });
            setTeamMembers(response.data);
        } catch (err) {
            console.error('Error fetching team members:', err);
            addToast('Failed to load team members', 'error');
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!formData.userId || !formData.amount || formData.amount <= 0) {
            addToast('Please fill all fields with valid data', 'error');
            return;
        }

        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            await axios.put(
                `http://localhost:5000/api/dashboard/manager/set-target/${formData.userId}`,
                {
                    period: formData.period,
                    year: formData.year,
                    amount: parseFloat(formData.amount)
                },
                { headers: { Authorization: `Bearer ${token}` } }
            );

            addToast('Target updated successfully!', 'success');
            onSuccess();
        } catch (err) {
            console.error('Error setting target:', err);
            addToast(err.response?.data?.message || 'Failed to set target', 'error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
                {/* Header */}
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-bold text-gray-800">Set Revenue Target</h2>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 transition-colors"
                    >
                        <X size={24} />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Sales Executive Selector */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Sales Executive
                        </label>
                        <select
                            value={formData.userId}
                            onChange={(e) => setFormData({ ...formData, userId: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            required
                        >
                            <option value="">Select Team Member</option>
                            {teamMembers.map((member) => (
                                <option key={member.userId} value={member.userId}>
                                    {member.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Timeline Selector */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Timeline
                        </label>
                        <select
                            value={formData.period}
                            onChange={(e) => setFormData({ ...formData, period: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="Yearly">Yearly</option>
                            <option value="Half-Yearly">Half-Yearly</option>
                            <option value="Quarterly">Quarterly</option>
                        </select>
                    </div>

                    {/* Year Selector */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Year
                        </label>
                        <input
                            type="number"
                            value={formData.year}
                            onChange={(e) => setFormData({ ...formData, year: parseInt(e.target.value) })}
                            min="2020"
                            max="2030"
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>

                    {/* Target Amount */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Target Amount (₹)
                        </label>
                        <input
                            type="number"
                            value={formData.amount}
                            onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                            placeholder="Enter target amount"
                            min="0"
                            step="1000"
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            required
                            onFocus={(e) => (formData.amount === 0 || formData.amount === '0') && setFormData({ ...formData, amount: '' })}
                        />
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-3 pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="flex-1 px-4 py-2 bg-primary-blue text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? 'Saving...' : 'Save Target'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default SetTargetModal;
