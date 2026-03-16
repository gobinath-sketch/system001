const mongoose = require('mongoose');
const Client = require('../../models/Client');
const Opportunity = require('../../models/Opportunity');
const User = require('../../models/User');
const { normalizeSector } = require('../../utils/sector');

function escapeRegex(s = '') {
    return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function isMeaningful(value) {
    if (value === null || value === undefined) return false;
    if (typeof value === 'string') return value.trim().length > 0;
    if (typeof value === 'number') return Number.isFinite(value) && value !== 0;
    if (typeof value === 'boolean') return true;
    if (Array.isArray(value)) return value.length > 0;
    if (typeof value === 'object') {
        return Object.values(value).some(isMeaningful);
    }
    return false;
}

function mergeMeaningful(target = {}, source = {}) {
    const out = { ...(target || {}) };
    Object.entries(source || {}).forEach(([key, value]) => {
        if (value && typeof value === 'object' && !Array.isArray(value)) {
            const mergedChild = mergeMeaningful(out[key] || {}, value);
            if (isMeaningful(mergedChild)) {
                out[key] = mergedChild;
            }
            return;
        }
        if (isMeaningful(value)) {
            out[key] = value;
        }
    });
    return out;
}

function isValidObjectId(value) {
    return mongoose.Types.ObjectId.isValid(String(value || '').trim());
}

function normalizeMap(mapValue) {
    if (!mapValue) return {};
    if (typeof mapValue.toObject === 'function') return mapValue.toObject();
    if (mapValue instanceof Map) return Object.fromEntries(mapValue.entries());
    return mapValue;
}

function normalizeModeOfTraining(value) {
    const raw = String(value || '').trim();
    if (!raw) return '';

    const normalized = raw.toLowerCase().replace(/[^a-z]/g, '');
    const modeAliases = new Map([
        ['vilt', 'Virtual'],
        ['virtual', 'Virtual'],
        ['virtualinstructorledtraining', 'Virtual'],
        ['online', 'Virtual'],
        ['remote', 'Virtual'],
        ['webbased', 'Virtual'],
        ['ilt', 'Classroom'],
        ['classroom', 'Classroom'],
        ['inperson', 'Classroom'],
        ['onsite', 'Classroom'],
        ['offline', 'Classroom'],
        ['f2f', 'Classroom'],
        ['hybrid', 'Hybrid'],
        ['blended', 'Hybrid']
    ]);

    return modeAliases.get(normalized) || raw;
}

function sanitizeCommonDetails(input) {
    const out = input || {};
    if (!isMeaningful(out.trainerDetails)) {
        delete out.trainerDetails;
    }
    if (!isValidObjectId(out.sales)) {
        delete out.sales;
    }

    const allowedTrainingSector = new Set([
        'Enterprise',
        'Academics',
        'Academics - College',
        'Academics - Universities',
        'University',
        'College',
        'School'
    ]);
    const allowedStatus = new Set([
        'Active',
        'Pending',
        'In Progress',
        'Completed',
        'Closed',
        'Lost',
        'Scheduled',
        'Cancelled',
        'Discontinued'
    ]);
    const allowedSupporter = new Set(['GKT', 'GKCS', 'MCT']);
    const allowedSmeRequired = new Set(['Yes', 'No']);
    const allowedTovUnit = new Set(['Fixed', 'Per Day', 'Per Participant']);

    if (out.trainingSector && !allowedTrainingSector.has(out.trainingSector)) {
        delete out.trainingSector;
    }
    if (out.status && !allowedStatus.has(out.status)) {
        delete out.status;
    }
    if (out.trainingSupporter && !allowedSupporter.has(out.trainingSupporter)) {
        delete out.trainingSupporter;
    }
    if (out.smeRequired && !allowedSmeRequired.has(out.smeRequired)) {
        delete out.smeRequired;
    }
    if (out.tovUnit && !allowedTovUnit.has(out.tovUnit)) {
        delete out.tovUnit;
    }

    return out;
}

function sanitizeTypeSpecificDetails(input) {
    if (!isMeaningful(input)) return undefined;

    const out = { ...(input || {}) };
    if (out.modeOfTraining) {
        out.modeOfTraining = normalizeModeOfTraining(out.modeOfTraining);
    }

    const allowedModes = new Set(['Virtual', 'Classroom', 'Hybrid']);
    if (out.modeOfTraining && !allowedModes.has(out.modeOfTraining)) {
        delete out.modeOfTraining;
    }

    return out;
}

function sanitizeFinanceDetails(input) {
    if (!isMeaningful(input)) return undefined;
    const out = input || {};
    if (!out.clientReceivables) out.clientReceivables = {};
    if (!out.vendorPayables) out.vendorPayables = {};
    if (!out.vendorPayables.detailed) out.vendorPayables.detailed = {};
    if (!out.vendorPayables.perDiem) out.vendorPayables.perDiem = { amount: 0, document: '' };
    if (!out.vendorPayables.other) out.vendorPayables.other = { amount: 0, document: '' };
    return out;
}

async function findAutomationActor() {
    const preferredEmail = String(process.env.EMAIL_AUTOMATION_USER_EMAIL || '').trim().toLowerCase();
    if (preferredEmail) {
        const byEmail = await User.findOne({ email: preferredEmail });
        if (byEmail) return byEmail;
    }

    const fallback = await User.findOne({
        role: { $in: ['Sales Manager', 'Sales Executive', 'Business Head'] }
    }).sort({ createdAt: 1 });

    if (!fallback) {
        throw new Error('No user found for automation actor. Set EMAIL_AUTOMATION_USER_EMAIL.');
    }
    return fallback;
}

async function findExecutionActor(actorId) {
    if (actorId && isValidObjectId(actorId)) {
        const byId = await User.findById(actorId);
        if (byId) return byId;
    }
    return findAutomationActor();
}

async function findOrCreateClient(extraction, actor, emailMeta) {
    const companyName = String(extraction?.client?.companyName || '').trim();
    if (!companyName) return null;

    const existing = await Client.findOne({
        companyName: { $regex: new RegExp(`^${escapeRegex(companyName)}$`, 'i') },
        isDeleted: { $ne: true }
    });
    if (existing) return existing;

    const contactFromMail = {
        name: extraction?.client?.contactPersons?.[0]?.name || emailMeta.fromName || '',
        designation: extraction?.client?.contactPersons?.[0]?.designation || '',
        department: extraction?.client?.contactPersons?.[0]?.department || '',
        contactNumber: extraction?.client?.contactPersons?.[0]?.contactNumber || '',
        email: extraction?.client?.contactPersons?.[0]?.email || emailMeta.fromEmail || '',
        location: extraction?.client?.contactPersons?.[0]?.location || 'Unknown',
        linkedIn: extraction?.client?.contactPersons?.[0]?.linkedIn || '',
        reportingManager: extraction?.client?.contactPersons?.[0]?.reportingManager || {},
        isPrimary: true
    };

    const client = await Client.create({
        companyName,
        sector: normalizeSector(extraction?.client?.sector || 'Enterprise'),
        contactPersons: [contactFromMail],
        createdBy: actor._id
    });

    return client;
}

async function findExistingOpportunity(extraction, clientId) {
    const intent = String(extraction?.intent || '').trim();
    if (intent !== 'opportunity_update') {
        return null;
    }

    const explicit = String(extraction?.opportunity?.opportunityNumber || '').trim();
    if (explicit) {
        const byNumber = await Opportunity.findOne({
            opportunityNumber: explicit,
            isDeleted: { $ne: true }
        });
        if (byNumber) return byNumber;
    }

    if (!clientId) return null;

    const byClientLatest = await Opportunity.findOne({
        client: clientId,
        isDeleted: { $ne: true }
    }).sort({ createdAt: -1 });

    return byClientLatest;
}

async function generateOpportunityNumber(actor) {
    const today = new Date();
    const yy = today.getFullYear().toString().slice(-2);
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const codeRaw = actor?.creatorCode || actor?.name || 'AI';
    const code = String(codeRaw).replace(/[^A-Za-z]/g, '').slice(0, 2).toUpperCase().padEnd(2, 'X');
    const prefix = `GKT${yy}${code}${mm}`;
    const last = await Opportunity.findOne({ opportunityNumber: new RegExp(`^${prefix}`) }).sort({ opportunityNumber: -1 });
    const serial = last ? String(Number(last.opportunityNumber.slice(-3)) + 1).padStart(3, '0') : '001';
    return `${prefix}${serial}`;
}

function mergeOpportunityFields(opportunity, extraction, actor, actionLabel) {
    const src = extraction?.opportunity || {};

    if (src.type) opportunity.type = src.type;
    if (Number.isFinite(Number(src.participants)) && Number(src.participants) > 0) {
        opportunity.participants = Number(src.participants);
    }
    if (Number.isFinite(Number(src.days)) && Number(src.days) >= 0) {
        opportunity.days = Number(src.days);
    }

    if (src.requirementSummary) {
        opportunity.requirementSummary = String(src.requirementSummary).slice(0, 3000);
    }

    if (src.requirementDocument && String(src.requirementDocument).trim()) {
        opportunity.requirementDocument = String(src.requirementDocument).trim();
    }
    if (src.proposalDocument && String(src.proposalDocument).trim()) {
        opportunity.proposalDocument = String(src.proposalDocument).trim();
    }
    if (src.proposalUploadedAt && String(src.proposalUploadedAt).trim()) {
        opportunity.proposalUploadedAt = new Date(src.proposalUploadedAt);
    }
    if (src.poDocument && String(src.poDocument).trim()) {
        opportunity.poDocument = String(src.poDocument).trim();
    }
    if (src.invoiceDocument && String(src.invoiceDocument).trim()) {
        opportunity.invoiceDocument = String(src.invoiceDocument).trim();
    }

    if (src.selectedSME && isValidObjectId(src.selectedSME)) {
        opportunity.selectedSME = src.selectedSME;
    }
    if (src.assignedTo && isValidObjectId(src.assignedTo)) {
        opportunity.assignedTo = src.assignedTo;
    }

    opportunity.typeSpecificDetails = sanitizeTypeSpecificDetails(
        mergeMeaningful(opportunity.typeSpecificDetails || {}, src.typeSpecificDetails || {})
    );
    opportunity.commonDetails = sanitizeCommonDetails(mergeMeaningful(opportunity.commonDetails || {}, src.commonDetails || {}));
    opportunity.expenses = mergeMeaningful(opportunity.expenses || {}, src.expenses || {});
    const safeExpenseDocs = normalizeMap(opportunity.expenseDocuments);
    opportunity.expenseDocuments = mergeMeaningful(safeExpenseDocs, src.expenseDocuments || {});
    opportunity.deliveryDocuments = mergeMeaningful(opportunity.deliveryDocuments || {}, src.deliveryDocuments || {});
    const mergedFinance = sanitizeFinanceDetails(JSON.parse(JSON.stringify(src.financeDetails || {})));
    if (mergedFinance) {
        opportunity.financeDetails = mergedFinance;
    }

    if (Number.isFinite(Number(src.poValue)) && Number(src.poValue) > 0) {
        opportunity.poValue = Number(src.poValue);
    }
    if (Number.isFinite(Number(src.invoiceValue)) && Number(src.invoiceValue) > 0) {
        opportunity.invoiceValue = Number(src.invoiceValue);
    }

    opportunity.lastModifiedBy = actor._id;
    opportunity.activityLog = opportunity.activityLog || [];
    opportunity.activityLog.push({
        action: actionLabel,
        by: actor._id,
        role: 'AI Automation',
        details: 'Updated from Outlook email automation'
    });
}

async function upsertFromExtraction({ extraction, emailMeta, actorId = null }) {
    const actor = await findExecutionActor(actorId);
    const client = await findOrCreateClient(extraction, actor, emailMeta);

    let opportunity = await findExistingOpportunity(extraction, client?._id);
    if (!opportunity) {
        const opportunityNumber = await generateOpportunityNumber(actor);
        const src = extraction?.opportunity || {};
        const mergedTypeSpecific = sanitizeTypeSpecificDetails(mergeMeaningful({}, src.typeSpecificDetails || {}));
        const mergedCommon = sanitizeCommonDetails(mergeMeaningful({
            trainingSector: client?.sector || 'Enterprise',
            status: 'Active',
            sales: actor._id,
            year: new Date().getFullYear(),
            monthOfTraining: new Date().toLocaleString('default', { month: 'short' })
        }, src.commonDetails || {}));
        const mergedFinance = sanitizeFinanceDetails(JSON.parse(JSON.stringify(src.financeDetails || {})));
        const newOppPayload = {
            opportunityNumber,
            type: src.type || 'Training',
            client: client?._id,
            participants: Number(src.participants || 0),
            days: Number(src.days || 0),
            requirementSummary: src.requirementSummary || '',
            requirementDocument: src.requirementDocument || '',
            proposalDocument: src.proposalDocument || '',
            proposalUploadedAt: src.proposalUploadedAt ? new Date(src.proposalUploadedAt) : undefined,
            poDocument: src.poDocument || '',
            poValue: Number(src.poValue || 0),
            invoiceDocument: src.invoiceDocument || '',
            invoiceValue: Number(src.invoiceValue || 0),
            selectedSME: isValidObjectId(src.selectedSME) ? src.selectedSME : null,
            assignedTo: isValidObjectId(src.assignedTo) ? src.assignedTo : null,
            typeSpecificDetails: mergedTypeSpecific,
            commonDetails: mergedCommon,
            expenses: mergeMeaningful({}, src.expenses || {}),
            expenseDocuments: mergeMeaningful({}, src.expenseDocuments || {}),
            deliveryDocuments: mergeMeaningful({}, src.deliveryDocuments || {}),
            createdBy: actor._id,
            lastModifiedBy: actor._id,
            activityLog: [{
                action: 'Opportunity Created (Email Automation)',
                by: actor._id,
                role: 'AI Automation',
                details: `Auto-created from email: ${emailMeta.subject || 'No Subject'}`
            }]
        };
        if (mergedFinance) {
            newOppPayload.financeDetails = mergedFinance;
        }
        opportunity = new Opportunity(newOppPayload);
    }

    mergeOpportunityFields(opportunity, extraction, actor, 'Opportunity Updated (Email Automation)');
    await opportunity.save();

    return {
        actorId: actor._id,
        clientId: client?._id || null,
        opportunityId: opportunity._id
    };
}

module.exports = {
    upsertFromExtraction
};
