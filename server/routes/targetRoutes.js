const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { protect, authorize } = require('../middleware/authMiddleware');

// @route   POST /api/targets
// @desc    Set or update targets for a user
// @access  Private (Director, Sales Manager)
router.post('/', protect, authorize('Director', 'Sales Manager'), async (req, res) => {
    try {
        const { userId, year, period, amount } = req.body;

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Check if target exists for this year/period
        const existingTargetIndex = user.targets.findIndex(
            t => t.year === year && t.period === period
        );

        if (existingTargetIndex > -1) {
            // Update existing
            user.targets[existingTargetIndex].amount = amount;
        } else {
            // Add new
            user.targets.push({ year, period, amount });
        }

        await user.save();
        res.json({ message: 'Target updated successfully', targets: user.targets });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// @route   GET /api/targets/:userId
// @desc    Get targets for a user
// @access  Private
router.get('/:userId', protect, async (req, res) => {
    try {
        // Access control: User can see own, Manager can see team's
        if (req.user._id.toString() !== req.params.userId && req.user.role === 'Sales Executive') {
            return res.status(403).json({ message: 'Not authorized' });
        }

        const user = await User.findById(req.params.userId).select('targets');
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        res.json(user.targets);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;
