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

    // 2. Cumulative Milestone Logic
    // We check strictly from highest to lowest to determine valid progress, 
    // OR we can accumulate points. The user requirements implies milestones.
    // "10% - Basic Opportunity Created" -> This is always true if record exists.
    progress = 10;
    stage = 'Created';
    label = 'Created';

    // 20% - Requirement Summary Captured
    if (opportunity.requirementSummary && opportunity.requirementSummary.trim().length > 0) {
        progress = 20;
    }

    // 30% & 40% - Scope & Sizing (Type Specific)
    const typeDetails = opportunity.typeSpecificDetails || {};
    const type = opportunity.type || 'Training'; // Default to Training if missing
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
            // Scope: Project Scope
            // Sizing: Team Size
            hasScope = !!typeDetails.projectScope;
            hasSizing = (typeDetails.teamSize > 0);
            break;

        case 'Resource Support':
            // Scope: Resource Type
            // Sizing: Resource Count
            hasScope = !!typeDetails.resourceType;
            hasSizing = (typeDetails.resourceCount > 0);
            break;

        case 'Vouchers':
            // Scope: Technology, Exam Details, Exam Location
            // Sizing: No of Vouchers
            hasScope = (
                typeDetails.technology &&
                typeDetails.examDetails &&
                typeDetails.examLocation
            );
            hasSizing = (typeDetails.noOfVouchers > 0);
            break;

        case 'Content Support':
            // Scope: Content Type, Delivery Format
            // Sizing: Not strictly defined by user, assume generic valid if scope is there? 
            // User didn't give sizing for Content. Let's assume Sizing passes if Scope passes for now, or just default to true.
            hasScope = (
                typeDetails.contentType &&
                typeDetails.deliveryFormat
            );
            hasSizing = hasScope;
            break;

        case 'Lab Support':
            // Scope: Technology, Requirement, Region
            // Sizing: No of IDs, Duration
            hasScope = (
                typeDetails.technology &&
                typeDetails.labRequirement &&
                typeDetails.region
            );
            // Duration is string (e.g., "1 month"), parseInt handles it.
            hasSizing = ((typeDetails.numberOfIDs > 0) && (parseInt(typeDetails.duration) > 0));
            break;

        default:
            // Fallback to basic Training-like check
            hasScope = (typeDetails.technology);
            hasSizing = (opportunity.participants > 0);
    }

    if (progress >= 20 && hasScope) {
        progress = 30;
        stage = 'Created';
        label = 'Created';
    }

    if (progress >= 30 && hasSizing) {
        progress = 40;
        stage = 'In Progress';
        label = 'In Progress';
    }

    // 50% - Costing/Expenses Started
    const exp = opportunity.expenses || {};
    const hasExpenses = (
        (exp.trainerCost > 0) ||
        (exp.travel > 0) ||
        (exp.material > 0) ||
        (exp.labs > 0) ||
        (exp.venue > 0)
    );

    if (progress >= 30 && hasExpenses) { // Allow jump from 30 to 50 if sizing missed? Better enforce strictly. 
        // Strict linear flow: Must be 40 to go to 50? 
        // User triggers are specific. Let's assume cumulative.
        if (progress < 40 && hasSizing) progress = 40; // Auto-catchup if safe? 
        // Let's stick to strict: If you have expenses, you are at least 50 provided previous milestones aren't blocking?
        // Actually, let's just check the condition. If expenses are there, it's 50%.

        progress = 50;
        stage = 'In Progress';
        label = 'In Progress';
    }

    // 60% - Trainer/SME Identified
    const hasSME = opportunity.selectedSME || opportunity.commonDetails?.trainerDetails?.name;

    if (progress >= 50 && hasSME) {
        progress = 60;
        stage = 'Scheduled'; // Stage 3 starts > 50%
        label = 'Scheduled';
    }

    // 70% - Proposal Uploaded
    if (progress >= 50 && opportunity.proposalDocument) {
        progress = (progress < 60) ? 70 : 70; // Proposal > SME in hierarchy?
        // User list order implies 60 -> 70 -> 80.
        // If Proposal is uploaded but SME not selected, strict logic might say stay at 50?
        // BUT usually proposal implies SME/Costing is done.
        // Let's allow Proposal to override.
        if (progress < 70) progress = 70;
        stage = 'Scheduled';
        label = 'Scheduled';
    }

    // 80% - PO Uploaded
    if (progress >= 50 && opportunity.poDocument) {
        if (progress < 80) progress = 80;
        stage = 'Scheduled'; // User says 80 is start of Stage 4? "Stage 4 — 80% → 100%"
        // Re-reading: "Stage 3 — 50% → 80% → STATUS: Scheduled"
        // "Stage 4 — 80% → 100% → STATUS: Completed"
        // But 80% itself... "80% — PO Document Uploaded -> Status Label = Scheduled"
        // Wait, under Stage 3 it lists "80% — PO Document Uploaded ... Status Label = Scheduled".
        // BUT under Stage 4 header it says "80% → 100%".
        // And under Stage 4 triggers it lists "90%" and "100%".
        // So 80% exact is likely still "Scheduled" or transition. 
        // User explicitly put "80% — PO Document Uploaded ... 👉 Status Label = Scheduled" under Stage 3.
        stage = 'Scheduled';
        label = 'Scheduled';
    }

    // 90% - Invoice Uploaded
    // Stage 4 triggers
    if (progress >= 80 && opportunity.invoiceDocument) {
        progress = 90;
        stage = 'Completed';
        label = 'Completed';
    }

    // 100% - All Delivery Docs
    const docs = opportunity.deliveryDocuments || {};
    const allDocs = docs.attendance && docs.feedback && docs.assessment && docs.performance;

    if (progress >= 90 && allDocs) {
        progress = 100;
        stage = 'Completed';
        label = 'Completed';
    }

    // Explicit Status Override: User might manually set to "Completed", "In Progress" etc.
    // The "MANDATORY STATUS LABELS" section lists labels.
    // If status is "Completed", we might favor that, but the request says "Triggers" drive the status.
    // However, if manual status is set to "Cancelled" or "Discontinued" we handled that.
    // For others, we calculate.

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
