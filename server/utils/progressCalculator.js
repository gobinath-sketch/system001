/**
 * Progress Calculator Utility for Opportunity Status Bar
 * Updated Logic (Feb 2026)
 * - Stage 1: Created (0-30%)
 * - Stage 2: In Progress (30-50%)
 * - Stage 3: Scheduled (50-80%)
 * - Stage 4: Completed (80-100%)
 * 
 * Cancellation/Discontinuation handled explicitly.
 */

/**
 * Calculate opportunity progress percentage
 * @param {Object} opportunity - Mongoose opportunity document
 * @returns {Object} { progressPercentage, statusStage, statusLabel }
 */
function calculateOpportunityProgress(opportunity) {
    let progress = 0;
    let stage = 'Created';
    let label = 'Created';

    // 1. Mandatory Manual Status Checks
    const status = opportunity.commonDetails?.status;

    if (status === 'Cancelled') {
        return {
            progressPercentage: 0,
            statusStage: 'Cancelled',
            statusLabel: 'Cancelled'
        };
    } else if (status === 'Discontinued') {
        return {
            progressPercentage: 0,
            statusStage: 'Discontinued',
            statusLabel: 'Discontinued'
        };
    }

    // --- 0-30%: Opportunity Created (Creation -> Requirements -> Scope) ---
    // Base: 10%
    progress = 10;

    // 20% - Requirement Summary
    if (opportunity.requirementSummary && opportunity.requirementSummary.trim().length > 0) {
        progress = 20;
    }

    // 30% - Scope & Sizing (Type Specific)
    const typeDetails = opportunity.typeSpecificDetails || {};
    const type = opportunity.type || 'Training';
    let hasScope = false;
    let hasSizing = false;

    switch (type) {
        case 'Training':
            hasScope = (
                typeDetails.technology &&
                typeDetails.modeOfTraining &&
                (typeDetails.trainingName || opportunity.commonDetails?.courseName)
            );
            hasSizing = (opportunity.participants > 0);
            break;
        case 'Product Support':
            hasScope = !!typeDetails.projectScope;
            hasSizing = (typeDetails.teamSize > 0);
            break;
        case 'Resource Support':
            hasScope = !!typeDetails.resourceType;
            hasSizing = (typeDetails.resourceCount > 0);
            break;
        case 'Vouchers':
            hasScope = (
                typeDetails.technology &&
                typeDetails.examDetails &&
                typeDetails.examLocation
            );
            hasSizing = (typeDetails.noOfVouchers > 0);
            break;
        case 'Content Support':
            hasScope = (
                typeDetails.contentType &&
                typeDetails.deliveryFormat
            );
            hasSizing = hasScope;
            break;
        case 'Lab Support':
            hasScope = (
                typeDetails.technology &&
                typeDetails.labRequirement &&
                typeDetails.region
            );
            hasSizing = ((typeDetails.numberOfIDs > 0) && (parseInt(typeDetails.duration) > 0));
            break;
        default:
            hasScope = (typeDetails.technology);
            hasSizing = (opportunity.participants > 0);
    }

    if (progress >= 20 && hasScope && hasSizing) {
        progress = 30;
        stage = 'Created';
        label = 'Created';
    }

    // --- 30-50%: Expenses Getting Filled ---
    const exp = opportunity.expenses || {};
    const hasExpenses = (
        (exp.trainerCost > 0) ||
        (exp.travel > 0) ||
        (exp.material > 0) ||
        (exp.labs > 0) ||
        (exp.venue > 0)
    );

    if (progress >= 30 && hasExpenses) {
        progress = 50;
        stage = 'In Progress';
        label = 'In Progress';
    }

    // --- 50-80%: Proposal Document Upload (Sales) ---
    // Note: User requested "Proposal doc upload by sales".
    // We check for proposalDocument.
    if (progress >= 50 && opportunity.proposalDocument) {
        progress = 80;
        stage = 'Scheduled'; // Transition to Scheduled? User KPI grouping suggests 80% is significant.
        label = 'Scheduled';
    }

    // --- 80-100%: PO/Invoice/Delivery Docs ---
    // User: "PO amount, PO doc, Invoice amount, Invoice doc + Delivery documents should be uploaded."

    // Check PO (Doc + Value)
    const hasPO = opportunity.poDocument && (opportunity.poValue > 0);

    // Check Invoice (Doc + Value)
    const hasInvoice = opportunity.invoiceDocument && (opportunity.invoiceValue > 0 || (opportunity.financeDetails?.clientReceivables?.invoiceAmount > 0));

    if (progress >= 80 && hasPO && hasInvoice) {
        progress = 90;
        stage = 'Completed';
        label = 'Completed'; // Almost there
    }

    // Check Delivery Docs (All 4)
    const docs = opportunity.deliveryDocuments || {};
    const allDeliveryDocs = docs.attendance && docs.feedback && docs.assessment && docs.performance;

    if (progress >= 90 && allDeliveryDocs) {
        progress = 100;
        stage = 'Completed';
        label = 'Completed';
    }

    return {
        progressPercentage: progress,
        statusStage: stage,
        statusLabel: label
    };
}

/**
 * Get required fields for next stage
 * @param {Object} opportunity - Mongoose opportunity document
 * @returns {Array} Array of required field names
 */
function getRequiredFieldsForNextStage(opportunity) {
    const { progressPercentage } = calculateOpportunityProgress(opportunity);

    if (progressPercentage < 20) return ['Constraint: Requirement Summary'];
    if (progressPercentage < 30) return ['Constraint: Technology, Mode, Training Name'];
    if (progressPercentage < 40) return ['Constraint: Participants, Duration/Days'];
    if (progressPercentage < 50) return ['Constraint: Costing (Trainer/Travel/Material/Lab/Venue)'];
    if (progressPercentage < 60) return ['Constraint: Identify Trainer/SME'];
    if (progressPercentage < 70) return ['Constraint: Upload Proposal'];
    if (progressPercentage < 80) return ['Constraint: Upload PO'];
    if (progressPercentage < 90) return ['Constraint: Upload Invoice'];
    if (progressPercentage < 100) return ['Constraint: Upload All Delivery Docs'];

    return ['All Stages Completed'];
}

module.exports = {
    calculateOpportunityProgress,
    getRequiredFieldsForNextStage
};
