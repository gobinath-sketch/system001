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
