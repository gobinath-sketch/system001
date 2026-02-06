const express = require('express');
const router = express.Router();
const Document = require('../models/Document');
const Notification = require('../models/Notification');
const User = require('../models/User');
const Opportunity = require('../models/Opportunity');
const { protect, authorize } = require('../middleware/authMiddleware');
const { calculateOpportunityProgress } = require('../utils/progressCalculator');
const multer = require('multer');
const path = require('path');

// File Upload Config
const storage = multer.diskStorage({
    destination(req, file, cb) {
        cb(null, 'uploads/documents/');
    },
    filename(req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, `${req.body.documentType}-${uniqueSuffix}${path.extname(file.originalname)}`);
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
    fileFilter: function (req, file, cb) {
        const allowedTypes = /pdf|doc|docx|jpg|jpeg|png/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);

        if (extname && mimetype) {
            return cb(null, true);
        } else {
            cb(new Error('Only PDF, DOC, DOCX, JPG, and PNG files are allowed'));
        }
    }
});

// @route   POST /api/documents/upload
// @desc    Upload document for opportunity
// @access  Private
router.post('/upload', protect, upload.single('document'), async (req, res) => {
    try {
        const { opportunityId, documentType } = req.body;

        if (!req.file) {
            return res.status(400).json({ message: 'No file uploaded' });
        }

        if (!opportunityId || !documentType) {
            return res.status(400).json({ message: 'Opportunity ID and document type are required' });
        }

        // Check role-based upload permissions
        const canUpload = checkUploadPermission(documentType, req.user.role);
        if (!canUpload) {
            return res.status(403).json({ message: 'You do not have permission to upload this document type' });
        }

        // Mark previous versions as not latest
        await Document.updateMany(
            { opportunityId, documentType, isLatest: true },
            { isLatest: false }
        );

        // Get next version number
        const latestDoc = await Document.findOne({ opportunityId, documentType })
            .sort({ version: -1 });
        const nextVersion = latestDoc ? latestDoc.version + 1 : 1;

        // Create new document
        const document = new Document({
            opportunityId,
            documentType,
            fileName: req.file.originalname,
            filePath: req.file.path,
            uploadedBy: req.user._id,
            version: nextVersion,
            isLatest: true
        });

        await document.save();

        // Update Opportunity with document link for Progress Calculation
        const updateFields = {};
        if (documentType === 'Proposal') {
            updateFields.proposalDocument = document.filePath;
            updateFields.proposalUploadedAt = Date.now();
        } else if (documentType === 'PO') {
            updateFields.poDocument = document.filePath;
        } else if (documentType === 'Invoice') {
            updateFields.invoiceDocument = document.filePath;
        }

        if (Object.keys(updateFields).length > 0) {
            const updatedOpp = await Opportunity.findByIdAndUpdate(opportunityId, { $set: updateFields }, { new: true });

            // Recalculate Progress
            if (updatedOpp) {
                const { progressPercentage, statusStage, statusLabel } = calculateOpportunityProgress(updatedOpp);
                updatedOpp.progressPercentage = progressPercentage;
                updatedOpp.statusStage = statusStage;
                updatedOpp.statusLabel = statusLabel;
                await updatedOpp.save();
            }
        }

        res.status(201).json({
            message: 'Document uploaded successfully',
            document
        });

        // NOTIFICATION LOGIC
        try {
            const opportunity = await Opportunity.findById(opportunityId);
            if (opportunity) {
                let recipientRoles = [];
                let specificUserIds = [];

                // Determine recipients based on document type
                if (documentType === 'Proposal' || documentType === 'PO') {
                    // PO uploaded by Sales -> Notify Delivery AND Finance
                    if (req.user.role === 'Sales Executive' || req.user.role === 'Sales Manager') {
                        recipientRoles.push('Delivery Team');
                        recipientRoles.push('Finance'); // Assuming 'Finance' role exists, otherwise 'Director'
                        recipientRoles.push('Director'); // Ensure Director gets it if Finance role isn't distinct or as backup
                    }
                } else if (documentType === 'Invoice') {
                    // Invoice uploaded by Finance/Delivery -> Notify Sales
                    if (req.user.role === 'Finance' || req.user.role === 'Delivery Team' || req.user.role === 'Director') {
                        specificUserIds.push(opportunity.createdBy);
                    }
                }

                // Fetch users by role
                let recipients = [];
                if (recipientRoles.length > 0) {
                    const roleUsers = await User.find({ role: { $in: recipientRoles } });
                    recipients = [...roleUsers];
                }

                // Add specific users
                if (specificUserIds.length > 0) {
                    const specificUsers = await User.find({ _id: { $in: specificUserIds } });
                    recipients = [...recipients, ...specificUsers];
                }

                // Filter out the uploader and duplicates
                const uniqueRecipients = recipients
                    .filter(u => u._id.toString() !== req.user._id.toString())
                    .filter((v, i, a) => a.findIndex(t => t._id.toString() === v._id.toString()) === i);

                // Create notifications
                const notifications = uniqueRecipients.map(user => ({
                    recipientId: user._id,
                    type: 'document_upload',
                    message: `New ${documentType} uploaded for ${opportunity.opportunityNumber} by ${req.user.name}`,
                    opportunityId: opportunity._id,
                    opportunityNumber: opportunity.opportunityNumber,
                    documentType: documentType,
                    triggeredBy: req.user._id,
                    triggeredByName: req.user.name
                }));

                if (notifications.length > 0) {
                    await Notification.insertMany(notifications);
                }
            }
        } catch (notifErr) {
            console.error('Notification error:', notifErr);
        }
    } catch (err) {
        console.error('Document upload error:', err);
        res.status(500).json({ message: err.message });
    }
});

// @route   GET /api/documents/opportunity/:oppId
// @desc    Get all documents for an opportunity
// @access  Private (All authenticated users)
router.get('/opportunity/:oppId', protect, async (req, res) => {
    try {
        const documents = await Document.find({
            opportunityId: req.params.oppId
        })
            .populate('uploadedBy', 'name email')
            .sort({ uploadedAt: -1 });

        // Removed role-based filtering - All docs are visible to all users
        const visibleDocs = documents;

        // Group by document type
        const grouped = {
            Proposal: visibleDocs.filter(d => d.documentType === 'Proposal'),
            PO: visibleDocs.filter(d => d.documentType === 'PO'),
            Invoice: visibleDocs.filter(d => d.documentType === 'Invoice')
        };

        res.json(grouped);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// @route   GET /api/documents/:id
// @desc    Get specific document
// @access  Private
router.get('/:id', protect, async (req, res) => {
    try {
        const document = await Document.findById(req.params.id)
            .populate('uploadedBy', 'name email');

        if (!document) {
            return res.status(404).json({ message: 'Document not found' });
        }

        // Removed visibility check - All docs are visible
        res.json(document);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// @route   DELETE /api/documents/:id
// @desc    Delete document (uploader only)
// @access  Private
router.delete('/:id', protect, async (req, res) => {
    try {
        const document = await Document.findById(req.params.id);

        if (!document) {
            return res.status(404).json({ message: 'Document not found' });
        }

        // Check if user can delete
        if (!document.canDelete(req.user._id)) {
            return res.status(403).json({ message: 'Only the uploader can delete this document' });
        }

        await document.deleteOne();

        res.json({ message: 'Document deleted successfully' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Helper function to check upload permissions
function checkUploadPermission(documentType, userRole) {
    const permissions = {
        'Proposal': ['Sales Executive', 'Sales Manager'],
        'PO': ['Sales Executive', 'Sales Manager'],
        'Invoice': ['Delivery Team', 'Director']
    };

    return permissions[documentType]?.includes(userRole) || false;
}

module.exports = router;
