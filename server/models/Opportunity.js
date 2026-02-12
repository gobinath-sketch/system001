const mongoose = require('mongoose');

// Sub-schema for detailed vendor expenses
const DetailedExpenseSchema = new mongoose.Schema({
    vendorName: { type: String },
    poNumber: { type: String },
    poDate: { type: Date },
    poValue: { type: Number },
    poDocument: { type: String },
    invoiceNumber: { type: String },
    invoiceDate: { type: Date },
    invoiceValue: { type: Number }, // Excl Tax
    invoiceValueWithTax: { type: Number }, // Incl GST
    gstType: { type: String },
    gstAmount: { type: Number },
    tdsPercent: { type: Number },
    tdsAmount: { type: Number },
    finalPayable: { type: Number },
    invoiceDocument: { type: String }
}, { _id: false });

const OpportunitySchema = new mongoose.Schema({
    // ===== AUTO-GENERATED FIELDS =====
    opportunityNumber: {
        type: String,
        required: true,
        unique: true,
        length: 12
    },

    // ===== PROGRESS TRACKING FIELDS (AUTO-CALCULATED) =====

    progressPercentage: {
        type: Number,
        default: 0,
        min: 0,
        max: 100
    },

    statusStage: {
        type: String,
        enum: ['Creation', 'Created', 'Costing', 'Proposal', 'PO Received', 'PO Confirmed', 'Invoiced', 'Scheduled', 'In Progress', 'Completed', 'Cancelled', 'Discontinued'],
        default: 'Created' // Updated default to match new logic
    },

    statusLabel: {
        type: String,
        default: 'Opportunity Created'
    },

    // ===== STAGE 1: CREATION FIELDS =====

    requirementSummary: {
        type: String
    },

    requirementDocument: {
        type: String // File path
    },

    // ===== STAGE 3: PROPOSAL FIELDS =====

    proposalDocument: {
        type: String // File path or URL
    },

    proposalUploadedAt: {
        type: Date
    },

    sowDocument: {
        type: String // File path or URL
    },

    // ===== STAGE 4: PO FIELDS =====

    poDocument: {
        type: String // File path or URL
    },

    poValue: {
        type: Number,
        default: 0
    },

    poDate: {
        type: Date
    },

    invoiceDocument: {
        type: String // File path or URL
    },

    invoiceValue: {
        type: Number,
        default: 0
    },



    // selectedVendor removed

    selectedSME: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'SME'
    },

    // ===== CHECKPOINT 1: BASE DETAILS (SALES ONLY - MANDATORY) =====

    type: {
        type: String,
        required: true,
        enum: ['Training', 'Vouchers', 'Resource Support', 'Lab Support', 'Content Development', 'Product Support']
    },

    client: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Client',
        required: true
    },

    participants: { type: Number, required: true },
    days: { type: Number }, // removed required as per request
    selectedContactPerson: { type: String }, // Stores name of selected contact

    // ===== CHECKPOINT 2: TYPE-SPECIFIC DETAILS (SALES ONLY) =====

    typeSpecificDetails: {
        // Common to most types
        technology: { type: String },

        // Training-specific
        trainingName: { type: String },
        modeOfTraining: {
            type: String,
            enum: ['Virtual', 'Classroom', 'Hybrid']
        },
        // batchSize removed (use participants)
        // batchSize removed (use participants)
        trainingLocation: { type: String }, // Only for Classroom/Hybrid

        // Vouchers-specific
        examDetails: { type: String },
        numberOfVouchers: { type: Number },
        examLocation: { type: String },
        // Support multiple regions with different counts
        voucherRegions: [{
            region: { type: String },
            voucherCount: { type: Number }
        }],

        // Lab Support-specific
        labRequirement: { type: String },
        numberOfIDs: { type: Number },
        duration: { type: String },
        region: { type: String },

        // Resource Support
        resourceType: { type: String },
        resourceCount: { type: Number },

        // Content Development
        contentType: { type: String },
        deliveryFormat: { type: String },

        // Product Support
        projectScope: { type: String },
        teamSize: { type: Number },

        description: { type: String },
        requirements: { type: String }
    },

    // ===== CHECKPOINT 3: COMMON DETAILS (MIXED OWNERSHIP) =====

    commonDetails: {
        // Auto-fetched from Client Base
        trainingSector: {
            type: String,
            enum: ['Corporate', 'Enterprise', 'Academics', 'University', 'College', 'School']
        },

        status: {
            type: String,
            enum: ['Active', 'Pending', 'In Progress', 'Completed', 'Closed', 'Lost', 'Scheduled', 'Cancelled', 'Discontinued'],
            default: 'Active'
        },

        trainingSupporter: {
            type: String,
            enum: ['GKT', 'GKCS', 'MCT'],
            default: 'GKT'
        },

        // Auto-filled from opportunity creator
        sales: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },

        year: { type: Number },
        monthOfTraining: { type: String },
        adhocId: { type: String },
        // technology removed (redundant)

        billingClientName: { type: String },
        endClientName: { type: String },

        courseCode: { type: String },
        courseName: { type: String },
        brand: { type: String },

        // numberOfParticipants removed (redundant)
        attendanceParticipants: { type: Number },

        startDate: { type: Date },
        endDate: { type: Date },
        duration: { type: Number },
        location: { type: String },

        trainerDetails: {
            name: { type: String },
            email: { type: String },
            contactNumber: { type: String },
            expertise: { type: String }
        },
        tov: { type: Number }, // Total Order Value
        tovRate: { type: Number }, // Rate entered by user
        tovUnit: {
            type: String,
            enum: ['Fixed', 'Per Day', 'Per Participant'],
            default: 'Fixed'
        },

        clientPONumber: { type: String },
        clientPODate: { type: Date },
        clientInvoiceNumber: { type: String },
        clientInvoiceDate: { type: Date }
    },

    // ===== CHECKPOINT 4: EXPENSE & FINANCIAL DETAILS (DELIVERY ONLY) =====

    expenses: {
        trainerCost: { type: Number, default: 0 },
        vouchersCost: { type: Number, default: 0 },
        gkRoyalty: { type: Number, default: 0 },
        material: { type: Number, default: 0 },
        labs: { type: Number, default: 0 },
        venue: { type: Number, default: 0 },
        travel: { type: Number, default: 0 },
        accommodation: { type: Number, default: 0 },
        perDiem: { type: Number, default: 0 },
        localConveyance: { type: Number, default: 0 },
        marketing: { type: Number, default: 0 },
        contingency: { type: Number, default: 0 },
        marketingPercent: { type: Number, default: 0, min: 0, max: 100 }, // Default 0%
        contingencyPercent: { type: Number, default: 15, min: 0, max: 100 }, // Default 15%
        targetGpPercent: { type: Number, default: 30, min: 0, max: 100 }, // Added field
        breakdown: { type: mongoose.Schema.Types.Mixed, default: {} } // Stores detailed breakdown (rates, types, etc.)
    },

    expenseDocuments: {
        type: Map,
        of: [String] // Array of file URLs/paths per key (e.g., 'trainerCost' => ['url1', 'url2'])
    },

    deliveryDocuments: {
        attendance: { type: String },
        feedback: { type: String },
        assessment: { type: String },
        performance: { type: String },
        sme_profile: { type: String }
    },

    // Auto-calculated financial fields
    financials: {
        totalExpense: { type: Number, default: 0 },
        costPerDay: { type: Number, default: 0 },
        tov: { type: Number, default: 0 }, // Total Order Value
        gktRevenue: { type: Number, default: 0 },
        gktRevenuePerDay: { type: Number, default: 0 },
        grossProfitPercent: { type: Number, default: 0 }
    },

    // ===== CHECKPOINT 5: ROLE-BASED LOCKING & OWNERSHIP =====

    fieldOwnership: {
        // Track which fields are locked for which roles
        salesLockedFields: [String], // Fields locked for Sales (filled by Delivery)
        deliveryLockedFields: [String] // Fields locked for Delivery (filled by Sales)
    },

    // ===== FINANCE DETAILS (FINANCE MODULE) =====
    financeDetails: {
        // TAB I: Client Receivables
        clientReceivables: {
            paymentTerms: { type: String },
            paymentDueDate: { type: Date },
            invoiceAmount: { type: Number }, // Without Tax
            gstAmount: { type: Number },
            gstType: { type: String }, // e.g. 'IGST-18%'
            tds: { type: Number }, // Amount
            tdsPercent: { type: Number }, // e.g. 10
            totalInvoiceAmount: { type: Number },
            amountReceivable: { type: Number }
        },

        // TAB II: Vendor Payables (Multi-Category)
        vendorPayables: {
            detailed: {
                trainer: DetailedExpenseSchema,
                travel: DetailedExpenseSchema,
                accommodation: DetailedExpenseSchema,
                venue: DetailedExpenseSchema,
                courseMaterials: DetailedExpenseSchema,
                lab: DetailedExpenseSchema,
                royalty: DetailedExpenseSchema,
                marketing: DetailedExpenseSchema
            },
            perDiem: {
                amount: { type: Number, default: 0 },
                document: { type: String }
            },
            other: {
                amount: { type: Number, default: 0 },
                document: { type: String }
            }
        }
    },

    // ===== APPROVAL WORKFLOW =====

    approvalStatus: {
        type: String,
        enum: ['Not Required', 'Pending Manager', 'Pending Director', 'Approved', 'Rejected'],
        default: 'Not Required'
    },

    approvalRequired: { type: Boolean, default: false },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    approvedAt: { type: Date },

    rejectedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    rejectedAt: { type: Date },
    rejectionReason: { type: String },

    // ===== ACTIVITY LOG =====
    activityLog: [{
        action: { type: String, required: true }, // e.g., 'Created', 'Updated Expenses', 'Uploaded Proposal'
        by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        role: { type: String }, // User's role at the time of action
        timestamp: { type: Date, default: Date.now },
        details: { type: String } // Optional extra info
    }],

    // ===== METADATA =====

    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },

    lastModifiedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },

    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

// ===== PRE-SAVE HOOKS =====

OpportunitySchema.pre('save', async function () {
    try {
        // Auto-fill sales person from creator
        if (!this.commonDetails.sales) {
            this.commonDetails.sales = this.createdBy;
        }

        // Auto-fetch training sector from client base (will be populated in route)
        // This is handled in the route when client is selected

        // Calculate financials
        const exp = this.expenses || {}; // Safety fallback

        // Base expense (all fixed amounts entered by Delivery)
        const baseExpense =
            (exp.trainerCost || 0) + (exp.vouchersCost || 0) + (exp.gkRoyalty || 0) + (exp.material || 0) + (exp.labs || 0) +
            (exp.venue || 0) + (exp.travel || 0) + (exp.accommodation || 0) + (exp.perDiem || 0) +
            (exp.localConveyance || 0);

        // TOV from commonDetails (Entered by Sales)
        // TOV from commonDetails or financials
        const tov = (this.commonDetails && this.commonDetails.tov) || (this.financials && this.financials.tov) || 0;

        // Marketing Amount (Percentage of Base Expense)
        const marketingPercent = (exp.marketingPercent !== undefined && exp.marketingPercent !== null) ? exp.marketingPercent : 0;
        // Use saved amount if available (user override), otherwise calculate
        const marketingAmount = (exp.marketing > 0) ? exp.marketing : ((baseExpense * marketingPercent) / 100);

        // Contingency Amount (Percentage of Base Expense)
        let contingencyPercent = exp.contingencyPercent;
        if (contingencyPercent === undefined || contingencyPercent === null) {
            contingencyPercent = 15;
        }
        // Use saved amount if available (user override), otherwise calculate
        const contingencyAmount = (exp.contingency > 0) ? exp.contingency : ((baseExpense * contingencyPercent) / 100);

        console.log(`Financial Calc: TOV=${tov}, Base=${baseExpense}, Mrk%=${marketingPercent}, Cont%=${contingencyPercent}`);

        // Ensure financials object exists
        if (!this.financials) this.financials = {};

        // Persist calculated amounts to expenses schema
        if (this.expenses) {
            this.expenses.marketing = marketingAmount;
            this.expenses.contingency = contingencyAmount;
        }

        // Total Expense = Base + Marketing + Contingency
        this.financials.totalExpense = baseExpense + marketingAmount + contingencyAmount;

        // Cost per Day
        const days = this.days || 1;
        this.financials.costPerDay = this.financials.costPerDay = (days > 0) ? (this.financials.totalExpense / days) : 0;

        // Base Calculation Value (Prioritize PO Value for "Financial Summary" sync)
        const revenueBase = (this.poValue && this.poValue > 0) ? this.poValue : tov;

        console.log(`Financial Calc: RevenueBase=${revenueBase} (PO=${this.poValue}, TOV=${tov})`);

        // GKT Revenue = RevenueBase - Total Expense
        this.financials.gktRevenue = revenueBase - this.financials.totalExpense;

        // GKT Revenue per Day
        this.financials.gktRevenuePerDay = (days > 0) ? (this.financials.gktRevenue / days) : 0;

        // GP % = (GKT Revenue / RevenueBase) * 100
        if (revenueBase > 0) {
            this.financials.grossProfitPercent = (this.financials.gktRevenue / revenueBase) * 100;
        } else {
            this.financials.grossProfitPercent = 0;
        }

        // Determine approval requirement - BUT preserve Approved/Rejected statuses
        const gpPercent = this.financials.grossProfitPercent;

        // Only auto-update approval status if it hasn't been manually set to Approved or Rejected
        if (this.approvalStatus !== 'Approved' && this.approvalStatus !== 'Rejected') {
            const contingencyPercent = (this.expenses && this.expenses.contingencyPercent !== undefined) ? this.expenses.contingencyPercent : 15;

            if (gpPercent < 10) {
                this.approvalRequired = true;
                // Pending Director
            } else if (gpPercent >= 10 && gpPercent < 15) {
                this.approvalRequired = true;
                // Pending Manager
            } else if (contingencyPercent < 10) {
                this.approvalRequired = true;
                // Pending Manager (Low Contingency)
            } else {
                this.approvalRequired = false;
                this.approvalStatus = 'Not Required';
            }
        }


        // Auto-calculate progress before saving
        const { calculateOpportunityProgress } = require('../utils/progressCalculator');
        const progressData = calculateOpportunityProgress(this);
        this.progressPercentage = progressData.progressPercentage;
        this.statusStage = progressData.statusStage;
        this.statusLabel = progressData.statusLabel;


        this.updatedAt = Date.now();
    } catch (err) {
        console.error('Error in Opportunity pre-save hook:', err);
        throw err; // Mongoose will catch this and pass to next()
    }
});

// ===== METHODS =====

// Calculate and return progress data
OpportunitySchema.methods.calculateProgress = function () {
    const { calculateOpportunityProgress } = require('../utils/progressCalculator');
    return calculateOpportunityProgress(this);
};

// Get required fields for next stage
OpportunitySchema.methods.getRequiredFieldsForNextStage = function () {
    const { getRequiredFieldsForNextStage } = require('../utils/progressCalculator');
    return getRequiredFieldsForNextStage(this);
};

// Check if a field can be edited by a specific role
// Check if a field can be edited by a specific role
OpportunitySchema.methods.canEdit = function (fieldPath, userRole) {
    // Sales can edit: base details, type-specific details, AND all common/expenses
    const salesEditableFields = [
        'type', 'client', 'participants', 'days',
        'requirementSummary', // Added this
        'typeSpecificDetails',
        'commonDetails', 'expenses',
        'selectedVendor', 'selectedSME',
        'poVerified', // Added for Sales Manager to verify
        'selectedContactPerson',
        'financeDetails', // ALLOW SALES TO EDIT FINANCE
        'poValue', 'poDate', 'poDocument', // PO Details
        'invoiceValue', 'invoiceDocument' // Invoice Details (for viewing)
    ];

    // Delivery can edit: expenses, all common details, and Vendor Payables in Finance
    const deliveryEditableFields = [
        'expenses',
        'commonDetails',
        'selectedVendor', 'selectedSME',
        'financeDetails', // ALLOW DELIVERY TO EDIT FINANCE (Generalized to fix full object update issue)
        'days', 'participants' // Added permissions for Delivery Team
    ];

    // Finance can edit: Finance Details (Client & Vendor) + Common Details (Payment Terms etc)
    const financeEditableFields = [
        'financeDetails',
        'commonDetails.clientPONumber',
        'commonDetails.clientPODate',
        'commonDetails.clientInvoiceNumber',
        'commonDetails.clientInvoiceDate'
    ];

    let allowed = false;
    if (userRole === 'Sales Executive' || userRole === 'Sales Manager') {
        allowed = salesEditableFields.some(field => fieldPath.startsWith(field));
    } else if (userRole === 'Delivery Team') {
        // Delivery can edit expenses BUT NOT marketing/contingency which are Sales decisions
        if (fieldPath === 'expenses.marketingPercent' || fieldPath === 'expenses.contingencyPercent') {
            allowed = false;
        } else {
            allowed = deliveryEditableFields.some(field => fieldPath.startsWith(field));
        }
    } else if (userRole === 'Finance') {
        allowed = financeEditableFields.some(field => fieldPath.startsWith(field));
    } else if (userRole === 'Director') {
        allowed = false; // Director has view-only access
    }

    console.log(`Checking permission: Role=${userRole}, Field=${fieldPath}, Allowed=${allowed}`);
    return allowed;
};

module.exports = mongoose.model('Opportunity', OpportunitySchema);
