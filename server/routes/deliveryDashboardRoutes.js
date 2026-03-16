const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Opportunity = require('../models/Opportunity');
const { protect } = require('../middleware/authMiddleware');

// Helper: Extract valid JS Date from Opportunity schema fields
const getOpportunityDate = (opp) => {
    if (opp.commonDetails?.startDate) {
        const startDate = new Date(opp.commonDetails.startDate);
        if (!Number.isNaN(startDate.getTime())) return startDate;
    }
    const monthField = opp.commonDetails?.monthOfTraining;
    let monthIdxFromField = -1;
    if (typeof monthField === 'number') {
        monthIdxFromField = monthField - 1;
    } else if (monthField && /^\d+$/.test(monthField.toString().trim())) {
        monthIdxFromField = Number(monthField) - 1;
    } else if (monthField) {
        const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
        monthIdxFromField = months.indexOf(monthField.toString().toLowerCase().substring(0, 3));
    }
    const yearFromField = Number(opp.commonDetails?.year);
    if (!Number.isNaN(yearFromField) && yearFromField > 1900 && monthIdxFromField >= 0) {
        return new Date(yearFromField, monthIdxFromField, 1);
    }
    if (opp.createdAt) {
        const createdDate = new Date(opp.createdAt);
        if (!Number.isNaN(createdDate.getTime())) return createdDate;
    }
    return new Date(); // Fallback
};

// Helper: Financial Year Start Map (e.g. 2025 -> "2025-2026")
const getFinancialYearString = (date) => {
    const y = date.getFullYear();
    const m = date.getMonth();
    const fyStart = m >= 3 ? y : y - 1;
    return `${fyStart}-${fyStart + 1}`;
};

// Helper: Check if date falls in selected Time Filter
const matchesTimeFilter = (date, timeFilter) => {
    if (timeFilter === 'Yearly') return true;
    const monthIdx = date.getMonth();
    // FY Calendar Mapping (Apr=0)
    // H1: Apr-Sep, H2: Oct-Mar
    // Q1: Apr-Jun, Q2: Jul-Sep, Q3: Oct-Dec, Q4: Jan-Mar
    if (timeFilter === 'H1') return monthIdx >= 3 && monthIdx <= 8;
    if (timeFilter === 'H2') return monthIdx >= 9 || monthIdx <= 2;
    if (timeFilter === 'Q1') return monthIdx >= 3 && monthIdx <= 5;
    if (timeFilter === 'Q2') return monthIdx >= 6 && monthIdx <= 8;
    if (timeFilter === 'Q3') return monthIdx >= 9 && monthIdx <= 11;
    if (timeFilter === 'Q4') return monthIdx >= 0 && monthIdx <= 2;
    // Specific Months Check
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    if (monthNames.includes(timeFilter)) {
        return monthNames[monthIdx] === timeFilter;
    }
    return true;
};

// Apply Role Based Access Filter for Delivery Team
const buildDeliveryQuery = async (req) => {
    let query = { isDeleted: { $ne: true } };

    // Delivery Head: can see everything in Delivery (or specifically assigned to their team)
    // For now, assuming Delivery Head sees "all" active delivery items, or items where they are specifically listed.
    // If strict team structure exists for delivery, we map it. 
    // Assuming Delivery Head = 全局 (Global) access to delivery pipeline for simplicity, unless specifically filtered.

    if (req.user.role === 'Delivery Executive') {
        // Delivery Executive: ONLY their own
        query.assignedTo = req.user._id;
    }
    // If Admin/Director, no filters.

    return query;
};

// @route   GET /api/dashboard/delivery/kpis
// @desc    Get top row KPI stats (Opportunities, Revenue, GP)
router.get('/kpis', protect, async (req, res) => {
    try {
        const { year, filter } = req.query; // e.g. year=2025-2026, filter=Q1
        const query = await buildDeliveryQuery(req);

        const allOpps = await Opportunity.find(query).select('status statusStage progressPercentage commonDetails createdAt poValue financials expenses');

        let oppsOngoing = 0;
        let oppsCompleted = 0;
        let oppsUpcoming = 0;

        let totalRevenue = 0;
        let totalExpense = 0;

        const now = new Date();

        allOpps.forEach(opp => {
            const oppDate = getOpportunityDate(opp);

            // 1. KPI 1: Opportunities (NOT affected by Timeline Filter!)
            // Definitions from Prompt:
            // Ongoing: start_date <= current_date AND status != completed
            // Completed: status = completed
            // Upcoming: start_date > current_date
            const isCompleted = opp.progressPercentage === 100 || opp.status === 'Completed' || opp.statusStage === 'Completed';

            if (isCompleted) {
                oppsCompleted++;
            } else if (oppDate > now) {
                oppsUpcoming++;
            } else {
                oppsOngoing++;
            }

            // 2. TIMELINE FILTER (For Revenue and GP only)
            if (year && getFinancialYearString(oppDate) !== year) return;
            if (filter && filter !== 'All' && !matchesTimeFilter(oppDate, filter)) return;

            // 3. KPI 2 & 3 calculations
            // Revenue = PO value
            const revenue = opp.poValue || 0;
            totalRevenue += revenue;

            // Expense = Overall expense (Total expense + contingency + marketing) -> which is exactly financials.totalExpense
            const expense = opp.financials?.totalExpense || 0;
            totalExpense += expense;
        });

        const grossProfit = totalRevenue - totalExpense;
        const gpPercent = totalRevenue > 0 ? ((grossProfit / totalRevenue) * 100) : 0;

        res.json({
            opportunities: {
                ongoing: oppsOngoing,
                completed: oppsCompleted,
                upcoming: oppsUpcoming,
                total: oppsOngoing + oppsCompleted + oppsUpcoming
            },
            financials: {
                revenue: totalRevenue,
                expense: totalExpense,
                grossProfit: grossProfit,
                gpPercent: Number(gpPercent.toFixed(1))
            }
        });
    } catch (err) {
        console.error('Error in /delivery/kpis:', err);
        res.status(500).json({ message: err.message });
    }
});

// @route   GET /api/dashboard/delivery/overview
// @desc    Get main overview table data
router.get('/overview', protect, async (req, res) => {
    try {
        const { year, filter } = req.query;
        const query = await buildDeliveryQuery(req);

        const opps = await Opportunity.find(query)
            .populate('client', 'companyName')
            .populate('createdBy', 'name')
            .populate('assignedTo', 'name')
            .select('opportunityNumber type status statusStage progressPercentage client createdBy assignedTo poValue financials commonDetails createdAt');

        const tableData = [];

        opps.forEach(opp => {
            const oppDate = getOpportunityDate(opp);

            if (year && getFinancialYearString(oppDate) !== year) return;
            if (filter && filter !== 'All' && !matchesTimeFilter(oppDate, filter)) return;

            const revenue = opp.poValue || 0;
            const expense = opp.financials?.totalExpense || 0;
            const gp = revenue - expense;
            const gpPercent = revenue > 0 ? ((gp / revenue) * 100) : 0;

            tableData.push({
                _id: opp._id,
                opportunityNumber: opp.opportunityNumber,
                type: opp.type,
                status: opp.status,
                statusStage: opp.statusStage,
                progressPercentage: opp.progressPercentage || 0,
                clientName: opp.client?.companyName || 'Unknown',
                salesPerson: opp.createdBy?.name || 'Unknown',
                teamMember: opp.assignedTo?.name || 'Unassigned',
                revenue: revenue,
                expense: expense,
                gp: gp,
                gpPercent: Number(gpPercent.toFixed(1))
            });
        });

        res.json(tableData);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// @route   GET /api/dashboard/delivery/team-performance
// @desc    Get team performance (Head Only)
router.get('/team-performance', protect, async (req, res) => {
    try {
        if (req.user.role === 'Delivery Executive') {
            return res.status(403).json({ message: 'Access Denied.' });
        }

        const { year, filter } = req.query;
        let query = { isDeleted: { $ne: true } };
        // Could filter query by specific Team IDs if Head has a specific team array.

        const opps = await Opportunity.find(query)
            .populate('assignedTo', 'name role')
            .select('assignedTo poValue financials status progressPercentage commonDetails createdAt');

        const execMap = {};

        opps.forEach(opp => {
            const oppDate = getOpportunityDate(opp);
            if (year && getFinancialYearString(oppDate) !== year) return;
            if (filter && filter !== 'All' && !matchesTimeFilter(oppDate, filter)) return;

            const execName = opp.assignedTo?.name || 'Unassigned';

            if (!execMap[execName]) {
                execMap[execName] = { name: execName, assigned: 0, completed: 0, revenue: 0, totalExpense: 0 };
            }

            execMap[execName].assigned++;

            const isCompleted = opp.progressPercentage === 100 || opp.status === 'Completed';
            if (isCompleted) execMap[execName].completed++;

            const revenue = opp.poValue || 0;
            const expense = opp.financials?.totalExpense || 0;

            execMap[execName].revenue += revenue;
            execMap[execName].totalExpense += expense;
        });

        const performanceData = Object.values(execMap).map(exec => {
            const gp = exec.revenue - exec.totalExpense;
            const gpPercent = exec.revenue > 0 ? ((gp / exec.revenue) * 100) : 0;
            return {
                name: exec.name,
                assigned: exec.assigned,
                completed: exec.completed,
                revenue: exec.revenue,
                avgGpPercent: Number(gpPercent.toFixed(1))
            };
        }).sort((a, b) => b.revenue - a.revenue);

        res.json(performanceData);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// @route   GET /api/dashboard/delivery/revenue-trend
// @desc    Get monthly revenue vs expense trend (Line Chart)
router.get('/revenue-trend', protect, async (req, res) => {
    try {
        const { year } = req.query;
        const query = await buildDeliveryQuery(req);

        const opps = await Opportunity.find(query).select('poValue financials commonDetails createdAt');

        // FY Ordering: Apr to Mar
        const fyMonths = ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar'];
        const trendMap = {};
        fyMonths.forEach(m => trendMap[m] = { name: m, revenue: 0, expense: 0 });

        opps.forEach(opp => {
            const oppDate = getOpportunityDate(opp);
            if (year && getFinancialYearString(oppDate) !== year) return;

            const monthIndex = oppDate.getMonth();
            const fyMonthIndex = (monthIndex + 9) % 12; // 3 (Apr) -> 0, 4 (May) -> 1... 2 (Mar) -> 11
            const monthName = fyMonths[fyMonthIndex];

            trendMap[monthName].revenue += (opp.poValue || 0);
            trendMap[monthName].expense += (opp.financials?.totalExpense || 0);
        });

        res.json(Object.values(trendMap));
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// @route   GET /api/dashboard/delivery/top-vendors
// @desc    Get top 5 vendors by expense (Bar Chart)
router.get('/top-vendors', protect, async (req, res) => {
    try {
        const { year, filter } = req.query;
        const query = await buildDeliveryQuery(req);

        const opps = await Opportunity.find(query).select('financeDetails commonDetails createdAt');

        const vendorMap = {};

        opps.forEach(opp => {
            const oppDate = getOpportunityDate(opp);
            if (year && getFinancialYearString(oppDate) !== year) return;
            if (filter && filter !== 'All' && !matchesTimeFilter(oppDate, filter)) return;

            // Dig into financeDetails.vendorPayables.detailed
            const vendorPayables = opp.financeDetails?.vendorPayables?.detailed || {};

            Object.values(vendorPayables).forEach(expenseObj => {
                if (expenseObj && expenseObj.vendorName && expenseObj.finalPayable > 0) {
                    const vName = expenseObj.vendorName;
                    if (!vendorMap[vName]) vendorMap[vName] = 0;
                    vendorMap[vName] += expenseObj.finalPayable;
                }
            });
        });

        const topVendors = Object.keys(vendorMap)
            .map(vName => ({ name: vName, expense: vendorMap[vName] }))
            .sort((a, b) => b.expense - a.expense)
            .slice(0, 5);

        res.json(topVendors);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;
