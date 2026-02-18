import React from 'react';
import PropTypes from 'prop-types';
import Card from '../ui/Card';
import { AlertTriangle, CheckCircle, TrendingUp } from 'lucide-react';

const FinancialSummary = ({ opportunity }) => {
    const financials = opportunity?.financials || {};
    const commonDetails = opportunity?.commonDetails || {};
    const gpPercent = financials.grossProfitPercent || 0;

    // Check if TOV is present
    if (!commonDetails.tov || commonDetails.tov <= 0) {
        return (
            <Card>
                <div className="text-center py-6 text-gray-500">
                    <p className="mb-2">Financial summary will be available once specific details are entered.</p>
                    <p className="text-sm">(Please enter Total Order Value in Finance tab)</p>
                </div>
            </Card>
        );
    }

    // Determine GP color based on percentage
    const getGPColor = () => {
        if (gpPercent >= 15) return 'text-primary-blue bg-accent-yellow-light';
        if (gpPercent >= 10) return 'text-accent-yellow-dark bg-yellow-100';
        return 'text-alert-danger bg-red-100';
    };

    const getGPIcon = () => {
        if (gpPercent >= 15) return <TrendingUp className="text-primary-blue" size={20} />;
        if (gpPercent >= 10) return <AlertTriangle className="text-accent-yellow-dark" size={20} />;
        return <AlertTriangle className="text-alert-danger" size={20} />;
    };

    return (
        <div>
            <Card className="bg-gradient-to-br from-primary-blue-light/10 to-accent-yellow-light/10 border-2 border-primary-blue">
                <div className="flex items-center justify-between mb-3">
                    <h3 className="text-base font-bold text-primary-blue">Financial Summary</h3>
                    {getGPIcon()}
                </div>

                <div className="space-y-3">
                    {/* Total Expense */}
                    <div className="flex justify-between items-center border-b border-gray-200 pb-2">
                        <label className="text-xs text-text-secondary uppercase font-medium">Total Expense</label>
                        <p className="text-base font-bold text-alert-danger">
                            ₹{financials.totalExpense?.toLocaleString() || 0}
                        </p>
                    </div>

                    {/* GKT Revenue */}
                    <div className="flex justify-between items-center border-b border-gray-200 pb-2">
                        <label className="text-xs text-text-secondary uppercase font-medium">GKT Revenue</label>
                        <p className="text-base font-bold text-alert-success">
                            ₹{financials.gktRevenue?.toLocaleString() || 0}
                        </p>
                    </div>

                    {/* Gross Profit % */}
                    <div className="mt-3">
                        <label className="block text-xs text-text-secondary uppercase mb-1 font-medium">
                            Gross Profit %
                        </label>
                        <div className={`${getGPColor()} rounded-lg p-3 text-center`}>
                            <p className="text-3xl font-bold">
                                {gpPercent.toFixed(1)}%
                            </p>
                        </div>
                    </div>

                    {/* Approval Status */}
                    {opportunity.approvalRequired && (
                        <div className="mt-3 p-3 bg-white rounded-lg border-2 border-accent-yellow-dark flex items-start space-x-2">
                            <AlertTriangle size={18} className="text-accent-yellow-dark mt-0.5 flex-shrink-0" />
                            <div>
                                <p className="font-bold text-sm text-text-primary">Approval Required</p>
                                <p className="text-xs text-text-secondary mt-0.5">
                                    {opportunity.approvalStatus === 'Pending Director' &&
                                        'GP < 10% - Requires Director approval'}
                                    {opportunity.approvalStatus === 'Pending Manager' &&
                                        'GP 10–15% - Requires Sales Manager approval'}
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Approved Status */}
                    {opportunity.approvalStatus === 'Approved' && (
                        <div className="mt-3 p-3 bg-green-50 rounded-lg border-2 border-alert-success flex items-start space-x-2">
                            <CheckCircle size={18} className="text-alert-success mt-0.5 flex-shrink-0" />
                            <div>
                                <p className="font-bold text-sm text-green-800">Approved</p>
                                <p className="text-xs text-green-700 mt-0.5">
                                    By {opportunity.approvedBy?.name}
                                </p>
                            </div>
                        </div>
                    )}
                </div>
            </Card>
        </div>
    );
};

FinancialSummary.propTypes = {
    opportunity: PropTypes.shape({
        financials: PropTypes.shape({
            totalExpense: PropTypes.number,
            gktRevenue: PropTypes.number,
            grossProfitPercent: PropTypes.number
        }),
        approvalRequired: PropTypes.bool,
        approvalStatus: PropTypes.string,
        approvedBy: PropTypes.shape({
            name: PropTypes.string
        }),
        approvedAt: PropTypes.string
    })
};

export default FinancialSummary;
