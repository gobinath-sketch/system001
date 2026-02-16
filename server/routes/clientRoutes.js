const express = require('express');
const router = express.Router();
const Client = require('../models/Client');
const User = require('../models/User');
const { protect, authorize } = require('../middleware/authMiddleware');

// Helper to get accessible user IDs
const getAccessibleUserIds = async (user) => {
    if (user.role === 'Sales Executive') {
        return [user._id];
    } else if (user.role === 'Sales Manager') {
        const team = await User.find({ reportingManager: user._id });
        return [user._id, ...team.map(u => u._id)];
    } else if (user.role === 'Business Head') {
        // Get all Sales Managers reporting to Business Head
        const managers = await User.find({ reportingManager: user._id, role: 'Sales Manager' });
        const managerIds = managers.map(m => m._id);

        // Get all Sales Executives reporting to those managers
        const executives = await User.find({ reportingManager: { $in: managerIds }, role: 'Sales Executive' });
        const executiveIds = executives.map(e => e._id);

        return [user._id, ...managerIds, ...executiveIds];
    } else {
        return []; // Director sees all
    }
};

// @route   POST /api/clients
// @desc    Create a new client
// @access  Private (Sales Executive, Sales Manager)
router.post('/', protect, authorize('Sales Executive', 'Sales Manager', 'Business Head'), async (req, res) => {
    try {
        console.log('📝 Creating client with data:', req.body);
        console.log('👤 User:', req.user?.name, req.user?.role);

        const { companyName, sector, contactPersons } = req.body;

        const client = new Client({
            companyName,
            sector,
            contactPersons: contactPersons || [],
            createdBy: req.user._id
        });

        await client.save();
        console.log('✅ Client created successfully:', client._id);
        res.status(201).json(client);
    } catch (error) {
        console.error('❌ Error creating client:', error.message);
        console.error('Full error:', error);
        res.status(400).json({ message: error.message });
    }
});

// @route   GET /api/clients/check-duplicate
// @desc    Check if client exists by name
// @access  Private
router.get('/check-duplicate', protect, async (req, res) => {
    try {
        const { name } = req.query;
        if (!name) {
            return res.status(400).json({ message: 'Company name is required' });
        }

        // Escape regex special characters
        const escapedName = name.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');

        // Case insensitive search
        const client = await Client.findOne({
            companyName: { $regex: new RegExp(`^${escapedName}$`, 'i') }
        });

        if (client) {
            return res.json({ exists: true, client });
        }

        res.json({ exists: false });
    } catch (error) {
        console.error('❌ Error checking details:', error.message);
        res.status(500).json({ message: error.message });
    }
});

// @route   GET /api/clients
// @desc    Get all clients (filtered by role)
// @access  Private
router.get('/', protect, async (req, res) => {
    try {
        console.log('🔍 Fetching clients for user:', req.user?.name, req.user?.role);

        const accessibleUserIds = await getAccessibleUserIds(req.user);
        console.log('📋 Accessible user IDs:', accessibleUserIds);

        let filter = {};
        if (accessibleUserIds.length > 0) {
            filter.createdBy = { $in: accessibleUserIds };
        }

        console.log('🔎 Filter being used:', filter);

        const clients = await Client.find(filter)
            .populate('createdBy', 'name creatorCode')
            .sort({ createdAt: -1 });

        console.log(`✅ Found ${clients.length} clients`);
        res.json(clients);
    } catch (error) {
        console.error('❌ Error fetching clients:', error);
        res.status(500).json({ message: error.message });
    }
});

// @route   PUT /api/clients/:id
// @desc    Update a client
// @access  Private (Sales Executive, Sales Manager)
router.put('/:id', protect, authorize('Sales Executive', 'Sales Manager', 'Business Head'), async (req, res) => {
    try {
        console.log(`📝 Updating client ${req.params.id} with data:`, req.body);

        let client = await Client.findById(req.params.id);

        if (!client) {
            return res.status(404).json({ message: 'Client not found' });
        }

        // Check ownership/permissions (optional: allow managers to edit team's clients)
        // For now, if they can see it (checked in GET), they might be allowed to edit it.
        // Or strictly strictly only creator? Let's assume team members can edit.

        const { companyName, sector, contactPersons } = req.body;

        client.companyName = companyName || client.companyName;
        client.sector = sector || client.sector;
        client.contactPersons = contactPersons || client.contactPersons;

        await client.save();
        console.log('✅ Client updated successfully');
        res.json(client);
    } catch (error) {
        console.error('❌ Error updating client:', error.message);
        res.status(400).json({ message: error.message });
    }
});

module.exports = router;
