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
        let filter = { status: 'Pending' };

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
            .populate('opportunity', 'opportunityNumber type client participants days')
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
            opportunity.approvalStatus = 'Approved';
            opportunity.approvalRequired = false;
            opportunity.approvedBy = req.user._id;
            opportunity.approvedAt = new Date();
            await opportunity.save();
        }



        // Notification for Requester
        const Notification = require('../models/Notification');
        await Notification.create({
            recipientId: approval.requestedBy,
            triggeredBy: req.user._id,
            triggeredByName: req.user.name,
            type: 'approval_granted',
            message: `Approval Granted: Opportunity ${approval.snapshot?.gktRevenue ? 'GP ' + approval.gpPercent.toFixed(1) + '%' : ''} approved by ${req.user.name}`,
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
// @desc    Escalate opportunity based on Sales Profit% or Contingency%
// @access  Private (Sales Executive)
router.post('/escalate', protect, authorize('Sales Executive', 'Sales Manager', 'Business Head'), async (req, res) => {
    try {
        const { opportunityId, gpPercent, tov, totalExpense, contingencyPercent, triggerReason } = req.body;

        // Verify opportunity ownership
        const opportunity = await Opportunity.findById(opportunityId);
        if (!opportunity) {
            return res.status(404).json({ message: 'Opportunity not found' });
        }
        if (opportunity.createdBy.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: 'Not authorized' });
        }

        const existingPendingApproval = await Approval.findOne({
            opportunity: opportunityId,
            status: 'Pending'
        });
        const opportunityIsPending = typeof opportunity.approvalStatus === 'string' && opportunity.approvalStatus.includes('Pending');
        if (existingPendingApproval && opportunityIsPending) {
            return res.status(200).json({
                message: 'Approval already pending for this opportunity',
                approval: existingPendingApproval
            });
        }
        if (existingPendingApproval && !opportunityIsPending) {
            await Approval.updateMany({
                opportunity: opportunityId,
                status: 'Pending'
            }, {
                $set: {
                    status: 'Rejected',
                    rejectedBy: req.user._id,
                    rejectedAt: new Date(),
                    rejectionReason: `Auto-closed after opportunity moved to ${opportunity.approvalStatus || 'non-pending'}`
                }
            });
        }

        const requester = await User.findById(req.user._id).populate('reportingManager');
        if (!requester?.reportingManager) {
            return res.status(400).json({ message: 'No reporting manager assigned' });
        }
        const manager = requester.reportingManager?.role === 'Sales Manager' ? requester.reportingManager : null;
        if (!manager) {
            return res.status(400).json({ message: 'No Sales Manager assigned in reporting chain' });
        }
        let businessHead = null;
        if (manager.reportingManager) {
            const managerHead = await User.findById(manager.reportingManager);
            if (managerHead?.role === 'Business Head') {
                businessHead = managerHead;
            }
        }
        const director = await User.findOne({ role: 'Director' });

        // Identify Approval Level & Assignee from requested trigger.
        const mode = triggerReason === 'contingency' ? 'contingency' : 'gp';
        let approvalLevel = 'Manager';
        let assignedTo = null;
        let nextStatus = 'Pending Manager';
        let approvalReason = '';

        if (mode === 'contingency') {
            if (contingencyPercent < 5) {
                approvalLevel = 'Business Head';
                nextStatus = 'Pending Business Head';
                approvalReason = 'Contingency < 5%';
                assignedTo = businessHead?._id;
            } else if (contingencyPercent < 10) {
                approvalLevel = 'Manager';
                nextStatus = 'Pending Manager';
                approvalReason = 'Contingency 5-9%';
                assignedTo = manager?._id;
            } else {
                return res.status(400).json({ message: 'Contingency is within allowed range. Approval not required.' });
            }
        } else {
            if (gpPercent < 5) {
                approvalLevel = 'Director';
                nextStatus = 'Pending Director';
                approvalReason = 'Sales Profit < 5%';
                assignedTo = director?._id;
            } else if (gpPercent < 10) {
                approvalLevel = 'Business Head';
                nextStatus = 'Pending Business Head';
                approvalReason = 'Sales Profit 5-9%';
                assignedTo = businessHead?._id;
            } else if (gpPercent < 15) {
                approvalLevel = 'Manager';
                nextStatus = 'Pending Manager';
                approvalReason = 'Sales Profit 10-14%';
                assignedTo = manager?._id;
            } else {
                return res.status(400).json({ message: 'Sales Profit is within allowed range. Approval not required.' });
            }
        }

        if (!assignedTo) {
            return res.status(400).json({ message: `No approver found for ${approvalLevel}` });
        }

        // Create approval request
        const approval = new Approval({
            opportunity: opportunityId,
            gpPercent,
            approvalLevel,
            assignedTo,
            requestedBy: req.user._id,
            snapshot: {
                totalExpense,
                tov,
                gktRevenue: tov - totalExpense,
                grossProfit: tov - totalExpense,
                contingencyPercent // Optional: store it
            }
        });

        await approval.save();

        // Force Update Opportunity Status to match the Escalation
        opportunity.approvalStatus = nextStatus;
        opportunity.approvalRequired = true;
        await opportunity.save();

        // Notification for Approver (Manager or Director)
        const Notification = require('../models/Notification');
        await Notification.create({
            recipientId: assignedTo,
            triggeredBy: req.user._id,
            triggeredByName: req.user.name,
            type: 'approval_request',
            message: `Approval Request: Opportunity ${opportunity.opportunityNumber} by ${req.user.name} (${approvalReason})`,
            opportunityId: opportunity._id,
            opportunityNumber: opportunity.opportunityNumber,
            isRead: false,
            createdAt: Date.now()
        });

        res.status(201).json({ message: `Approval sent ${approvalLevel}`, approval });
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
