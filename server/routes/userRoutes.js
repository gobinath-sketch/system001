const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const User = require('../models/User');

const ROLE_BY_ACCESS = {
    'Sales Executive': 'Sales Executive',
    'Sales Manager': 'Sales Manager',
    'Business Head': 'Business Head',
    'Delivery Head': 'Delivery Head',
    'Delivery Executive': 'Delivery Executive',
    'Director': 'Director',
    'Finance': 'Finance'
};

const getPrefix = (role) => {
    if (role === 'Business Head' || role === 'Director') return 'B';
    if (role === 'Sales Manager') return 'M';
    if (role === 'Delivery Head' || role === 'Delivery Executive') return 'D';
    if (role === 'Finance') return 'F';
    return 'E'; // Default for Sales Executive
};

// ==========================================
// USER CRUD OPERATIONS (FOR POSTMAN / ADMIN)
// ==========================================

// @route   POST /api/users
// @desc    Create a new user
// @access  Public
router.post('/', async (req, res) => {
    try {
        const { name, email, role: rawRole, password, designation, department, reportingManager } = req.body;

        if (!name || !email || !rawRole) {
            return res.status(400).json({ message: 'Name, email, and role are required' });
        }

        const emailLower = String(email).trim().toLowerCase();
        let user = await User.findOne({ email: emailLower });

        if (user) {
            return res.status(400).json({ message: 'User already exists with this email.' });
        }

        const role = ROLE_BY_ACCESS[rawRole] || rawRole;
        const prefix = getPrefix(role);

        // Logic to generate the next creatorCode (e.g., E1, M2, D3)
        const allUsers = await User.find({}).select('creatorCode');
        let maxCounter = 0;
        allUsers.forEach(u => {
            if (u.creatorCode && u.creatorCode.charAt(0) === prefix) {
                const num = parseInt(u.creatorCode.substring(1), 10);
                if (!isNaN(num) && num > maxCounter) {
                    maxCounter = num;
                }
            }
        });
        const creatorCode = `${prefix}${maxCounter + 1}`;

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password || 'password123', salt);

        // Build the new user object
        user = new User({
            name,
            email: emailLower,
            password: hashedPassword,
            role,
            creatorCode
        });

        // Add profile settings (designation, department)
        user.settings = { profile: {} };
        if (designation) user.settings.profile.designation = designation;
        if (department) user.settings.profile.department = department;

        // Optionally attach a reporting manager by Name
        if (reportingManager) {
            // Normalize the incoming name to match the DB
            const normalizeName = (val) => String(val).toLowerCase().replace(/\s+/g, ' ').trim();
            const searchName = normalizeName(reportingManager);

            // Find manager in the DB
            const allUsersForManager = await User.find({});
            const manager = allUsersForManager.find(u => normalizeName(u.name) === searchName);

            if (manager) {
                user.reportingManager = manager._id;
            } else {
                console.warn(`[API Warning] Reporting manager "${reportingManager}" not found in DB.`);
            }
        }

        await user.save();

        // Return user without password
        const userResponse = user.toObject();
        delete userResponse.password;

        res.status(201).json({
            message: 'User created successfully.',
            user: userResponse
        });

    } catch (err) {
        console.error('Error creating user:', err);
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// @route   GET /api/users
// @desc    Get all users
// @access  Public
router.get('/', async (req, res) => {
    try {
        // Exclude passwords from the response
        const users = await User.find({}).select('-password').populate('reportingManager', 'name email role creatorCode');
        res.status(200).json(users);
    } catch (err) {
        console.error('Error fetching users:', err);
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// @route   GET /api/users/:id
// @desc    Get a single user by ID
// @access  Public
router.get('/:id', async (req, res) => {
    try {
        const user = await User.findById(req.params.id)
            .select('-password')
            .populate('reportingManager', 'name email role creatorCode');

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        res.status(200).json(user);
    } catch (err) {
        console.error('Error fetching user:', err);
        if (err.kind === 'ObjectId') {
            return res.status(404).json({ message: 'Invalid User ID format' });
        }
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// @route   PUT /api/users/:id
// @desc    Update an existing user
// @access  Public
router.put('/:id', async (req, res) => {
    try {
        const { name, email, role: rawRole, designation, department, reportingManager } = req.body;

        let user = await User.findById(req.params.id);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        if (name) user.name = name;
        if (email) user.email = String(email).trim().toLowerCase();

        // Handle Role Updates (and possibly generating a new creatorCode if Role Prefix changes)
        if (rawRole) {
            const role = ROLE_BY_ACCESS[rawRole] || rawRole;
            const newPrefix = getPrefix(role);
            const oldPrefix = user.creatorCode ? user.creatorCode.charAt(0) : '';

            user.role = role;

            // If their new role gives them a different prefix (e.g. Sales Exec 'E' -> Sales Manager 'M')
            if (newPrefix !== oldPrefix) {
                const allUsers = await User.find({}).select('creatorCode');
                let maxCounter = 0;
                allUsers.forEach(u => {
                    if (u.creatorCode && u.creatorCode.charAt(0) === newPrefix) {
                        const num = parseInt(u.creatorCode.substring(1), 10);
                        if (!isNaN(num) && num > maxCounter) {
                            maxCounter = num;
                        }
                    }
                });
                user.creatorCode = `${newPrefix}${maxCounter + 1}`;
            }
        }

        // Handle Profile Updates
        if (designation !== undefined || department !== undefined) {
            user.settings = user.settings || {};
            user.settings.profile = user.settings.profile || {};
            if (designation !== undefined) user.settings.profile.designation = designation;
            if (department !== undefined) user.settings.profile.department = department;
        }

        // Handle Reporting Manager
        if (reportingManager !== undefined) {
            if (reportingManager === "") {
                user.reportingManager = null;
            } else {
                const normalizeName = (val) => String(val).toLowerCase().replace(/\s+/g, ' ').trim();
                const searchName = normalizeName(reportingManager);

                const allUsersForManager = await User.find({});
                const manager = allUsersForManager.find(u => normalizeName(u.name) === searchName);

                if (manager) {
                    user.reportingManager = manager._id;
                } else {
                    console.warn(`[API Warning] Reporting manager "${reportingManager}" not found in DB.`);
                    // We don't overwrite the existing manager if the new name is invalid
                }
            }
        }

        await user.save();

        const userResponse = user.toObject();
        delete userResponse.password;

        res.status(200).json({
            message: 'User updated successfully',
            user: userResponse
        });

    } catch (err) {
        console.error('Error updating user:', err);
        if (err.kind === 'ObjectId') {
            return res.status(404).json({ message: 'Invalid User ID format' });
        }
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// @route   PUT /api/users/:id/reset-password
// @desc    Admin manual password reset for a user
// @access  Public (Should ideally be restricted to Admin eventually)
router.put('/:id/reset-password', async (req, res) => {
    try {
        const { newPassword } = req.body;

        if (!newPassword || newPassword.length < 6) {
            return res.status(400).json({ message: 'A new password of at least 6 characters is required' });
        }

        const user = await User.findById(req.params.id);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(newPassword, salt);

        await user.save();

        res.status(200).json({ message: 'User password reset successfully.' });
    } catch (err) {
        console.error('Error resetting password:', err);
        if (err.kind === 'ObjectId') {
            return res.status(404).json({ message: 'Invalid User ID format' });
        }
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// @route   DELETE /api/users/:id
// @desc    Delete a user
// @access  Public
router.delete('/:id', async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        await User.findByIdAndDelete(req.params.id);
        res.status(200).json({ message: 'User deleted successfully' });
    } catch (err) {
        console.error('Error deleting user:', err);
        if (err.kind === 'ObjectId') {
            return res.status(404).json({ message: 'Invalid User ID format' });
        }
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

module.exports = router;
