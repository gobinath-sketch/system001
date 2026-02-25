const express = require('express');
const router = express.Router();
const Approval = require('../models/Approval');

const Opportunity = require('../models/Opportunity');
const User = require('../models/User');
const { protect, authorize } = require('../middleware/authMiddleware');

// @route   GET /api/approvals
// @desc    Get approvals based on user role
// @access  Private (Director, Sales Manager)
router.get('/', protect, authorize('Director', 'Sales Manager', 'Business Head'), async (req, res) => {
    try {
        let filter = {};

        if (req.user.role === 'Director') {
            filter.approvalLevel = 'Director';
            filter.assignedTo = req.user._id;
        } else if (req.user.role === 'Sales Manager') {
            filter.approvalLevel = 'Manager';
            filter.assignedTo = req.user._id;
        } else if (req.user.role === 'Business Head') {
            filter.approvalLevel = 'Business Head';
            filter.assignedTo = req.user._id;
        }

        const approvals = await Approval.find(filter)
            .populate('opportunity', 'opportunityNumber type client participants days expenses commonDetails')
            .populate({
                path: 'opportunity',
                populate: { path: 'client', select: 'companyName' }
            })
            .populate('requestedBy', 'name email')
            .sort({ requestedAt: -1 });

        res.json(approvals);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @route   GET /api/approvals/opportunity/:opportunityId
// @desc    Get approvals for specific opportunity (matches real-time opportunity state)
// @access  Private
router.get('/opportunity/:opportunityId', protect, async (req, res) => {
    try {
        const opportunity = await Opportunity.findById(req.params.opportunityId);
        if (!opportunity) return res.json([]);

        const gpValue = Number(opportunity.expenses?.targetGpPercent ?? 30);
        const contValue = Number(opportunity.expenses?.contingencyPercent ?? 15);

        const latestGP = await Approval.findOne({ opportunity: req.params.opportunityId, triggerReason: 'gp' })
            .sort({ createdAt: -1 }).populate('assignedTo', 'name role');
        const latestContingency = await Approval.findOne({ opportunity: req.params.opportunityId, triggerReason: 'contingency' })
            .sort({ createdAt: -1 }).populate('assignedTo', 'name role');

        const activeApprovals = [];
        // As long as there is a latest request and it isn't ancient, push it so the UI can draw its status
        if (latestGP) {
            activeApprovals.push(latestGP);
        }
        if (latestContingency) {
            activeApprovals.push(latestContingency);
        }

        // Only return if the opportunity is actually tracked in an approval flow (Not Draft or Not Required)
        if (activeApprovals.length > 0 && typeof opportunity.approvalStatus === 'string' && opportunity.approvalStatus !== 'Draft' && opportunity.approvalStatus !== 'Not Required') {
            return res.json(activeApprovals.reverse());
        }

        return res.json([]);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @route   POST /api/approvals/:id/approve
// @desc    Approve a pending approval
// @access  Private (Director, Sales Manager)
router.post('/:id/approve', protect, authorize('Director', 'Sales Manager', 'Business Head'), async (req, res) => {
    try {
        const approval = await Approval.findById(req.params.id);

        if (!approval) {
            return res.status(404).json({ message: 'Approval not found' });
        }

        if (approval.status !== 'Pending') {
            return res.status(400).json({ message: 'Approval already processed' });
        }

        // Verify user has permission to approve this level and assignment
        if (approval.assignedTo && approval.assignedTo.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: 'Not authorized to approve this request' });
        }
        if (approval.approvalLevel === 'Director' && req.user.role !== 'Director') {
            return res.status(403).json({ message: 'Only Director can approve this request' });
        }
        if (approval.approvalLevel === 'Business Head' && req.user.role !== 'Business Head') {
            return res.status(403).json({ message: 'Only Business Head can approve this request' });
        }
        if (approval.approvalLevel === 'Manager' && req.user.role !== 'Sales Manager') {
            return res.status(403).json({ message: 'Only Sales Manager can approve this request' });
        }

        // Update approval
        approval.status = 'Approved';
        approval.approvedBy = req.user._id;
        approval.approvedAt = new Date();
        await approval.save();

        // Check if there are any other pending requests for the same opportunity
        const pendingApprovals = await Approval.countDocuments({
            opportunity: approval.opportunity,
            status: 'Pending',
            _id: { $ne: approval._id }
        });

        const opportunity = await Opportunity.findById(approval.opportunity);

        if (pendingApprovals === 0) {
            // All required approvals obtained
            if (opportunity) {
                opportunity.approvalStatus = 'Approved';
                opportunity.approvalRequired = false;
                opportunity.approvedBy = req.user._id; // The last person to approve
                opportunity.approvedAt = new Date();
                await opportunity.save();
            }
        }
        // If pendingApprovals > 0, we don't change opportunity status, it stays 'Pending'.

        // Determine specific metric for notification Message
        let metricTitle = 'Approval';
        if (approval.triggerReason === 'gp') {
            metricTitle = 'Sales Profit Approval';
        } else if (approval.triggerReason === 'contingency') {
            metricTitle = 'Contingency Approval';
        }

        // Notification for Requester
        const Notification = require('../models/Notification');
        await Notification.create({
            recipientId: approval.requestedBy,
            triggeredBy: req.user._id,
            triggeredByName: req.user.name,
            type: 'approval_granted',
            message: `${metricTitle} Granted: Opportunity ${opportunity ? opportunity.opportunityNumber : 'Unknown'} approved by ${req.user.name}`,
            opportunityId: approval.opportunity,
            opportunityNumber: opportunity ? opportunity.opportunityNumber : 'Unknown',
            isRead: false,
            createdAt: Date.now()
        });

        res.json({ message: 'Approval granted', approval });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @route   POST /api/approvals/:id/reject
// @desc    Reject a pending approval
// @access  Private (Director, Sales Manager)
router.post('/:id/reject', protect, authorize('Director', 'Sales Manager', 'Business Head'), async (req, res) => {
    try {
        const { reason } = req.body;
        const approval = await Approval.findById(req.params.id);

        if (!approval) {
            return res.status(404).json({ message: 'Approval not found' });
        }

        if (approval.status !== 'Pending') {
            return res.status(400).json({ message: 'Approval already processed' });
        }

        if (approval.assignedTo && approval.assignedTo.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: 'Not authorized to reject this request' });
        }
        if (approval.approvalLevel === 'Director' && req.user.role !== 'Director') {
            return res.status(403).json({ message: 'Only Director can reject this request' });
        }
        if (approval.approvalLevel === 'Business Head' && req.user.role !== 'Business Head') {
            return res.status(403).json({ message: 'Only Business Head can reject this request' });
        }
        if (approval.approvalLevel === 'Manager' && req.user.role !== 'Sales Manager') {
            return res.status(403).json({ message: 'Only Sales Manager can reject this request' });
        }

        // Update approval
        approval.status = 'Rejected';
        approval.rejectedBy = req.user._id;
        approval.rejectedAt = new Date();
        approval.rejectionReason = reason || 'No reason provided';
        await approval.save();

        // Close any other pending requests for the same opportunity.
        await Approval.updateMany({
            opportunity: approval.opportunity,
            status: 'Pending',
            _id: { $ne: approval._id }
        }, {
            $set: {
                status: 'Rejected',
                rejectedBy: req.user._id,
                rejectedAt: new Date(),
                rejectionReason: 'Superseded by another processed approval request'
            }
        });

        // Update Opportunity Status
        const opportunity = await Opportunity.findById(approval.opportunity);
        if (opportunity) {
            opportunity.approvalStatus = 'Rejected';
            opportunity.approvalRequired = false;
            opportunity.rejectedBy = req.user._id;
            opportunity.rejectedAt = new Date();
            opportunity.rejectionReason = reason || 'No reason provided';
            await opportunity.save();
        }



        // Notification for Requester
        const Notification = require('../models/Notification');
        await Notification.create({
            recipientId: approval.requestedBy,
            triggeredBy: req.user._id,
            triggeredByName: req.user.name,
            type: 'approval_rejected',
            message: `Approval Rejected: ${reason || 'No reason provided'}`,
            opportunityId: approval.opportunity,
            opportunityNumber: opportunity ? opportunity.opportunityNumber : 'Unknown',
            isRead: false,
            createdAt: Date.now()
        });

        res.json({ message: 'Approval rejected', approval });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});



// @route   POST /api/approvals/escalate
// @desc    Escalate opportunity based on Sales Profit% and Contingency%
// @access  Private (Sales Executive)
router.post('/escalate', protect, authorize('Sales Executive', 'Sales Manager', 'Business Head'), async (req, res) => {
    try {
        const { opportunityId, gpPercent, tov, totalExpense, contingencyPercent, triggers } = req.body;

        // Verify opportunity ownership
        const opportunity = await Opportunity.findById(opportunityId);
        if (!opportunity) {
            return res.status(404).json({ message: 'Opportunity not found' });
        }
        if (opportunity.createdBy.toString() !== req.user._id.toString() && req.user.role !== 'Sales Manager' && req.user.role !== 'Business Head') {
            return res.status(403).json({ message: 'Not authorized' });
        }

        const validTriggers = Array.isArray(triggers) && triggers.length > 0 ? triggers : ['gp', 'contingency'];

        // Prevent duplicate approval cycle unless values actually changed
        const existingPending = await Approval.find({
            opportunity: opportunityId,
            status: 'Pending',
            triggerReason: { $in: validTriggers }
        }).sort({ createdAt: 1 });

        if (existingPending && existingPending.length > 0) {
            // Check if the new values differ from the pending cycle
            const lastPending = existingPending[existingPending.length - 1]; // they were all created together
            const gpChanged = validTriggers.includes('gp') && Math.abs((lastPending.gpPercent || 0) - gpPercent) > 0.01;
            const contingencyChanged = validTriggers.includes('contingency') && Math.abs((lastPending.contingencyPercent || 0) - contingencyPercent) > 0.01;

            if (!gpChanged && !contingencyChanged) {
                return res.status(400).json({
                    message: 'An active approval cycle is already pending for these requested parameters.'
                });
            } else {
                // Values changed! Mark the old pending ones as superseded (Rejected)
                await Approval.updateMany({
                    opportunity: opportunityId,
                    status: 'Pending',
                    triggerReason: { $in: validTriggers }
                }, {
                    $set: {
                        status: 'Rejected',
                        rejectedBy: req.user._id,
                        rejectedAt: new Date(),
                        rejectionReason: 'Superseded by updated financial values before approval'
                    }
                });
            }
        }

        const manager = await User.findOne({
            role: 'Sales Manager',
            territory: req.user.territory || opportunity.region
        });

        // Determine Business Head correctly
        let businessHeadRole = 'Business Head'; // default fallback
        if (opportunity.type) {
            if (opportunity.type === 'Corporate Training' || opportunity.type === 'Retail Training') {
                businessHeadRole = 'Business Head LC';
            } else if (opportunity.type === 'HTD' || opportunity.type === 'Product Support') {
                businessHeadRole = 'Business Head HTD';
            }
        }
        let businessHead = await User.findOne({ role: businessHeadRole });
        if (!businessHead) {
            businessHead = await User.findOne({ role: 'Business Head' });
        }
        const director = await User.findOne({ role: 'Director' });

        const approvalRequests = [];

        // Check Contingency
        if (validTriggers.includes('contingency')) {
            if (contingencyPercent < 5) {
                if (!businessHead) return res.status(400).json({ message: 'No approver found for Business Head' });
                approvalRequests.push({
                    level: 'Business Head',
                    assignedTo: businessHead._id,
                    reason: 'Contingency < 5%',
                    triggerReason: 'contingency'
                });
            } else if (contingencyPercent < 10) {
                // If the requester is a Sales Executive, it goes to the Manager.
                // Sales Managers and Business Heads have freedom to apply 5-15% without restriction.
                if (req.user.role === 'Sales Executive') {
                    if (!manager) return res.status(400).json({ message: 'No approver found for Manager' });
                    approvalRequests.push({
                        level: 'Manager',
                        assignedTo: manager._id,
                        reason: 'Contingency 5-9%',
                        triggerReason: 'contingency'
                    });
                }
            }
        }

        // Check GP
        if (validTriggers.includes('gp')) {
            if (gpPercent <= 5) {
                if (!director) return res.status(400).json({ message: 'No approver found for Director' });
                approvalRequests.push({
                    level: 'Director',
                    assignedTo: director._id,
                    reason: 'Sales Profit <= 5%',
                    triggerReason: 'gp'
                });
            } else if (gpPercent < 15) {
                if (!manager) return res.status(400).json({ message: 'No approver found for Manager' });

                approvalRequests.push({
                    level: 'Manager',
                    assignedTo: manager._id,
                    reason: 'Sales Profit 5-14%',
                    triggerReason: 'gp'
                });
            }
        }

        if (approvalRequests.length === 0) {
            return res.status(400).json({ message: 'No approval required based on current parameters.' });
        }

        const createdApprovals = [];
        const Notification = require('../models/Notification');

        for (const reqData of approvalRequests) {
            let metricTitle = 'Approval Request';
            if (reqData.triggerReason === 'gp') metricTitle = 'Sales Profit Approval Request';
            if (reqData.triggerReason === 'contingency') metricTitle = 'Contingency Approval Request';

            const approval = new Approval({
                opportunity: opportunityId,
                gpPercent,
                contingencyPercent,
                triggerReason: reqData.triggerReason, // Used as primary trigger, even if combo
                approvalLevel: reqData.level,
                assignedTo: reqData.assignedTo,
                requestedBy: req.user._id,
                snapshot: {
                    totalExpense,
                    tov,
                    gktRevenue: tov - totalExpense,
                    grossProfit: tov - totalExpense,
                    contingencyPercent
                }
            });
            await approval.save();
            createdApprovals.push(approval);

            // Notification for Approver
            await Notification.create({
                recipientId: reqData.assignedTo,
                triggeredBy: req.user._id,
                triggeredByName: req.user.name,
                type: 'approval_request',
                message: `${metricTitle}: Opportunity ${opportunity.opportunityNumber} by ${req.user.name}`,
                opportunityId: opportunity._id,
                opportunityNumber: opportunity.opportunityNumber,
                isRead: false,
                createdAt: Date.now()
            });
        }

        // Update Opportunity Status to pending multi-level
        // We set to 'Pending' overall. Individual statuses are fetched via GET /opportunity/:id
        opportunity.approvalStatus = 'Pending';
        opportunity.approvalRequired = true;
        await opportunity.save();

        res.status(201).json({ message: 'Approval requests sent successfully', approvals: createdApprovals });
    } catch (error) {
        console.error('Approval error:', error);
        res.status(500).json({ message: error.message });
    }
});

// @route   PUT /api/approvals/:id/read
// @desc    Mark approval as read
// @access  Private (Director, Sales Manager)
router.put('/:id/read', protect, authorize('Director', 'Sales Manager', 'Business Head'), async (req, res) => {
    try {
        const approval = await Approval.findById(req.params.id);
        if (!approval) {
            return res.status(404).json({ message: 'Approval not found' });
        }

        // Authorization: Only assigned approver can mark as read.
        if (approval.assignedTo && approval.assignedTo.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: 'Not authorized' });
        }

        approval.isRead = true;
        await approval.save();
        res.json({ message: 'Marked as read' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;
