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

const toUploadRelativePath = (filePath) => {
    if (!filePath) return filePath;
    const normalized = String(filePath).replace(/\\/g, '/');

    const uploadsIndex = normalized.toLowerCase().indexOf('/uploads/');
    if (uploadsIndex >= 0) {
        return normalized.slice(uploadsIndex + 1); // "uploads/..."
    }

    if (normalized.toLowerCase().startsWith('uploads/')) {
        return normalized;
    }

    const serverRoot = path.join(__dirname, '..');
    const relative = path.relative(serverRoot, filePath).replace(/\\/g, '/');
    if (relative && !relative.startsWith('..')) {
        return relative;
    }

    return normalized.replace(/^\/+/, '');
};

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
router.post('/', protect, authorize('Sales Executive', 'Sales Manager', 'Director', 'Delivery Head', 'Delivery Executive'), uploadMiddleware, async (req, res) => {
    try {
        const smeData = { ...req.body, createdBy: req.user._id };

        // Parse bankDetails if it's a string or array (from FormData)
        if (typeof smeData.bankDetails === 'string' || Array.isArray(smeData.bankDetails)) {
            try {
                let bdString = Array.isArray(smeData.bankDetails) ? smeData.bankDetails[0] : smeData.bankDetails;
                smeData.bankDetails = JSON.parse(bdString);
            } catch (e) {
                return res.status(400).json({ message: 'Invalid bank details format' });
            }
        }

        // Parse availability if it's a string or array
        if (typeof smeData.availability === 'string' || Array.isArray(smeData.availability)) {
            try {
                let availString = Array.isArray(smeData.availability) ? smeData.availability[0] : smeData.availability;
                smeData.availability = JSON.parse(availString);
                if (!smeData.availability.availableFrom) smeData.availability.availableFrom = null;
                if (!smeData.availability.availableUntil) smeData.availability.availableUntil = null;
                if (!smeData.availability.statusOverride) smeData.availability.statusOverride = null;
            } catch (e) {
                // Ignore parsing errors
            }
        }

        // Normalize numeric inputs coming from multipart/form-data.
        smeData.yearsExperience = Number(smeData.yearsExperience);

        // Handle file uploads
        if (req.files) {
            if (req.files.sowDocument) smeData.sowDocument = toUploadRelativePath(req.files.sowDocument[0].path);
            if (req.files.ndaDocument) smeData.ndaDocument = toUploadRelativePath(req.files.ndaDocument[0].path);
            if (req.files.sme_profile) smeData.sme_profile = toUploadRelativePath(req.files.sme_profile[0].path);
            if (req.files.idProof) smeData.idProof = toUploadRelativePath(req.files.idProof[0].path);
            if (req.files.panDocument) smeData.panDocument = toUploadRelativePath(req.files.panDocument[0].path);
            if (req.files.gstDocument) smeData.gstDocument = toUploadRelativePath(req.files.gstDocument[0].path);
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
        if (err.name === 'ValidationError' || err.name === 'CastError') {
            return res.status(400).json({ message: err.message });
        }
        res.status(500).json({ message: err.message });
    }
});

// @route   GET /api/smes
// @desc    Get all SMEs
// @access  Private
router.get('/', protect, async (req, res) => {
    try {
        const { technology, type, classification, status, search } = req.query;

        const filter = { isActive: true };

        if (classification) filter.classification = classification;
        if (technology) filter.technology = new RegExp(technology, 'i');
        if (type) filter.smeType = type;
        if (status) {
            filter['availability.currentStatus'] = status;
        }

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
            .sort({ createdAt: -1 });

        res.json(smes);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// @route   GET /api/smes/recommend
// @desc    Recommend SMEs based on technology, date availability, and location
// @access  Private (Sales, Manager, Director, Delivery Team)
router.get('/recommend', protect, authorize('Sales Executive', 'Sales Manager', 'Director', 'Delivery Head', 'Delivery Executive'), async (req, res) => {
    try {
        const { technology, location, startDate, endDate } = req.query;
        if (!technology) {
            return res.status(400).json({ message: 'Technology is required for recommendations' });
        }

        // Fetch all active SMEs
        const smes = await SME.find({ isActive: true })
            .populate('createdBy', 'name email')
            .lean();

        const reqTech = technology.toLowerCase().trim();
        const reqLoc  = location ? location.toLowerCase().trim() : '';
        const reqStart = startDate ? new Date(startDate) : null;
        const reqEnd   = endDate   ? new Date(endDate)   : null;

        // Normalise training dates to midnight
        if (reqStart) reqStart.setHours(0, 0, 0, 0);
        if (reqEnd)   reqEnd.setHours(23, 59, 59, 999);

        const scoredSmes = smes.map(sme => {
            // -----------------------------------------------------------
            // 1. Technology match — HARD GATE (50 pts)
            // -----------------------------------------------------------
            const smeTech = (sme.technology || '').toLowerCase().trim();
            const techMatches = smeTech && reqTech &&
                (smeTech.includes(reqTech) || reqTech.includes(smeTech));
            if (!techMatches) return null; // exclude entirely

            let score = 50;
            const matchReasons = ['Technology'];

            // -----------------------------------------------------------
            // 2. Availability — training dates must fall WITHIN SME's
            //    available window (30 pts).
            //    Logic:
            //      availFrom  <= trainingStart  AND
            //      availUntil >= trainingEnd
            //    If the SME has no dates set → treat as always available.
            // -----------------------------------------------------------
            let isAvailable = false;
            const avail = sme.availability || {};
            const availFrom  = avail.availableFrom  ? new Date(avail.availableFrom)  : null;
            const availUntil = avail.availableUntil ? new Date(avail.availableUntil) : null;
            
            // Normalize SME availability dates to start and end of day
            if (availFrom) availFrom.setHours(0, 0, 0, 0);
            if (availUntil) availUntil.setHours(23, 59, 59, 999);
            
            const smeHasDates = !!(availFrom || availUntil);

            if (!smeHasDates) {
                // No availability dates → open / always available
                isAvailable = true;
            } else if (reqStart && reqEnd) {
                // Training has both dates: SME window must fully contain it
                const fromOk  = !availFrom  || availFrom  <= reqStart;
                const untilOk = !availUntil || availUntil >= reqEnd;
                isAvailable = fromOk && untilOk;
            } else if (reqStart) {
                // Only start date given: check start is within window
                const fromOk  = !availFrom  || availFrom  <= reqStart;
                const untilOk = !availUntil || availUntil >= reqStart;
                isAvailable = fromOk && untilOk;
            } else {
                // No training dates given → accept the SME
                isAvailable = true;
            }

            // HARD GATE: if SME has dates set and doesn't cover the training period → exclude
            if (smeHasDates && !isAvailable) return null;

            if (isAvailable) {
                score += 30;
                matchReasons.push('Availability');
            }

            // -----------------------------------------------------------
            // 3. Location match — last priority (20 pts)
            // -----------------------------------------------------------
            if (reqLoc) {
                const smeLoc = (sme.location || sme.companyLocation || '').toLowerCase();
                if (smeLoc.includes(reqLoc) || reqLoc.includes(smeLoc)) {
                    score += 20;
                    matchReasons.push('Location');
                }
            }

            return { ...sme, matchScore: score, matchReasons };
        }).filter(s => s !== null);

        const recommendations = scoredSmes
            .filter(s => s.matchScore > 0)
            .sort((a, b) => b.matchScore - a.matchScore)
            .slice(0, 10);

        res.json(recommendations);
    } catch (err) {
        console.error('Recommend SME Error:', err);
        res.status(500).json({ message: err.message });
    }
});


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
router.put('/:id', protect, authorize('Sales Executive', 'Sales Manager', 'Director', 'Delivery Head', 'Delivery Executive'), uploadMiddleware, async (req, res) => {
    try {
        const sme = await SME.findById(req.params.id);

        if (!sme) {
            return res.status(404).json({ message: 'SME not found' });
        }

        const updateData = { ...req.body };

        // Parse bankDetails if string or array
        if (typeof updateData.bankDetails === 'string' || Array.isArray(updateData.bankDetails)) {
            try {
                let bdString = Array.isArray(updateData.bankDetails) ? updateData.bankDetails[0] : updateData.bankDetails;
                updateData.bankDetails = JSON.parse(bdString);
            } catch (e) {
                return res.status(400).json({ message: 'Invalid bank details format' });
            }
        }

        if (typeof updateData.availability === 'string' || Array.isArray(updateData.availability)) {
            try {
                let availString = Array.isArray(updateData.availability) ? updateData.availability[0] : updateData.availability;
                updateData.availability = JSON.parse(availString);
                if (!updateData.availability.availableFrom) updateData.availability.availableFrom = null;
                if (!updateData.availability.availableUntil) updateData.availability.availableUntil = null;
                if (!updateData.availability.statusOverride) updateData.availability.statusOverride = null;
            } catch (e) {
                // Ignore parsing errors
            }
        }

        if (updateData.yearsExperience !== undefined) {
            updateData.yearsExperience = Number(updateData.yearsExperience);
        }

        // Handle file uploads - only update if new file provided
        if (req.files) {
            if (req.files.sowDocument) updateData.sowDocument = toUploadRelativePath(req.files.sowDocument[0].path);
            if (req.files.ndaDocument) updateData.ndaDocument = toUploadRelativePath(req.files.ndaDocument[0].path);
            if (req.files.sme_profile) updateData.sme_profile = toUploadRelativePath(req.files.sme_profile[0].path);
            if (req.files.idProof) updateData.idProof = toUploadRelativePath(req.files.idProof[0].path);
            if (req.files.panDocument) updateData.panDocument = toUploadRelativePath(req.files.panDocument[0].path);
            if (req.files.gstDocument) updateData.gstDocument = toUploadRelativePath(req.files.gstDocument[0].path);
        }

        // Backward compatibility for older records that stored profile as `contentUpload`.
        if (!updateData.sme_profile) {
            if (typeof updateData.contentUpload === 'string' && updateData.contentUpload.trim()) {
                updateData.sme_profile = toUploadRelativePath(updateData.contentUpload.trim());
            } else if (typeof sme.get === 'function' && sme.get('contentUpload')) {
                updateData.sme_profile = toUploadRelativePath(sme.get('contentUpload'));
            }
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
        if (err.name === 'ValidationError' || err.name === 'CastError') {
            return res.status(400).json({ message: err.message });
        }
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
