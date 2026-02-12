import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';

const SearchableSelect = ({ options, value, onChange, placeholder, disabled, className, required, name }) => {
    const [isOpen, setIsOpen] = useState(false);
    const wrapperRef = useRef(null);
    const inputRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleInputChange = (e) => {
        setIsOpen(true);
        if (onChange) {
            onChange(e);
        }
    };

    const handleOptionClick = (option) => {
        setIsOpen(false);
        if (onChange) {
            onChange({ target: { name, value: option } });
        }
        if (inputRef.current) {
            inputRef.current.blur(); // Remove focus to "accept" visualization
        }
        setIsOpen(false);
    };

    const filteredOptions = options.filter(option => {
        const label = typeof option === 'string' ? option : option.label;
        return (label || '').toLowerCase().includes((value || '').toLowerCase());
    });

    return (
        <div className="relative w-full" ref={wrapperRef}>
            <div className="relative">
                <input
                    ref={inputRef}
                    type="text"
                    name={name}
                    value={value || ''}
                    onChange={handleInputChange}
                    onClick={() => !disabled && setIsOpen(true)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                            e.preventDefault();
                            setIsOpen(false);
                            e.target.blur(); // Remove focus to "accept"
                        }
                    }}
                    disabled={disabled}
                    placeholder={placeholder}
                    className={`${className} pr-8 cursor-text bg-white`} // Force white bg & text cursor
                    autoComplete="off"
                    required={required}
                />
                <div className="absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none text-gray-500">
                    <ChevronDown size={18} />
                </div>
            </div>

            {isOpen && !disabled && filteredOptions.length > 0 && (
                <div className="absolute z-[100] w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-y-auto">
                    {filteredOptions.map((option, index) => {
                        const isString = typeof option === 'string';
                        const label = isString ? option : option.label;
                        const optionValue = isString ? option : option.value;
                        const icon = !isString ? option.icon : null;

                        return (
                            <div
                                key={index}
                                className="px-4 py-2 cursor-pointer hover:bg-blue-50 text-sm text-gray-700 hover:text-primary-blue transition-colors flex items-center"
                                onClick={() => handleOptionClick(optionValue)}
                            >
                                {icon && (
                                    <img
                                        src={icon}
                                        alt=""
                                        className="w-5 h-5 object-contain mr-3"
                                    />
                                )}
                                <span>{label}</span>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default SearchableSelect;
