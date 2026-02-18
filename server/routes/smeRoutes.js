const express = require('express');
const router = express.Router();
const SME = require('../models/SME');
const { protect, authorize } = require('../middleware/authMiddleware');
const path = require('path');
const fs = require('fs');
const multer = require('multer');

// Ensure upload directory exists
const uploadDir = path.join(__dirname, '../uploads/smes/');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// File Upload Config for SME documents
const storage = multer.diskStorage({
    destination(req, file, cb) {
        cb(null, uploadDir);
    },
    filename(req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, `sme-${uniqueSuffix}${path.extname(file.originalname)}`);
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: function (req, file, cb) {
        const allowedTypes = /pdf|doc|docx|jpg|jpeg|png/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        if (extname) {
            return cb(null, true);
        }
        cb(new Error('Only PDF, DOC, DOCX, JPG, and PNG files are allowed'));
    }
});

const uploadMiddleware = (req, res, next) => {
    upload.fields([
        { name: 'sowDocument', maxCount: 1 },
        { name: 'ndaDocument', maxCount: 1 },
        { name: 'sme_profile', maxCount: 1 },
        { name: 'idProof', maxCount: 1 },
        { name: 'panDocument', maxCount: 1 },
        { name: 'gstDocument', maxCount: 1 }
    ])(req, res, function (err) {
        if (err instanceof multer.MulterError) {
            console.error('Multer Error:', err);
            return res.status(400).json({ message: `Upload Error: ${err.message}` });
        } else if (err) {
            console.error('Upload Unknown Error:', err);
            return res.status(500).json({ message: `Upload Error: ${err.message}` });
        }
        next();
    });
};

// @route   POST /api/smes
// @desc    Create new SME (Company or Freelancer)
// @access  Private (Sales, Manager, Director, Delivery Team)
router.post('/', protect, authorize('Sales Executive', 'Sales Manager', 'Director', 'Delivery Team'), uploadMiddleware, async (req, res) => {
    try {
        const smeData = { ...req.body, createdBy: req.user._id };

        // Parse bankDetails if it's a string (from FormData)
        if (typeof smeData.bankDetails === 'string') {
            try {
                smeData.bankDetails = JSON.parse(smeData.bankDetails);
            } catch (e) {
                return res.status(400).json({ message: 'Invalid bank details format' });
            }
        }

        // Handle file uploads
        if (req.files) {
            if (req.files.sowDocument) smeData.sowDocument = req.files.sowDocument[0].path;
            if (req.files.ndaDocument) smeData.ndaDocument = req.files.ndaDocument[0].path;
            if (req.files.sme_profile) smeData.sme_profile = req.files.sme_profile[0].path;
            if (req.files.idProof) smeData.idProof = req.files.idProof[0].path;
            if (req.files.panDocument) smeData.panDocument = req.files.panDocument[0].path;
            if (req.files.gstDocument) smeData.gstDocument = req.files.gstDocument[0].path;
        }

        // Validate required documents (Manual check for safety, though schema handles it)
        const requiredDocs = ['sowDocument', 'ndaDocument', 'sme_profile', 'panDocument', 'gstDocument'];
        const missingDocs = requiredDocs.filter(doc => !smeData[doc]);

        if (missingDocs.length > 0) {
            return res.status(400).json({ message: `Missing required documents: ${missingDocs.join(', ')}` });
        }

        const sme = new SME(smeData);
        await sme.save();

        res.status(201).json({
            message: 'SME created successfully',
            sme
        });
    } catch (err) {
        console.error('SME creation error:', err);
        res.status(500).json({ message: err.message });
    }
});

// @route   GET /api/smes
// @desc    Get all SMEs
// @access  Private
router.get('/', protect, async (req, res) => {
    try {
        const { technology, type, search } = req.query;

        const filter = { isActive: true };

        if (technology) filter.technology = new RegExp(technology, 'i');
        if (type) filter.smeType = type;

        if (search) {
            const searchRegex = new RegExp(search, 'i');
            filter.$or = [
                { name: searchRegex },
                { companyName: searchRegex },
                { email: searchRegex }
            ];
        }

        const smes = await SME.find(filter)
            .populate('createdBy', 'name email')
            .populate('createdBy', 'name email')
            .sort({ createdAt: -1 });

        res.json(smes);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// @route   GET /api/smes/vendor/:vendorId
// @desc    Get all SMEs for a vendor (Legacy support)
// @access  Private


// @route   GET /api/smes/:id
// @desc    Get SME by ID
// @access  Private
router.get('/:id', protect, async (req, res) => {
    try {
        const sme = await SME.findById(req.params.id)
            // companyVendor population removed
            .populate('createdBy', 'name email');

        if (!sme) {
            return res.status(404).json({ message: 'SME not found' });
        }

        res.json(sme);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// @route   PUT /api/smes/:id
// @desc    Update SME
// @access  Private (Sales, Manager, Director, Delivery Team)
router.put('/:id', protect, authorize('Sales Executive', 'Sales Manager', 'Director', 'Delivery Team'), uploadMiddleware, async (req, res) => {
    try {
        const sme = await SME.findById(req.params.id);

        if (!sme) {
            return res.status(404).json({ message: 'SME not found' });
        }

        const updateData = { ...req.body };

        // Parse bankDetails if string
        if (typeof updateData.bankDetails === 'string') {
            try {
                updateData.bankDetails = JSON.parse(updateData.bankDetails);
            } catch (e) {
                return res.status(400).json({ message: 'Invalid bank details format' });
            }
        }

        // Handle file uploads - only update if new file provided
        if (req.files) {
            if (req.files.sowDocument) updateData.sowDocument = req.files.sowDocument[0].path;
            if (req.files.ndaDocument) updateData.ndaDocument = req.files.ndaDocument[0].path;
            if (req.files.sme_profile) updateData.sme_profile = req.files.sme_profile[0].path;
            if (req.files.idProof) updateData.idProof = req.files.idProof[0].path;
            if (req.files.panDocument) updateData.panDocument = req.files.panDocument[0].path;
            if (req.files.gstDocument) updateData.gstDocument = req.files.gstDocument[0].path;
        }

        // Apply updates
        Object.keys(updateData).forEach(key => {
            sme[key] = updateData[key];
        });

        await sme.save();

        res.json({
            message: 'SME updated successfully',
            sme
        });
    } catch (err) {
        console.error('SME update error:', err);
        res.status(500).json({ message: err.message });
    }
});

// @route   DELETE /api/smes/:id
// @desc    Delete SME (soft delete)
// @access  Private (Manager, Director)
router.delete('/:id', protect, authorize('Sales Manager', 'Director'), async (req, res) => {
    try {
        const sme = await SME.findById(req.params.id);

        if (!sme) {
            return res.status(404).json({ message: 'SME not found' });
        }

        sme.isActive = false;
        await sme.save();

        res.json({ message: 'SME deleted successfully' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;
