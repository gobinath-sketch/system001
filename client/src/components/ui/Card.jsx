import React from 'react';
import PropTypes from 'prop-types';

const Card = ({ children, className = '', variant = 'default', hover = false }) => {
    const baseClasses = 'rounded-lg p-6 transition-shadow';

    const variantClasses = {
        default: 'bg-bg-card shadow-md border border-gray-100',
        highlighted: 'bg-primary-blue-light/10 border-2 border-primary-blue shadow-md',
        warning: 'bg-accent-yellow-light/20 border-2 border-accent-yellow-dark shadow-md',
        danger: 'bg-red-50 border-2 border-alert-danger shadow-md'
    };

    const hoverClass = hover ? 'hover:shadow-lg cursor-pointer' : '';

    return (
        <div className={`${baseClasses} ${variantClasses[variant]} ${hoverClass} ${className}`}>
            {children}
        </div>
    );
};

Card.propTypes = {
    children: PropTypes.node.isRequired,
    className: PropTypes.string,
    variant: PropTypes.oneOf(['default', 'highlighted', 'warning', 'danger']),
    hover: PropTypes.bool
};

export default Card;
