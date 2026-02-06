import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { CheckCircle, Circle, Clock, AlertCircle } from 'lucide-react';

const ProgressBar = ({ opportunityId }) => {
    const [progressData, setProgressData] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (opportunityId) {
            fetchProgress();
        }
    }, [opportunityId]);

    const fetchProgress = async () => {
        try {
            const token = localStorage.getItem('token');
            const res = await axios.get(`http://localhost:5000/api/opportunities/${opportunityId}/progress`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setProgressData(res.data);
            setLoading(false);
        } catch (err) {
            console.error('Error fetching progress:', err);
            setLoading(false);
        }
    };

    if (loading) {
        return <div className="animate-pulse h-32 bg-gray-100 rounded-lg"></div>;
    }

    if (!progressData) {
        return null;
    }

    const { progressPercentage, statusStage, statusLabel, requiredFieldsForNextStage } = progressData;

    const stages = [
        { name: 'Created', label: 'Created', range: [0, 30], icon: Circle },
        { name: 'In Progress', label: 'In Progress', range: [30, 50], icon: Circle },
        { name: 'Scheduled', label: 'Scheduled', range: [50, 80], icon: Circle },
        { name: 'Completed', label: 'Completed', range: [80, 100], icon: CheckCircle }
    ];

    const getStageStatus = (stage) => {
        const [min, max] = stage.range;
        if (progressPercentage >= max) return 'completed';
        if (progressPercentage >= min) return 'current';
        return 'pending';
    };

    const getStageColor = (status) => {
        if (status === 'completed') return 'bg-green-500 text-white';
        if (status === 'current') return 'bg-blue-500 text-white';
        return 'bg-gray-300 text-gray-600';
    };

    const getConnectorColor = (index) => {
        const nextStage = stages[index + 1];
        if (!nextStage) return 'bg-gray-300';
        const status = getStageStatus(nextStage);
        if (status === 'completed') return 'bg-green-500';
        if (status === 'current') return 'bg-blue-500';
        return 'bg-gray-300';
    };

    return (
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100 mb-6">
            {/* Header */}
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h3 className="text-lg font-bold text-gray-800">Opportunity Progress</h3>
                    <p className="text-sm text-gray-500">{statusLabel}</p>
                </div>
                <div className="text-right group relative cursor-help">
                    <div className="text-3xl font-bold text-brand-blue">{progressPercentage}%</div>
                    <div className="text-xs text-gray-500">Complete</div>

                    {/* Tooltip for Next Steps */}
                    {progressPercentage < 100 && (
                        <div className="absolute right-0 top-full mt-2 w-64 p-3 bg-gray-800 text-white text-xs rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity z-50 pointer-events-none">
                            <div className="font-bold mb-1 border-b border-gray-600 pb-1">Next Steps:</div>
                            {requiredFieldsForNextStage && requiredFieldsForNextStage.length > 0 ? (
                                <ul className="list-disc pl-4 space-y-1">
                                    {requiredFieldsForNextStage.map((field, i) => (
                                        <li key={i}>{field}</li>
                                    ))}
                                </ul>
                            ) : (
                                <p>Complete current stage details to proceed.</p>
                            )}
                            <div className="absolute -top-1 right-4 w-2 h-2 bg-gray-800 transform rotate-45"></div>
                        </div>
                    )}
                </div>
            </div>

            {/* Progress Bar */}
            <div className="mb-6">
                <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                    <div
                        className="h-3 rounded-full transition-all duration-500 bg-gradient-to-r from-blue-500 to-green-500"
                        style={{ width: `${progressPercentage}%` }}
                    ></div>
                </div>
            </div>

            {/* Stage Indicators */}
            <div className="flex items-center justify-between mb-6">
                {stages.map((stage, index) => {
                    const status = getStageStatus(stage);
                    const Icon = status === 'completed' ? CheckCircle : status === 'current' ? Clock : Circle;

                    return (
                        <React.Fragment key={stage.name}>
                            {/* Stage Circle */}
                            <div className="flex flex-col items-center flex-1">
                                <div className={`w-12 h-12 rounded-full flex items-center justify-center ${getStageColor(status)} shadow-md transition-all duration-300`}>
                                    <Icon size={24} />
                                </div>
                                <div className="mt-2 text-center">
                                    <div className={`text-xs font-semibold ${status === 'current' ? 'text-blue-600' : status === 'completed' ? 'text-green-600' : 'text-gray-500'}`}>
                                        {stage.label}
                                    </div>
                                    <div className="text-xs text-gray-400 mt-1">
                                        {stage.range[0]}% - {stage.range[1]}%
                                    </div>
                                </div>
                            </div>

                            {/* Connector Line */}
                            {index < stages.length - 1 && (
                                <div className={`h-1 flex-1 mx-2 ${getConnectorColor(index)} transition-all duration-300`}></div>
                            )}
                        </React.Fragment>
                    );
                })}
            </div>

            {/* Completion Message */}
            {progressPercentage === 100 && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
                    <CheckCircle className="text-green-600 mx-auto mb-2" size={32} />
                    <h4 className="text-sm font-bold text-green-900">All Stages Complete!</h4>
                    <p className="text-xs text-green-700 mt-1">This opportunity has completed all required stages.</p>
                </div>
            )}
        </div>
    );
};

export default ProgressBar;
