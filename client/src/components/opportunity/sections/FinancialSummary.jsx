import React from 'react';
import { useCurrency } from '../../../context/CurrencyContext';

const FinancialSummary = ({ opportunity, poValue }) => {
    const { currency } = useCurrency();
    const USD_TO_INR = 83; // Conversion rate

    // Currency formatting helper
    const formatCurrency = (value) => {
        const displayValue = currency === 'USD' ? value / USD_TO_INR : value;
        const symbol = currency === 'USD' ? '$' : '₹';
        return `${symbol} ${displayValue.toLocaleString(undefined, {
            minimumFractionDigits: currency === 'USD' ? 2 : 0,
            maximumFractionDigits: currency === 'USD' ? 2 : 0
        })}`;
    };

    // Helper to parse currency strings (remove commas)
    const parseCurrency = (val) => {
        if (!val) return 0;
        if (typeof val === 'number') return val;
        const strVal = String(val).replace(/,/g, '');
        return parseFloat(strVal) || 0;
    };

    // Calculate Total Expense
    const exp = opportunity.expenses || {};
    const expenseTypes = [
        'trainerCost', 'vouchersCost', 'gkRoyalty', 'material', 'labs',
        'venue', 'travel', 'accommodation', 'perDiem', 'localConveyance'
    ];
    const opEx = expenseTypes.reduce((sum, key) => sum + parseCurrency(exp[key]), 0);
    // Calculate contingency dynamically from percentage to ensure it's always up-to-date
    const contingencyPercent = exp.contingencyPercent ?? 15;
    const contingency = (opEx * contingencyPercent) / 100;
    // Calculate marketing dynamically from percentage
    const marketingPercent = exp.marketingPercent ?? 0;
    const marketing = (opEx * marketingPercent) / 100;
    const calculatedTotalExpense = opEx + contingency + marketing;

    // Calculate Profit & Variance
    const poAmount = poValue || 0;
    const profit = poAmount - calculatedTotalExpense;
    const proposalValue = opportunity.commonDetails?.tov || 0;
    const variance = poAmount - proposalValue;
    const isPositiveVariance = variance >= 0;

    // Calculate GP %
    const gpPercent = poAmount > 0 ? ((profit / poAmount) * 100).toFixed(2) : '0';

    return (
        <React.Fragment>
            <h3 className="text-lg font-bold text-primary-blue mb-4">Financial Summary</h3>
            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">PO Amount</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Overall Expenses</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Marketing</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">GK Revenue (Profit)</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">PO to Proposal Variance</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">GP %</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        <tr>
                            <td className="px-3 py-2 whitespace-nowrap text-sm font-bold text-gray-900">
                                {formatCurrency(poAmount)}
                            </td>
                            <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">
                                {formatCurrency(calculatedTotalExpense)}
                            </td>
                            <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">
                                {formatCurrency(marketing)}
                            </td>
                            <td className="px-3 py-2 whitespace-nowrap text-sm font-bold text-green-600">
                                {formatCurrency(profit)}
                            </td>
                            <td className="px-3 py-2 whitespace-nowrap text-sm font-bold">
                                <span className={isPositiveVariance ? "text-green-600" : "text-red-500"}>
                                    {formatCurrency(variance)}
                                </span>
                            </td>
                            <td className="px-3 py-2 whitespace-nowrap text-sm font-bold text-blue-600">
                                {gpPercent}%
                            </td>
                        </tr>
                    </tbody>
                </table>
                <div className="mt-2 text-xs text-gray-500 italic">
                    * GK Revenue (Profit) = PO Amount - Overall Expenses
                    <br />
                    * PO to Proposal Variance = PO Amount - Proposal Value
                    <br />
                    * GP % = GK Revenue / PO Amount
                </div>
            </div>
        </React.Fragment>
    );
};

export default FinancialSummary;
