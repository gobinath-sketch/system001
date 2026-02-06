const express = require('express');
const router = express.Router();
const Opportunity = require('../models/Opportunity');
const { protect } = require('../middleware/authMiddleware');

/**
 * ======================================================
 * GP ANALYSIS (Month + Year based on Training Period)
 * ======================================================
 * API:
 * /api/reports/gp-analysis?month=Jan&year=2026
 */
router.get('/gp-analysis', protect, async (req, res) => {
    try {
        const allowedRoles = ['Sales Executive', 'Sales Manager', 'Super Admin', 'Finance'];
        if (!allowedRoles.includes(req.user.role)) {
            return res.status(403).json({ message: 'Access denied' });
        }

        const { type, month, year, quarter } = req.query;

        if (!year) {
            return res.status(400).json({ message: 'year is required' });
        }

        let query = {};
        const yearInt = Number(year);

        if (type === 'quarter') {
            const qMap = {
                'Q1': { months: ['April', 'May', 'June'], yearOffset: 0 },
                'Q2': { months: ['July', 'August', 'September'], yearOffset: 0 },
                'Q3': { months: ['October', 'November', 'December'], yearOffset: 0 },
                'Q4': { months: ['January', 'February', 'March'], yearOffset: 1 }
            };

            const selectedQ = qMap[quarter];
            if (!selectedQ) {
                return res.status(400).json({ message: 'Invalid quarter' });
            }

            query = {
                'commonDetails.monthOfTraining': { $in: selectedQ.months },
                'commonDetails.year': yearInt + selectedQ.yearOffset
            };

        } else if (type === 'fiscal_year') {
            query = {
                $or: [
                    {
                        'commonDetails.monthOfTraining': { $in: ['April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'] },
                        'commonDetails.year': yearInt
                    },
                    {
                        'commonDetails.monthOfTraining': { $in: ['January', 'February', 'March'] },
                        'commonDetails.year': yearInt + 1
                    }
                ]
            };
        } else {
            // Default to 'month' type (strict)
            if (!month) {
                return res.status(400).json({ message: 'month is required for month type' });
            }
            query = {
                'commonDetails.monthOfTraining': month,
                'commonDetails.year': yearInt
            };
        }

        // Role-based filtering
        if (req.user.role === 'Sales Executive') {
            query.createdBy = req.user._id;
        }
        else if (req.user.role === 'Sales Manager') {
            const User = require('../models/User');
            const teamMembers = await User.find({ reportingManager: req.user._id });
            const teamUserIds = [req.user._id, ...teamMembers.map(u => u._id)];
            query.createdBy = { $in: teamUserIds };
        }
        // Finance & Super Admin see all

        const opportunities = await Opportunity
            .find(query)
            .populate('client', 'companyName');

        const clientMap = new Map();

        opportunities.forEach(opp => {
            const clientId = opp.client?._id?.toString();
            const clientName = opp.client?.companyName || 'Unknown Client';
            if (!clientId) return;

            // Revenue (Client Invoice without tax)
            const revenue = opp.financeDetails?.clientReceivables?.invoiceAmount || 0;

            // Expenses (Vendor Payables)
            let expenses = 0;
            const vendorPayables = opp.financeDetails?.vendorPayables;

            if (vendorPayables?.detailed) {
                Object.values(vendorPayables.detailed).forEach(cat => {
                    if (cat?.invoiceValue) {
                        expenses += Number(cat.invoiceValue) || 0;
                    }
                });
            }

            expenses += Number(vendorPayables?.perDiem?.amount) || 0;
            expenses += Number(vendorPayables?.other?.amount) || 0;

            if (clientMap.has(clientId)) {
                const existing = clientMap.get(clientId);
                existing.totalRevenue += revenue;
                existing.totalExpenses += expenses;
                existing.opportunityCount += 1;
            } else {
                clientMap.set(clientId, {
                    clientName,
                    totalRevenue: revenue,
                    totalExpenses: expenses,
                    opportunityCount: 1
                });
            }
        });

        const clientData = Array.from(clientMap.values()).map((client, index) => {
            const gp = client.totalRevenue - client.totalExpenses;
            const gpPercent = client.totalRevenue > 0 ? (gp / client.totalRevenue) * 100 : 0;

            return {
                sno: index + 1,
                clientName: client.clientName,
                totalRevenue: client.totalRevenue,
                totalExpenses: client.totalExpenses,
                gp,
                gpPercent,
                opportunityCount: client.opportunityCount
            };
        });

        const summary = {
            totalRevenue: clientData.reduce((s, c) => s + c.totalRevenue, 0),
            totalExpenses: clientData.reduce((s, c) => s + c.totalExpenses, 0),
            totalOpportunities: opportunities.length,
            totalClients: clientData.length
        };

        summary.grossProfit = summary.totalRevenue - summary.totalExpenses;
        summary.gpPercent = summary.totalRevenue > 0
            ? (summary.grossProfit / summary.totalRevenue) * 100
            : 0;

        res.json({
            month,
            year,
            summary,
            clientData
        });

    } catch (error) {
        console.error('GP Analysis Error:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

/**
 * ======================================================
 * VENDOR EXPENSE ANALYSIS (Month + Year based)
 * ======================================================
 * API:
 * /api/reports/vendor-expenses?month=Jan&year=2026
 */
router.get('/vendor-expenses', protect, async (req, res) => {
    try {
        const allowedRoles = ['Finance', 'Delivery Team', 'Super Admin', 'Director'];
        if (!allowedRoles.includes(req.user.role)) {
            return res.status(403).json({ message: 'Access denied' });
        }

        const { month, year } = req.query;

        if (!month || !year) {
            return res.status(400).json({ message: 'month and year are required' });
        }

        const opportunities = await Opportunity.find({
            'commonDetails.monthOfTraining': month,
            'commonDetails.year': Number(year)
        });

        const vendorMap = new Map();

        opportunities.forEach(opp => {
            const vendorPayables = opp.financeDetails?.vendorPayables;
            if (!vendorPayables) return;

            // Detailed vendor categories
            if (vendorPayables.detailed) {
                Object.values(vendorPayables.detailed).forEach(details => {
                    if (details?.vendorName && details?.invoiceValue) {
                        const expense = Number(details.invoiceValue) || 0;

                        if (vendorMap.has(details.vendorName)) {
                            const existing = vendorMap.get(details.vendorName);
                            existing.totalExpense += expense;
                            existing.opportunityCount += 1;
                        } else {
                            vendorMap.set(details.vendorName, {
                                vendorName: details.vendorName,
                                totalExpense: expense,
                                opportunityCount: 1
                            });
                        }
                    }
                });
            }

            // Trainer cost (fallback)
            const trainerName = opp.commonDetails?.trainerDetails?.name;
            const trainerCost = opp.expenses?.trainerCost || 0;

            if (trainerName && trainerCost > 0) {
                if (vendorMap.has(trainerName)) {
                    const existing = vendorMap.get(trainerName);
                    existing.totalExpense += trainerCost;
                    existing.opportunityCount += 1;
                } else {
                    vendorMap.set(trainerName, {
                        vendorName: trainerName,
                        totalExpense: trainerCost,
                        opportunityCount: 1
                    });
                }
            }
        });

        const vendorData = Array.from(vendorMap.values())
            .sort((a, b) => b.totalExpense - a.totalExpense)
            .slice(0, 20);

        const summary = {
            totalVendors: vendorData.length,
            totalExpenses: vendorData.reduce((s, v) => s + v.totalExpense, 0),
            totalOpportunities: opportunities.length
        };

        res.json({
            month,
            year,
            summary,
            vendorData
        });

    } catch (error) {
        console.error('Vendor Expense Analysis Error:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

module.exports = router;
