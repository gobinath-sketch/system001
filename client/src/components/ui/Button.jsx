import React from 'react';
import PropTypes from 'prop-types';

const Button = ({
    children,
    onClick,
    variant = 'primary',
    size = 'md',
    disabled = false,
    className = '',
    type = 'button',
    icon: Icon
}) => {
    const baseClasses = 'font-medium rounded-lg transition-all duration-200 flex items-center justify-center space-x-2';

    const variantClasses = {
        primary: 'bg-primary-blue text-white hover:bg-primary-blue-dark active:scale-95 shadow-md hover:shadow-lg',
        secondary: 'bg-accent-yellow text-primary-blue-dark hover:bg-accent-yellow-dark active:scale-95 shadow-md hover:shadow-lg',
        outline: 'border-2 border-primary-blue text-primary-blue hover:bg-primary-blue hover:text-white',
        ghost: 'text-primary-blue hover:bg-primary-blue-light/10',
        danger: 'bg-alert-danger text-white hover:bg-red-600 active:scale-95 shadow-md',
        success: 'bg-alert-success text-white hover:bg-green-600 active:scale-95 shadow-md'
    };

    const sizeClasses = {
        sm: 'px-3 py-1.5 text-sm',
        md: 'px-4 py-2 text-base',
        lg: 'px-6 py-3 text-lg'
    };

    const disabledClasses = disabled
        ? 'opacity-50 cursor-not-allowed pointer-events-none'
        : 'cursor-pointer';

    return (
        <button
            type={type}
            onClick={onClick}
            disabled={disabled}
            className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${disabledClasses} ${className}`}
        >
            {Icon && <Icon size={size === 'sm' ? 16 : size === 'lg' ? 24 : 18} />}
            <span>{children}</span>
        </button>
    );
};

Button.propTypes = {
    children: PropTypes.node.isRequired,
    onClick: PropTypes.func,
    variant: PropTypes.oneOf(['primary', 'secondary', 'outline', 'ghost', 'danger', 'success']),
    size: PropTypes.oneOf(['sm', 'md', 'lg']),
    disabled: PropTypes.bool,
    className: PropTypes.string,
    type: PropTypes.oneOf(['button', 'submit', 'reset']),
    icon: PropTypes.elementType
};

export default Button;
