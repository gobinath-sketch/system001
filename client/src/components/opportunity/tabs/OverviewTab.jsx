import React from 'react';
import { Clock } from 'lucide-react';
import Card from '../../ui/Card';
import Badge from '../../ui/Badge';

const OverviewTab = ({ opportunity, user, updateStatus }) => {
    // Permission Checks
    const isDelivery = user?.role === 'Delivery Head' || user?.role === 'Delivery Manager' || user?.role === 'Delivery Team';
    const isSales = user?.role === 'Sales Executive' || user?.role === 'Sales Manager';
    const isAdmin = user?.role === 'Super Admin';

    // Note: Client info is now in the header, so we just show general details here.

    return (
        <div className="space-y-6">
            {/* Progress Bar */}
            <Card>
                <div className="flex items-center justify-between">
                    <h3 className="text-lg font-bold text-primary-blue">Opportunity Progress</h3>
                    <span className="text-sm font-bold text-gray-700">
                        {opportunity.progressPercentage || 0}% Complete
                    </span>
                </div>
                <div className="mt-3 bg-gray-200 rounded-full h-4 overflow-hidden">
                    <div
                        className={`h-full rounded-full transition-all duration-500 ${(opportunity.progressPercentage || 0) >= 100
                            ? 'bg-green-500' // Completed
                            : 'bg-brand-blue' // In Progress (Theme)
                            }`}
                        style={{ width: `${opportunity.progressPercentage || 0}%` }}
                    ></div>
                </div>
            </Card>

            {/* Two Column Layout: Key Details (1/2) & Requirement Summary (1/2) */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Left Column: Key Details */}
                <div>
                    <Card>
                        <h3 className="text-lg font-bold text-gray-900 mb-4">Status & Key Details</h3>

                        {/* Status Dropdown */}
                        <div className="mb-6">
                            <label className="block text-sm font-medium text-gray-700 mb-1">Opportunity Status</label>
                            <select
                                className="w-full border border-gray-300 rounded-md p-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                value={opportunity.commonDetails?.status || 'Active'}
                                onChange={(e) => updateStatus && updateStatus(e.target.value)}
                                disabled={!updateStatus || (!isSales && !isAdmin && !isDelivery)}
                            >
                                <option value="Active">Active (Auto-Calculated)</option>
                                <option value="Cancelled">Cancelled</option>
                                <option value="Discontinued">Discontinued</option>
                                {/* Allow manual overrides if needed, though calculator usually handles it */}
                                <option value="Completed">Completed</option>
                            </select>
                            <p className="text-xs text-gray-500 mt-1">Set to Cancelled or Discontinued to stop progress tracking.</p>
                        </div>

                        <div className="space-y-3">
                            <div className="flex justify-between border-b border-gray-100 pb-2">
                                <span className="text-sm text-gray-500">Type</span>
                                <Badge type={opportunity.type}>{opportunity.type}</Badge>
                            </div>

                            <div className="flex justify-between border-b border-gray-100 pb-2">
                                <span className="text-sm text-gray-500">Sector</span>
                                <span className="text-sm font-medium text-gray-900">{opportunity.commonDetails?.trainingSector || 'N/A'}</span>
                            </div>

                            <div className="flex justify-between border-b border-gray-100 pb-2">
                                <span className="text-sm text-gray-500">Created On</span>
                                <span className="text-sm font-medium text-gray-900">{new Date(opportunity.createdAt).toLocaleDateString()}</span>
                            </div>

                            {/* Type Specific Preview */}
                            {opportunity.type === 'Training' && (
                                <>
                                    <div className="flex justify-between border-b border-gray-100 pb-2">
                                        <span className="text-sm text-gray-500">Name</span>
                                        <span className="text-sm font-medium text-gray-900">{opportunity.typeSpecificDetails?.trainingName || opportunity.commonDetails?.courseName || 'N/A'}</span>
                                    </div>
                                    <div className="flex justify-between border-b border-gray-100 pb-2">
                                        <span className="text-sm text-gray-500">Technology</span>
                                        <span className="text-sm font-medium text-gray-900">{opportunity.typeSpecificDetails?.technology || 'N/A'}</span>
                                    </div>
                                    <div className="flex justify-between border-b border-gray-100 pb-2">
                                        <span className="text-sm text-gray-500">Location</span>
                                        <span className="text-sm font-medium text-gray-900">{opportunity.typeSpecificDetails?.trainingLocation || opportunity.commonDetails?.location || 'N/A'}</span>
                                    </div>
                                    <div className="flex justify-between border-b border-gray-100 pb-2">
                                        <span className="text-sm text-gray-500">Mode</span>
                                        <span className="text-sm font-medium text-gray-900">{opportunity.typeSpecificDetails?.modeOfTraining || 'N/A'}</span>
                                    </div>
                                    <div className="flex justify-between border-b border-gray-100 pb-2">
                                        <span className="text-sm text-gray-500">Participants</span>
                                        <span className="text-sm font-medium text-gray-900">{opportunity.participants || 'N/A'}</span>
                                    </div>
                                </>
                            )}

                            {/* Fallback for other types to show at least something useful if needed */}
                            {opportunity.type !== 'Training' && (
                                <div className="flex justify-between border-b border-gray-100 pb-2">
                                    <span className="text-sm text-gray-500">Description</span>
                                    <span className="text-sm font-medium text-gray-900 truncate max-w-[150px]" title={opportunity.typeSpecificDetails?.description || ''}>
                                        {opportunity.typeSpecificDetails?.description || opportunity.typeSpecificDetails?.requirementSummary || 'No details'}
                                    </span>
                                </div>
                            )}
                        </div>
                    </Card>
                </div>

                {/* Right Column: Requirement Summary */}
                <div>
                    <Card className="h-full flex flex-col">
                        <h3 className="text-lg font-bold text-gray-900 mb-4">Requirement Summary & Notes</h3>
                        <div className="bg-gray-50 rounded-lg p-4 flex-grow border border-gray-200">
                            {opportunity.requirementSummary ? (
                                <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                                    {opportunity.requirementSummary}
                                </p>
                            ) : (
                                <p className="text-sm text-gray-400 italic">No additional requirement summary provided.</p>
                            )}
                        </div>
                    </Card>
                </div>
            </div>
        </div>
    );
};

export default OverviewTab;
