const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Client = require('../models/Client');
const Opportunity = require('../models/Opportunity');
// Vendor import removed
const { protect } = require('../middleware/authMiddleware');

const getAccessibleUserIds = async (user) => {
    if (user.role === 'Sales Executive') {
        return [user._id];
    } else if (user.role === 'Sales Manager') {
        const team = await User.find({ reportingManager: user._id });
        return [user._id, ...team.map(u => u._id)];
    } else {
        return []; // Head
    }
};

router.get('/stats', protect, async (req, res) => {
    try {
        let query = {};
        let userIds = [];

        if (req.user.role !== 'Business Head') {
            userIds = await getAccessibleUserIds(req.user);
            query.createdBy = { $in: userIds };
        }

        // Exclude discontinued/cancelled from ALL stats
        query.status = { $nin: ['Cancelled', 'Discontinued', 'Lost'] };

        const totalClients = await Client.countDocuments(query);
        const totalOpportunities = await Opportunity.countDocuments(query);

        // New KPI Buckets - Strict Ranges
        // 30% Card: 0% - 49%
        const progress30 = await Opportunity.countDocuments({ ...query, progressPercentage: { $lt: 50 } });
        // 50% Card: 50% - 79%
        const progress50 = await Opportunity.countDocuments({ ...query, progressPercentage: { $gte: 50, $lt: 80 } });
        // 80% Card: 80% - 99%
        const progress80 = await Opportunity.countDocuments({ ...query, progressPercentage: { $gte: 80, $lt: 100 } });
        // 100% Card: Exactly 100%
        const progress100 = await Opportunity.countDocuments({ ...query, progressPercentage: 100 });

        // Legacy compatibility (optional, can keep if used elsewhere)
        const completedOpportunities = progress100;
        const inProgressOpportunities = totalOpportunities - completedOpportunities;

        const poUploadedCount = await Opportunity.countDocuments({
            ...query,
            poDocument: { $exists: true, $ne: null, $ne: '' }
        });

        const invoiceUploadedCount = await Opportunity.countDocuments({
            ...query,
            invoiceDocument: { $exists: true, $ne: null, $ne: '' }
        });

        const pendingOpportunities = 0;
        const activeOpportunities = 0;

        let teamStats = {};

        res.json({
            totalClients,
            totalOpportunities,
            activeOpportunities,
            pendingOpportunities,
            completedOpportunities,
            inProgressOpportunities,
            // New KPI fields
            progress30,
            progress50,
            progress80,
            progress100,

            poUploadedCount,
            invoiceUploadedCount,
            ...teamStats
        });

    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// @route   GET /api/dashboard/client-health
// @desc    Get client health metrics (Active, Mid, Inactive)
router.get('/client-health', protect, async (req, res) => {
    try {
        let query = {};
        if (req.user.role !== 'Business Head') {
            const userIds = await getAccessibleUserIds(req.user);
            query.createdBy = { $in: userIds };
        }

        const clients = await Client.find(query);

        const oneYearAgo = new Date();
        oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

        let activeCount = 0;
        let midCount = 0;
        let inactiveCount = 0;

        for (const client of clients) {
            const completedOppCount = await Opportunity.countDocuments({
                client: client._id,
                createdAt: { $gte: oneYearAgo },
                progressPercentage: 100,
                ...query
            });

            if (completedOppCount >= 3) {
                activeCount++;
            } else if (completedOppCount >= 1) {
                midCount++;
            } else {
                inactiveCount++;
            }
        }

        res.json({
            active: activeCount,
            mid: midCount,
            inactive: inactiveCount
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// @route   GET /api/dashboard/all-opportunities
// @desc    Get all opportunities for document status and popup details
// @access  Private
router.get('/all-opportunities', protect, async (req, res) => {
    try {
        let query = {};
        if (req.user.role !== 'Business Head') {
            const userIds = await getAccessibleUserIds(req.user);
            query.createdBy = { $in: userIds };
        }

        const opportunities = await Opportunity.find({
            ...query,
            status: { $nin: ['Cancelled', 'Discontinued'] }
        })
            .select('opportunityNumber client poDocument invoiceDocument progressPercentage statusLabel statusStage expenseDocuments deliveryDocuments poValue invoiceValue type commonDetails financeDetails typeSpecificDetails createdAt')
            .populate('client', 'companyName');

        const formatted = opportunities.map(opp => {
            const p = opp.progressPercentage || 0;
            let nextAction = 'Complete Details';

            if (p < 30) nextAction = 'Define Scope & Sizing';
            else if (p < 50) nextAction = 'Fill Expenses';
            else if (p < 80) nextAction = 'Upload Proposal';
            else if (p < 90) nextAction = 'Upload PO & Quote';
            else if (p < 100) nextAction = 'Upload Invoice & Delivery Docs';
            else nextAction = 'Completed';

            return {
                _id: opp._id,
                opportunityNumber: opp.opportunityNumber,
                clientName: opp.client?.companyName || 'N/A', // Corrected field name
                poDocument: opp.poDocument,
                invoiceDocument: opp.invoiceDocument,
                status: opp.status || opp.statusStage,
                progressPercentage: p,
                statusLabel: opp.statusLabel,
                nextAction,

                // Fields for legacy charts if needed, or stripped down
                type: opp.type,
                typeSpecificDetails: opp.typeSpecificDetails, // Needed for Revenue by Technology
                revenue: opp.financeDetails?.clientReceivables?.invoiceAmount || 0,
                poValue: opp.poValue || 0,
                createdAt: opp.createdAt
            };
        });

        res.json(formatted);

    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// @route   GET /api/dashboard/monthly-trends
// @desc    Get monthly opportunity count and revenue based on training month/year (with fallback to createdAt)
router.get('/monthly-trends', protect, async (req, res) => {
    try {
        const year = new Date().getFullYear();
        const startOfYear = new Date(year, 0, 1);
        const endOfYear = new Date(year, 11, 31);

        let query = {};

        if (req.user.role !== 'Business Head') {
            const userIds = await getAccessibleUserIds(req.user);
            query.createdBy = { $in: userIds };
        }

        // Fetch all opportunities for the year (using createdAt as fallback)
        const opportunities = await Opportunity.find({
            ...query,
            $or: [
                { 'commonDetails.year': year },
                { createdAt: { $gte: startOfYear, $lte: endOfYear } }
            ]
        });

        // Initialize 12 months
        const months = [
            'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
            'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
        ];

        const data = months.map(month => ({
            name: month,
            opportunities: 0,
            revenue: 0
        }));

        opportunities.forEach(opp => {
            let monthIndex = null;

            // Try to use training month first
            const trainingMonth = opp.commonDetails?.monthOfTraining;
            if (trainingMonth && opp.commonDetails?.year === year) {
                // monthOfTraining is stored as month name (Jan, Feb, Mar, etc.)
                monthIndex = months.indexOf(trainingMonth);
                if (monthIndex === -1) {
                    // If not found, try as number (1-12)
                    const monthNum = parseInt(trainingMonth);
                    if (monthNum >= 1 && monthNum <= 12) {
                        monthIndex = monthNum - 1;
                    }
                }
            }

            // Fallback to createdAt month if training month not found
            if (monthIndex === null || monthIndex === -1) {
                const createdDate = new Date(opp.createdAt);
                if (createdDate.getFullYear() === year) {
                    monthIndex = createdDate.getMonth();
                }
            }

            if (monthIndex !== null && monthIndex >= 0) {
                data[monthIndex].opportunities += 1;
                const invoicedRevenue = opp.financeDetails?.clientReceivables?.invoiceAmount || 0;
                data[monthIndex].revenue += invoicedRevenue;
            }
        });

        res.json(data);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});


// @route   GET /api/dashboard/recent-opportunities
// @desc    Get recent opportunities for document tracking
router.get('/recent-opportunities', protect, async (req, res) => {
    try {
        let query = {};
        if (req.user.role !== 'Business Head') {
            const userIds = await getAccessibleUserIds(req.user);
            query.createdBy = { $in: userIds };
        }

        const opportunities = await Opportunity.find(query)
            .sort({ createdAt: -1 })
            .limit(10)
            .select('opportunityNumber statusStage proposalDocument poDocument invoiceDocument poVerified');

        res.json(opportunities);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// @route   GET /api/dashboard/performance/:userId
// @desc    Get Target vs Achieved for a specific user (showing manager-set target)
router.get('/performance/:userId', protect, async (req, res) => {
    try {
        const userId = req.params.userId;
        const year = parseInt(req.query.year) || new Date().getFullYear();

        // Authorization check
        if (req.user.role === 'Sales Executive' && req.user._id.toString() !== userId) {
            return res.status(403).json({ message: 'Not authorized' });
        }

        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ message: 'User not found' });

        // Find the most recent target set by manager for current year
        const currentYearTargets = user.targets.filter(t => t.year === year);

        // Priority: Yearly > Half-Yearly > Quarterly
        let targetObj = currentYearTargets.find(t => t.period === 'Yearly');
        if (!targetObj) targetObj = currentYearTargets.find(t => t.period === 'Half-Yearly');
        if (!targetObj) targetObj = currentYearTargets.find(t => t.period === 'Quarterly');

        const targetAmount = targetObj ? targetObj.amount : 0;
        const period = targetObj ? targetObj.period : 'Yearly';

        // Calculate date range based on the target period
        let startDate, endDate;
        const now = new Date();

        if (period === 'Yearly') {
            startDate = new Date(year, 0, 1);
            endDate = new Date(year, 11, 31);
        } else if (period === 'Half-Yearly') {
            const currentMonth = now.getMonth();
            if (currentMonth < 6) {
                startDate = new Date(year, 0, 1);
                endDate = new Date(year, 5, 30);
            } else {
                startDate = new Date(year, 6, 1);
                endDate = new Date(year, 11, 31);
            }
        } else if (period === 'Quarterly') {
            const currentMonth = now.getMonth();
            const quarter = Math.floor(currentMonth / 3);
            startDate = new Date(year, quarter * 3, 1);
            endDate = new Date(year, quarter * 3 + 3, 0);
        }

        // Fetch opportunities based on training month/year (with fallback to createdAt)
        const opportunities = await Opportunity.find({
            createdBy: userId,
            $or: [
                {
                    'commonDetails.year': year,
                    'commonDetails.monthOfTraining': { $exists: true }
                },
                {
                    createdAt: { $gte: startDate, $lte: endDate }
                }
            ]
        });

        // Month names to index mapping
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

        // Filter by training month range (or createdAt as fallback)
        const filteredOpps = opportunities.filter(opp => {
            // Try training month first
            if (opp.commonDetails?.monthOfTraining && opp.commonDetails?.year === year) {
                const trainingMonth = opp.commonDetails.monthOfTraining;
                let monthIndex = monthNames.indexOf(trainingMonth);

                // If not found as name, try as number
                if (monthIndex === -1) {
                    const monthNum = parseInt(trainingMonth);
                    if (monthNum >= 1 && monthNum <= 12) {
                        monthIndex = monthNum - 1;
                    }
                }

                if (monthIndex >= 0) {
                    const trainingDate = new Date(opp.commonDetails.year, monthIndex, 1);
                    return trainingDate >= startDate && trainingDate <= endDate;
                }
            }
            // Fallback to createdAt
            const createdDate = new Date(opp.createdAt);
            return createdDate >= startDate && createdDate <= endDate;
        });

        const achievedAmount = filteredOpps.reduce((sum, opp) => {
            const invoicedRevenue = opp.financeDetails?.clientReceivables?.invoiceAmount || 0;
            return sum + invoicedRevenue;
        }, 0);

        const percentage = targetAmount > 0 ? (achievedAmount / targetAmount) * 100 : 0;

        // Check if target achieved and send notification to manager
        if (targetAmount > 0 && achievedAmount >= targetAmount && user.reportingManager) {
            const Notification = require('../models/Notification');

            // Check if notification already sent for this period
            const existingNotification = await Notification.findOne({
                recipientId: user.reportingManager,
                type: achievedAmount > targetAmount ? 'target_exceeded' : 'target_achieved',
                triggeredBy: userId,
                'relatedData.year': year,
                'relatedData.period': period
            });

            if (!existingNotification) {
                const notificationType = achievedAmount > targetAmount ? 'target_exceeded' : 'target_achieved';
                const message = achievedAmount > targetAmount
                    ? `${user.name} has exceeded their ${period} target of ₹${targetAmount.toLocaleString()} with ₹${achievedAmount.toLocaleString()}!`
                    : `${user.name} has achieved their ${period} target of ₹${targetAmount.toLocaleString()}!`;

                await Notification.create({
                    recipientId: user.reportingManager,
                    type: notificationType,
                    message: message,
                    triggeredBy: userId,
                    triggeredByName: user.name,
                    relatedData: {
                        target: targetAmount,
                        achieved: achievedAmount,
                        period: period,
                        year: year
                    },
                    isRead: false
                });
            }
        }

        res.json({
            target: targetAmount,
            achieved: achievedAmount,
            period: period,
            gap: targetAmount - achievedAmount,
            percentage: percentage
        });

    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// @route   GET /api/dashboard/manager/stats
// @desc    Get team-level KPI stats for Sales Manager
router.get('/manager/stats', protect, async (req, res) => {
    try {
        // Only Sales Managers can access this
        if (req.user.role !== 'Sales Manager') {
            return res.status(403).json({ message: 'Access denied. Sales Manager only.' });
        }

        // Get team members
        const teamMembers = await User.find({ reportingManager: req.user._id });
        const teamUserIds = teamMembers.map(u => u._id);

        // Query for team's data
        const query = { createdBy: { $in: teamUserIds } };

        const totalClients = await Client.countDocuments(query);
        const totalOpportunities = await Opportunity.countDocuments(query);

        const completedOpportunities = await Opportunity.countDocuments({
            ...query,
            progressPercentage: 100
        });

        const inProgressOpportunities = await Opportunity.countDocuments({
            ...query,
            progressPercentage: { $lt: 100 }
        });

        res.json({
            totalClients,
            totalOpportunities,
            completedOpportunities,
            inProgressOpportunities,
            teamMembersCount: teamMembers.length
        });
    } catch (err) {
        console.error('Error in /manager/stats:', err);
        console.error('Stack:', err.stack);
        res.status(500).json({ message: err.message, error: err.toString() });
    }
});

// @route   GET /api/dashboard/manager/document-stats
// @desc    Get document upload stats for team opportunities
// @access  Private (Sales Manager)
router.get('/manager/document-stats', protect, async (req, res) => {
    try {
        if (req.user.role !== 'Sales Manager') {
            return res.status(403).json({ message: 'Access denied. Sales Manager only.' });
        }

        // Get team members
        const teamMembers = await User.find({ reportingManager: req.user._id });
        const teamUserIds = teamMembers.map(u => u._id);

        // Count POs and Invoices
        const poCount = await Opportunity.countDocuments({
            createdBy: { $in: teamUserIds },
            poDocument: { $exists: true, $ne: null, $ne: '' }
        });

        const invoiceCount = await Opportunity.countDocuments({
            createdBy: { $in: teamUserIds },
            invoiceDocument: { $exists: true, $ne: null, $ne: '' }
        });

        res.json({ poCount, invoiceCount });
    } catch (err) {
        console.error('Error in /manager/document-stats:', err);
        res.status(500).json({ message: err.message });
    }
});

// @route   GET /api/dashboard/manager/team-members
// @desc    Get team members with their targets
// @access  Private (Sales Manager)
router.get('/manager/team-members', protect, async (req, res) => {
    try {
        if (req.user.role !== 'Sales Manager') {
            return res.status(403).json({ message: 'Access denied. Sales Manager only.' });
        }

        const teamMembers = await User.find({ reportingManager: req.user._id })
            .select('name email targets');

        res.json(teamMembers);
    } catch (err) {
        console.error('Error in /manager/team-members:', err);
        res.status(500).json({ message: err.message });
    }
});

// @route   GET /api/dashboard/manager/monthly-performance
// @desc    Get monthly performance data (opportunities & revenue) for team or individual
// @access  Private (Sales Manager)
router.get('/manager/monthly-performance', protect, async (req, res) => {
    try {
        if (req.user.role !== 'Sales Manager') {
            return res.status(403).json({ message: 'Access denied. Sales Manager only.' });
        }

        const { userId } = req.query;
        const year = new Date().getFullYear();
        const startOfYear = new Date(year, 0, 1);
        const endOfYear = new Date(year, 11, 31);

        // Get team members
        const teamMembers = await User.find({ reportingManager: req.user._id });
        const teamUserIds = teamMembers.map(u => u._id);

        // Build query
        let query = {
            createdBy: { $in: teamUserIds }
        };

        // If userId specified, filter to that user
        if (userId) {
            query.createdBy = userId;
        }

        // Fetch opportunities with month/year fallback
        const opportunities = await Opportunity.find({
            ...query,
            $or: [
                { 'commonDetails.year': year },
                { createdAt: { $gte: startOfYear, $lte: endOfYear } }
            ]
        });

        // Initialize 12 months
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const data = months.map(month => ({
            name: month,
            inProgress: 0,
            completed: 0,
            revenue: 0,
            revenueCount: 0
        }));

        // Aggregate data by month
        opportunities.forEach(opp => {
            let monthIndex = null;

            // Try training month first
            const trainingMonth = opp.commonDetails?.monthOfTraining;
            if (trainingMonth && opp.commonDetails?.year === year) {
                monthIndex = months.indexOf(trainingMonth);
                if (monthIndex === -1) {
                    const monthNum = parseInt(trainingMonth);
                    if (monthNum >= 1 && monthNum <= 12) {
                        monthIndex = monthNum - 1;
                    }
                }
            }

            // Fallback to createdAt
            if (monthIndex === null || monthIndex === -1) {
                const createdDate = new Date(opp.createdAt);
                if (createdDate.getFullYear() === year) {
                    monthIndex = createdDate.getMonth();
                }
            }

            if (monthIndex !== null && monthIndex >= 0) {
                if (opp.progressPercentage === 100) {
                    data[monthIndex].completed += 1;
                } else {
                    data[monthIndex].inProgress += 1;
                }

                // Use PO Value for Revenue as strictly requested
                const poRevenue = opp.poValue || 0;
                data[monthIndex].revenue += poRevenue;

                // Count responsible for revenue
                if (poRevenue > 0) {
                    data[monthIndex].revenueCount += 1;
                }
            }
        });

        res.json(data);
    } catch (err) {
        console.error('Error in /manager/monthly-performance:', err);
        res.status(500).json({ message: err.message });
    }
});

// @route   GET /api/dashboard/manager/team-performance
// @desc    Get target vs achieved for each team member
router.get('/manager/team-performance', protect, async (req, res) => {
    try {
        // Only Sales Managers can access this
        if (req.user.role !== 'Sales Manager') {
            return res.status(403).json({ message: 'Access denied. Sales Manager only.' });
        }

        const timeline = req.query.timeline || 'Yearly';
        const year = parseInt(req.query.year) || new Date().getFullYear();

        // Get team members
        const teamMembers = await User.find({ reportingManager: req.user._id });

        const performanceData = [];

        for (const member of teamMembers) {
            // Get target
            const targetObj = member.targets.find(t => t.year === year && t.period === timeline);
            const targetAmount = targetObj ? targetObj.amount : 0;

            // Calculate achieved revenue
            let startDate, endDate;
            const now = new Date();

            if (timeline === 'Yearly') {
                startDate = new Date(year, 0, 1);
                endDate = new Date(year, 11, 31);
            } else if (timeline === 'Half-Yearly') {
                const currentMonth = now.getMonth();
                if (currentMonth < 6) {
                    startDate = new Date(year, 0, 1);
                    endDate = new Date(year, 5, 30);
                } else {
                    startDate = new Date(year, 6, 1);
                    endDate = new Date(year, 11, 31);
                }
            } else if (timeline === 'Quarterly') {
                const currentMonth = now.getMonth();
                const quarter = Math.floor(currentMonth / 3);
                startDate = new Date(year, quarter * 3, 1);
                endDate = new Date(year, quarter * 3 + 3, 0);
            }

            const opportunities = await Opportunity.find({
                createdBy: member._id,
                $or: [
                    {
                        'commonDetails.year': year,
                        'commonDetails.monthOfTraining': { $exists: true }
                    },
                    {
                        createdAt: { $gte: startDate, $lte: endDate }
                    }
                ]
            });

            const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

            const filteredOpps = opportunities.filter(opp => {
                if (opp.commonDetails?.monthOfTraining && opp.commonDetails?.year === year) {
                    const trainingMonth = opp.commonDetails.monthOfTraining;
                    let monthIndex = monthNames.indexOf(trainingMonth);

                    if (monthIndex === -1) {
                        const monthNum = parseInt(trainingMonth);
                        if (monthNum >= 1 && monthNum <= 12) {
                            monthIndex = monthNum - 1;
                        }
                    }

                    if (monthIndex >= 0) {
                        const trainingDate = new Date(opp.commonDetails.year, monthIndex, 1);
                        return trainingDate >= startDate && trainingDate <= endDate;
                    }
                }
                const createdDate = new Date(opp.createdAt);
                return createdDate >= startDate && createdDate <= endDate;
            });

            const achievedAmount = filteredOpps.reduce((sum, opp) => {
                const invoicedRevenue = opp.financeDetails?.clientReceivables?.invoiceAmount || 0;
                return sum + invoicedRevenue;
            }, 0);

            performanceData.push({
                userId: member._id,
                name: member.name,
                target: targetAmount,
                achieved: achievedAmount
            });
        }

        res.json(performanceData);
    } catch (err) {
        console.error('Error in /manager/team-performance:', err);
        console.error('Stack:', err.stack);
        res.status(500).json({ message: err.message, error: err.toString() });
    }
});

// @route   GET /api/dashboard/manager/documents
// @desc    Get document status for all team opportunities
router.get('/manager/documents', protect, async (req, res) => {
    try {
        // Only Sales Managers can access this
        if (req.user.role !== 'Sales Manager') {
            return res.status(403).json({ message: 'Access denied. Sales Manager only.' });
        }

        // Get team members
        const teamMembers = await User.find({ reportingManager: req.user._id });
        const teamUserIds = teamMembers.map(u => u._id);

        const opportunities = await Opportunity.find({
            createdBy: { $in: teamUserIds }
        })
            .select('opportunityNumber proposalDocument poDocument invoiceDocument poVerified')
            .sort({ createdAt: -1 });

        res.json(opportunities);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// @route   PUT /api/dashboard/manager/set-target/:userId
// @desc    Set or update revenue target for a team member
router.put('/manager/set-target/:userId', protect, async (req, res) => {
    try {
        // Only Sales Managers can set targets
        if (req.user.role !== 'Sales Manager') {
            return res.status(403).json({ message: 'Access denied. Sales Manager only.' });
        }

        const { period, year, amount } = req.body;

        // Validation
        if (!period || !year || !amount || amount <= 0) {
            return res.status(400).json({ message: 'Invalid target data. Period, year, and positive amount required.' });
        }

        // Get the target user
        const targetUser = await User.findById(req.params.userId);
        if (!targetUser) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Verify the user is in this manager's team
        if (targetUser.reportingManager.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: 'You can only set targets for your team members' });
        }

        // Find existing target or create new one
        const existingTargetIndex = targetUser.targets.findIndex(
            t => t.year === year && t.period === period
        );

        if (existingTargetIndex >= 0) {
            // Update existing target
            targetUser.targets[existingTargetIndex].amount = amount;
        } else {
            // Add new target
            targetUser.targets.push({ period, year, amount });
        }

        await targetUser.save();

        res.json({
            message: 'Target updated successfully',
            target: { period, year, amount }
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// @route   GET /api/dashboard/analytics/type-distribution
// @desc    Get opportunity count and revenue by type
// @access  Private
router.get('/analytics/type-distribution', protect, async (req, res) => {
    try {
        let query = {};
        if (req.user.role !== 'Business Head') {
            const userIds = await getAccessibleUserIds(req.user);
            query.createdBy = { $in: userIds };
        }

        const stats = await Opportunity.aggregate([
            { $match: query },
            {
                $group: {
                    _id: '$type',
                    count: { $sum: 1 },
                    revenue: { $sum: { $ifNull: ['$financeDetails.clientReceivables.invoiceAmount', 0] } } // Ensure 0 if field missing
                }
            },
            { $sort: { revenue: -1 } }
        ]);

        const formatted = stats.map(item => ({
            type: item._id,
            count: item.count,
            revenue: item.revenue
        }));

        res.json(formatted);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// @route   GET /api/dashboard/analytics/sector-distribution
// @desc    Get opportunity count and revenue by sector
// @access  Private
router.get('/analytics/sector-distribution', protect, async (req, res) => {
    try {
        let query = {};
        if (req.user.role !== 'Business Head') {
            const userIds = await getAccessibleUserIds(req.user);
            query.createdBy = { $in: userIds };
        }

        const stats = await Opportunity.aggregate([
            { $match: query },
            {
                $group: {
                    _id: '$commonDetails.trainingSector',
                    count: { $sum: 1 },
                    revenue: { $sum: { $ifNull: ['$financeDetails.clientReceivables.invoiceAmount', 0] } }
                }
            },
            { $sort: { count: -1 } }
        ]);

        const formatted = stats.map(item => ({
            sector: item._id || 'Unspecified',
            count: item.count,
            revenue: item.revenue
        }));

        res.json(formatted);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// @route   GET /api/dashboard/analytics/yearly-trends
// @desc    Get revenue trends for last 5 years
// @access  Private
router.get('/analytics/yearly-trends', protect, async (req, res) => {
    try {
        let query = {};
        if (req.user.role !== 'Business Head') {
            const userIds = await getAccessibleUserIds(req.user);
            query.createdBy = { $in: userIds };
        }

        const currentYear = new Date().getFullYear();
        const startYear = currentYear - 4; // Last 5 years including current

        const stats = await Opportunity.aggregate([
            {
                $match: {
                    ...query,
                    'commonDetails.year': { $gte: startYear, $lte: currentYear }
                }
            },
            {
                $group: {
                    _id: '$commonDetails.year',
                    revenue: { $sum: { $ifNull: ['$financeDetails.clientReceivables.invoiceAmount', 0] } }
                }
            },
            { $sort: { _id: 1 } }
        ]);

        // Fill in missing years with 0
        const result = [];
        for (let y = startYear; y <= currentYear; y++) {
            const found = stats.find(item => item._id === y);
            result.push({
                year: y,
                revenue: found ? found.revenue : 0
            });
        }

        res.json(result);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// @route   GET /api/dashboard/delivery/revamp-stats
// @desc    Get comprehensive stats for Delivery Dashboard
// @access  Private (Delivery/Admin)
router.get('/delivery/revamp-stats', protect, async (req, res) => {
    try {
        const year = new Date().getFullYear();
        const startOfYear = new Date(year, 0, 1);
        const endOfYear = new Date(year, 11, 31);
        const currentMonthName = new Date().toLocaleString('default', { month: 'short' }); // e.g., "Jan"

        // 1. Fetch All Opportunities for Calculation
        // Delivery sees ALL opportunities generally, or we filter by permission if needed.
        // Assuming Delivery Team sees all for now based on previous dashboard logic.
        const opportunities = await Opportunity.find({})
            .populate('selectedSME', 'name companyName')
            .populate('commonDetails.sales', 'name')
            .lean();

        // --- KPI CALCULATIONS ---
        let active = 0;
        let scheduledMonth = 0;
        let completed = 0;
        let smeDeployed = 0;
        let pendingFeedback = 0; // Completed but feedback doc missing

        // --- CHART DATA PREP ---
        const salesCountMap = {}; // { 'Sales Name': count }
        const vendorSpendMap = {}; // { 'Vendor Name': totalExpense }
        const monthlyGpMap = {}; // { 'Jan': { totalGp: 0, count: 0 } }

        // Initialize Monthly Map
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        months.forEach(m => monthlyGpMap[m] = { totalGp: 0, count: 0 });

        opportunities.forEach(opp => {
            const status = opp.commonDetails?.status || opp.statusStage;
            const trainingMonth = opp.commonDetails?.monthOfTraining;
            const trainingYear = opp.commonDetails?.year; // Number

            // 1. KPIs
            const isCompleted = status === 'Completed' || opp.progressPercentage === 100;

            if (isCompleted) {
                completed++;
                // Check Pending Feedback
                if (!opp.deliveryDocuments?.feedback) {
                    pendingFeedback++;
                }
            } else if (status !== 'Cancelled' && status !== 'Discontinued' && status !== 'Lost') {
                active++;
            }

            // Scheduled This Month
            if (trainingMonth === currentMonthName && trainingYear === year) {
                scheduledMonth++;
            }

            // SME Deployed
            if (opp.selectedSME) {
                smeDeployed++;
            }

            // 2. Sales Executive Wise Count
            const salesName = opp.commonDetails?.sales?.name || 'Unassigned';
            salesCountMap[salesName] = (salesCountMap[salesName] || 0) + 1;

            // 3. Vendor Spend (Using SME Company or Name)
            // Calculate total vendor expense from this opportunity
            const exp = opp.expenses || {};
            const totalVendorExpense = (exp.trainerCost || 0) + (exp.material || 0) + (exp.labs || 0) + (exp.venue || 0) + (exp.travel || 0) + (exp.accommodation || 0);

            if (totalVendorExpense > 0) {
                // Prioritize SME Company Name, then SME Name, then 'Unknown'
                let vendorName = 'Unknown';
                if (opp.selectedSME) {
                    vendorName = opp.selectedSME.companyName || opp.selectedSME.name;
                } else if (opp.expenses?.vendorName) { // Fallback if we stored manual name
                    vendorName = opp.expenses.vendorName;
                }

                vendorSpendMap[vendorName] = (vendorSpendMap[vendorName] || 0) + totalVendorExpense;
            }

            // 4. Monthly GP% (Only for current year)
            // Fix: Map "January" -> "Jan" to match monthlyGpMap keys
            const shortMonthMap = {
                'January': 'Jan', 'February': 'Feb', 'March': 'Mar', 'April': 'Apr', 'May': 'May', 'June': 'Jun',
                'July': 'Jul', 'August': 'Aug', 'September': 'Sep', 'October': 'Oct', 'November': 'Nov', 'December': 'Dec'
            };
            const targetMonth = shortMonthMap[trainingMonth] || trainingMonth; // Fallback if already short or undefined

            if (trainingYear == year && targetMonth && monthlyGpMap[targetMonth]) {
                const gpPercent = opp.financials?.grossProfitPercent || 0;
                // Only consider if GP is calculated/meaningful (e.g. > -100)
                monthlyGpMap[targetMonth].totalGp += gpPercent;
                monthlyGpMap[targetMonth].count++;
            }
        });

        // --- FORMAT CHARTS ---

        // 1. Sales Wise
        /* Real Logic commented out for demo
         const salesChart = Object.keys(salesCountMap).map(key => ({
            name: key,
            count: salesCountMap[key]
        })).sort((a, b) => b.count - a.count);
        */

        // Mix real data with mock data as requested
        const salesChart = [
            ...Object.keys(salesCountMap).map(key => ({ name: key, count: salesCountMap[key] })),
            { name: 'Priya Sharma', count: 12 },
            { name: 'Rohan Mehta', count: 9 },
            { name: 'Anjali Gupta', count: 7 }
        ].sort((a, b) => b.count - a.count);


        // 2. Top 5 Vendors (Mock Data for Demo as requested)
        // 2. Top 5 Vendors (Mock Data for Demo as requested)
        const vendorChart = [
            { name: 'TechFlow Solutions', value: 1250000 },
            { name: 'Global Knowledge', value: 980000 },
            { name: 'LearnRight Systems', value: 750000 },
            { name: 'EduCore Inc', value: 620000 },
            { name: 'SkillBase', value: 450000 }
        ];

        /* Real logic commented out for demo
        const vendorChart = Object.keys(vendorSpendMap).map(key => ({
            name: key,
            value: vendorSpendMap[key]
        }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 5);
        */

        // 3. Avg GP Trend
        const avgGpChart = months.map(m => ({
            name: m,
            gp: monthlyGpMap[m].count > 0 ? parseFloat((monthlyGpMap[m].totalGp / monthlyGpMap[m].count).toFixed(1)) : 0
        }));

        res.json({
            stats: {
                active,
                scheduledMonth,
                completed,
                smeDeployed,
                pendingFeedback
            },
            charts: {
                salesChart,
                vendorChart,
                avgGpChart
            }
        });

    } catch (err) {
        console.error('Error in /delivery/revamp-stats:', err);
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;
