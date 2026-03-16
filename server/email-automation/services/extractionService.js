function getAiConfig() {
    const apiKey = String(process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY || '').trim();
    if (!apiKey) {
        throw new Error('AI key missing: set OPENROUTER_API_KEY or OPENAI_API_KEY');
    }

    return {
        apiKey,
        model: String(process.env.EMAIL_AUTOMATION_MODEL || 'openai/gpt-4o-mini').trim(),
        endpoint: String(process.env.EMAIL_AUTOMATION_LLM_ENDPOINT || 'https://openrouter.ai/api/v1/chat/completions').trim()
    };
}

function extractionTemplate() {
    return {
        intent: 'ignore',
        reason: '',
        confidence: 0,
        client: {
            companyName: '',
            sector: '',
            contactPersons: [
                {
                    name: '',
                    designation: '',
                    department: '',
                    contactNumber: '',
                    email: '',
                    location: '',
                    linkedIn: '',
                    reportingManager: {
                        name: '',
                        designation: '',
                        contactNumber: '',
                        email: ''
                    },
                    isPrimary: true
                }
            ]
        },
        opportunity: {
            opportunityNumber: '',
            type: '',
            participants: 0,
            days: 0,
            requirementSummary: '',
            requirementDocument: '',
            proposalDocument: '',
            proposalUploadedAt: '',
            poDocument: '',
            poValue: 0,
            invoiceDocument: '',
            invoiceValue: 0,
            selectedSME: '',
            assignedTo: '',
            typeSpecificDetails: {
                technology: '',
                trainingName: '',
                programName: '',
                topicSummary: '',
                topicBreakdown: [],
                targetAudience: '',
                modeOfTraining: '',
                deliveryPreference: '',
                trainingLocation: '',
                examDetails: '',
                numberOfVouchers: 0,
                examLocation: '',
                voucherRegions: [],
                labRequirement: '',
                labRequired: '',
                numberOfIDs: 0,
                duration: '',
                durationUnit: '',
                region: '',
                resourceType: '',
                resourceCount: 0,
                contentType: '',
                contentRequested: '',
                syllabusRequested: '',
                trainerProfilesRequired: '',
                trainerAvailabilityRequired: '',
                trainingPlanRequired: '',
                tocRequired: '',
                tocSummary: '',
                prerequisites: '',
                modules: '',
                officialInvitation: '',
                feasibilityRequested: '',
                scopingCallRequired: '',
                scopingCallWindow: '',
                costingRequested: '',
                pricingRequestType: '',
                certificationRequired: '',
                deliveryFormat: '',
                projectScope: '',
                teamSize: 0,
                description: '',
                requirements: ''
            },
            commonDetails: {
                trainingSector: '',
                status: '',
                trainingSupporter: '',
                smeRequired: '',
                sales: '',
                year: 0,
                monthOfTraining: '',
                adhocId: '',
                billingClientName: '',
                endClientName: '',
                courseCode: '',
                courseName: '',
                brand: '',
                businessUnit: '',
                participantGeoSplit: '',
                batchSize: 0,
                attendanceParticipants: 0,
                startDate: '',
                endDate: '',
                duration: 0,
                location: '',
                trainerDetails: {
                    name: '',
                    email: '',
                    contactNumber: '',
                    expertise: ''
                },
                tov: 0,
                tovRate: 0,
                tovUnit: '',
                clientPONumber: '',
                clientPODate: '',
                clientInvoiceNumber: '',
                clientInvoiceDate: ''
            },
            expenses: {
                trainerCost: 0,
                vouchersCost: 0,
                gkRoyalty: 0,
                material: 0,
                labs: 0,
                venue: 0,
                travel: 0,
                accommodation: 0,
                perDiem: 0,
                localConveyance: 0,
                marketing: 0,
                contingency: 0,
                marketingPercent: 0,
                contingencyPercent: 0,
                targetGpPercent: 0,
                breakdown: {}
            },
            expenseDocuments: {},
            deliveryDocuments: {
                attendance: '',
                feedback: '',
                assessment: '',
                performance: '',
                contentDocument: ''
            },
            financeDetails: {
                clientReceivables: {
                    paymentTerms: '',
                    paymentDueDate: '',
                    invoiceAmount: 0,
                    gstAmount: 0,
                    gstType: '',
                    tds: 0,
                    tdsPercent: 0,
                    totalInvoiceAmount: 0,
                    amountReceivable: 0
                },
                vendorPayables: {
                    detailed: {},
                    perDiem: { amount: 0, document: '' },
                    other: { amount: 0, document: '' }
                }
            }
        },
        delivery: {
            notes: '',
            updates: {}
        },
        meeting: {
            shouldCreateEvent: false,
            subject: '',
            description: '',
            start: '',
            end: '',
            timeZone: '',
            location: '',
            meetingLink: '',
            isAllDay: false,
            attendees: []
        }
    };
}

function buildSystemPrompt() {
    return [
        'You are an ERP email-to-JSON extraction engine.',
        'Return STRICT JSON only. No markdown. No prose.',
        'Primary goal: maximize accurate field coverage with minimal hallucination.',
        'If not clearly stated, leave field empty (""/0/{}). Do not guess.',
        'Intent must be one of: new_client_opportunity, opportunity_update, delivery_update, ignore.',
        'Confidence must be 0..1 based on evidence strength.',
        'Preserve any explicit opportunity number (format like GKT26XX03001).',
        'Extract and normalize: dates (ISO 8601), currency amounts (number only), participants, days, locations.',
        'Recognize PO/Invoice signals and map to fields.',
        'These sample mail patterns are common and must be captured when present: training requirement, pricing/commercials request, trainer profile request, agenda/TOC request, scoping/evaluation call request, availability request, syllabus/content request, lab request, participant geo split, certification pricing, batch size, official invitation, feasibility request.',
        'If the message clearly requests a call, meeting, demo, connect session, or join meeting with a date/time, populate meeting.*.',
        'Set meeting.shouldCreateEvent=true only when a real calendar event should be created and both start/end are available.',
        'For meeting.start and meeting.end, return ISO 8601 date-time strings whenever the email provides enough information.',
        'If only a start time is known but duration is not stated, default meeting.end to 60 minutes after meeting.start.',
        'Extract attendees from recipients or explicit participant emails when relevant to the meeting.',
        'When the email asks for trainer profiles, set typeSpecificDetails.trainerProfilesRequired to "Yes".',
        'When the email asks for trainer availability or available slots, set typeSpecificDetails.trainerAvailabilityRequired to "Yes".',
        'When the email asks for a training plan, course agenda, modules, TOC, plan for year-wise students, or topic coverage, populate typeSpecificDetails.trainingPlanRequired/typeSpecificDetails.tocRequired and fill typeSpecificDetails.tocSummary, typeSpecificDetails.modules, and typeSpecificDetails.topicBreakdown.',
        'When the email asks for commercials, costs, quote, costing, pricing structure, package options, or remuneration, set typeSpecificDetails.costingRequested/typeSpecificDetails.pricingRequestType and also map explicit amounts if present.',
        'When the email asks for lab, voucher, exam, or certification details, map them into labRequirement/labRequired/examDetails/numberOfVouchers/certificationRequired.',
        'When the email mentions scoping call, evaluation call, support call, connect session, or availability within X days, set typeSpecificDetails.scopingCallRequired to "Yes" and capture the window in typeSpecificDetails.scopingCallWindow.',
        'When the mail includes target audience such as faculty, associates, students, employees, or department names, populate typeSpecificDetails.targetAudience.',
        'When the mail mentions region or geo split such as India-based employees or 20 - India, populate commonDetails.participantGeoSplit and typeSpecificDetails.region.',
        'When the mail references attached syllabus/content/TOC/template, capture that need in typeSpecificDetails.syllabusRequested/contentRequested and mention the attachment usage in reason if useful.',
        'When the mail is an academic/college request, prefer client.sector or opportunity.commonDetails.trainingSector values like Academics, Higher Education, College, University as supported by evidence.',
        'When the message contains multiple course topics or module bullets, preserve them in typeSpecificDetails.topicBreakdown as an array of strings.',
        'Prefer mapping to existing ERP schema fields listed below.',
        'If multiple values appear, choose the most recent/explicit one and mention conflict in reason.',
        'Do not infer people names as company unless explicitly stated.',
        'Do not use your own company name from email signatures, disclaimers, or footers as client.companyName.',
        'If the sender domain matches the mailbox/org domain, only set client.companyName when the email explicitly names an external client.',
        'Prefer external client names mentioned in the request body over internal company names.',
        'IDs: only set selectedSME/assignedTo if the email explicitly provides a valid Mongo ObjectId; otherwise leave empty.',
        '',
        'ERP JSON schema (output keys):',
        '{',
        '  "intent": "...",',
        '  "reason": "...",',
        '  "confidence": 0.0,',
        '  "client": {',
        '    "companyName": "",',
        '    "sector": "",',
        '    "contactPersons": [',
        '      { "name":"", "designation":"", "department":"", "contactNumber":"", "email":"", "location":"", "linkedIn":"", "reportingManager": { "name":"", "designation":"", "contactNumber":"", "email":"" }, "isPrimary": true }',
        '    ]',
        '  },',
        '  "opportunity": {',
        '    "opportunityNumber": "",',
        '    "type": "Training|Vouchers|Resource Support|Lab Support|Content Development|Product Support",',
        '    "participants": 0,',
        '    "days": 0,',
        '    "requirementSummary": "",',
        '    "requirementDocument": "",',
        '    "proposalDocument": "",',
        '    "proposalUploadedAt": "",',
        '    "poDocument": "",',
        '    "poValue": 0,',
        '    "invoiceDocument": "",',
        '    "invoiceValue": 0,',
        '    "selectedSME": "",',
        '    "assignedTo": "",',
        '    "typeSpecificDetails": {',
        '      "technology": "",',
        '      "trainingName": "",',
        '      "programName": "",',
        '      "topicSummary": "",',
        '      "topicBreakdown": [],',
        '      "targetAudience": "",',
        '      "modeOfTraining": "",',
        '      "deliveryPreference": "",',
        '      "trainingLocation": "",',
        '      "examDetails": "",',
        '      "numberOfVouchers": 0,',
        '      "examLocation": "",',
        '      "voucherRegions": [],',
        '      "labRequirement": "",',
        '      "labRequired": "",',
        '      "numberOfIDs": 0,',
        '      "duration": "",',
        '      "durationUnit": "",',
        '      "region": "",',
        '      "resourceType": "",',
        '      "resourceCount": 0,',
        '      "contentType": "",',
        '      "contentRequested": "",',
        '      "syllabusRequested": "",',
        '      "trainerProfilesRequired": "",',
        '      "trainerAvailabilityRequired": "",',
        '      "trainingPlanRequired": "",',
        '      "tocRequired": "",',
        '      "tocSummary": "",',
        '      "prerequisites": "",',
        '      "modules": "",',
        '      "officialInvitation": "",',
        '      "feasibilityRequested": "",',
        '      "scopingCallRequired": "",',
        '      "scopingCallWindow": "",',
        '      "costingRequested": "",',
        '      "pricingRequestType": "",',
        '      "certificationRequired": "",',
        '      "deliveryFormat": "",',
        '      "projectScope": "",',
        '      "teamSize": 0,',
        '      "description": "",',
        '      "requirements": ""',
        '    },',
        '    "commonDetails": {',
        '      "trainingSector": "",',
        '      "status": "",',
        '      "trainingSupporter": "",',
        '      "smeRequired": "",',
        '      "sales": "",',
        '      "year": 0,',
        '      "monthOfTraining": "",',
        '      "adhocId": "",',
        '      "billingClientName": "",',
        '      "endClientName": "",',
        '      "courseCode": "",',
        '      "courseName": "",',
        '      "brand": "",',
        '      "businessUnit": "",',
        '      "participantGeoSplit": "",',
        '      "batchSize": 0,',
        '      "attendanceParticipants": 0,',
        '      "startDate": "",',
        '      "endDate": "",',
        '      "duration": 0,',
        '      "location": "",',
        '      "trainerDetails": { "name":"", "email":"", "contactNumber":"", "expertise": "" },',
        '      "tov": 0,',
        '      "tovRate": 0,',
        '      "tovUnit": "",',
        '      "clientPONumber": "",',
        '      "clientPODate": "",',
        '      "clientInvoiceNumber": "",',
        '      "clientInvoiceDate": ""',
        '    },',
        '    "expenses": {',
        '      "trainerCost": 0, "vouchersCost": 0, "gkRoyalty": 0, "material": 0, "labs": 0, "venue": 0,',
        '      "travel": 0, "accommodation": 0, "perDiem": 0, "localConveyance": 0,',
        '      "marketing": 0, "contingency": 0, "marketingPercent": 0, "contingencyPercent": 0, "targetGpPercent": 0,',
        '      "breakdown": {}',
        '    },',
        '    "expenseDocuments": {},',
        '    "deliveryDocuments": { "attendance":"", "feedback":"", "assessment":"", "performance":"", "contentDocument": "" },',
        '    "financeDetails": {',
        '      "clientReceivables": { "paymentTerms":"", "paymentDueDate":"", "invoiceAmount":0, "gstAmount":0, "gstType":"", "tds":0, "tdsPercent":0, "totalInvoiceAmount":0, "amountReceivable":0 },',
        '      "vendorPayables": { "detailed": {}, "perDiem": { "amount":0, "document":"" }, "other": { "amount":0, "document":"" } }',
        '    }',
        '  },',
        '  "delivery": {',
        '    "notes": "",',
        '    "updates": {}',
        '  },',
        '  "meeting": {',
        '    "shouldCreateEvent": false,',
        '    "subject": "",',
        '    "description": "",',
        '    "start": "",',
        '    "end": "",',
        '    "timeZone": "",',
        '    "location": "",',
        '    "meetingLink": "",',
        '    "isAllDay": false,',
        '    "attendees": [',
        '      { "name":"", "email":"" }',
        '    ]',
        '  }',
        '}'
    ].join('\n');
}

function clamp01(value) {
    if (!Number.isFinite(value)) return 0;
    return Math.max(0, Math.min(1, value));
}

function mergeDeep(base, incoming) {
    if (Array.isArray(base)) {
        return Array.isArray(incoming) && incoming.length > 0 ? incoming : base;
    }
    if (base && typeof base === 'object') {
        const out = { ...base };
        const src = incoming && typeof incoming === 'object' ? incoming : {};
        Object.keys(src).forEach(key => {
            if (base[key] !== undefined) {
                out[key] = mergeDeep(base[key], src[key]);
            } else {
                out[key] = src[key];
            }
        });
        return out;
    }
    return incoming !== undefined ? incoming : base;
}

function normalizeOutput(parsed) {
    const base = extractionTemplate();
    const merged = mergeDeep(base, parsed || {});

    merged.confidence = clamp01(Number(merged.confidence || 0));
    return merged;
}

async function extractFromEmail(message) {
    const { apiKey, model, endpoint } = getAiConfig();
    const systemPrompt = buildSystemPrompt();
    const input = {
        from: message?.fromEmail || '',
        fromName: message?.fromName || '',
        to: message?.to || [],
        cc: message?.cc || [],
        subject: message?.subject || '',
        body: String(message?.bodyText || '').slice(0, 40000),
        receivedAt: message?.receivedAt || null
    };

    const payload = {
        model,
        temperature: 0,
        response_format: { type: 'json_object' },
        messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: JSON.stringify(input) }
        ]
    };

    const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
    });

    const data = await response.json();
    if (!response.ok) {
        const err = new Error('AI extraction request failed');
        err.payload = data;
        throw err;
    }

    const content = data?.choices?.[0]?.message?.content;
    if (!content) {
        throw new Error('AI extraction returned empty content');
    }

    let parsed;
    try {
        parsed = JSON.parse(content);
    } catch (e) {
        const err = new Error('AI extraction returned invalid JSON');
        err.payload = { content };
        throw err;
    }

    return normalizeOutput(parsed);
}

module.exports = {
    extractFromEmail
};
