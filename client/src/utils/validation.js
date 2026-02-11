// Validation utility functions

export const validateMobile = (mobile) => {
    if (!mobile) return { valid: false, message: 'Mobile number is required' };

    // Remove spaces for validation
    const cleanedMobile = mobile.replace(/\s/g, '');

    // Check if it contains only digits after cleaning
    if (!/^[0-9]+$/.test(cleanedMobile)) {
        return { valid: false, message: 'Mobile number must contain only numbers' };
    }

    // Check exact digit count
    const digitCount = cleanedMobile.length;
    if (digitCount !== 10) {
        return { valid: false, message: `Only ${digitCount} digit${digitCount !== 1 ? 's' : ''} entered. Mobile number must be exactly 10 digits` };
    }

    return { valid: true, message: '' };
};

export const validateEmail = (email) => {
    if (!email) return { valid: false, message: 'Email is required' };
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        return { valid: false, message: 'Please enter a valid email address' };
    }
    return { valid: true, message: '' };
    return { valid: true, message: '' };
};

export const validatePAN = (pan) => {
    if (!pan) return { valid: false, message: 'PAN is required' };
    if (!/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(pan)) {
        return { valid: false, message: 'Invalid PAN format (e.g. ABCDE1234F)' };
    }
    return { valid: true, message: '' };
};

export const validateGST = (gst) => {
    if (!gst) return { valid: false, message: 'GST is required' };
    if (!/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(gst)) {
        return { valid: false, message: 'Invalid GSTIN format' };
    }
    return { valid: true, message: '' };
};

export const validateBankAccount = (accountNumber) => {
    if (!accountNumber) return { valid: false, message: 'Account number is required' };
    if (!/^[0-9]{9,18}$/.test(accountNumber)) {
        return { valid: false, message: 'Account number must be 9-18 digits' };
    }
    return { valid: true, message: '' };
};

export const validateIFSC = (ifsc) => {
    if (!ifsc) return { valid: false, message: 'IFSC is required' };
    if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc)) {
        return { valid: false, message: 'Invalid IFSC Code (e.g. HDFC0001234)' };
    }
    return { valid: true, message: '' };
};

export const validateForm = (data, fields) => {
    const errors = {};

    fields.forEach(field => {
        if (field.type === 'mobile') {
            const result = validateMobile(data[field.name]);
            if (!result.valid) errors[field.name] = result.message;
        } else if (field.type === 'email') {
            const result = validateEmail(data[field.name]);
            if (!result.valid) errors[field.name] = result.message;
        }
    });

    return {
        isValid: Object.keys(errors).length === 0,
        errors
    };
};
