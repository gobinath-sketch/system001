import React, { useState, useEffect } from 'react';

const DurationField = ({ durationHours, onChange, disabled, className }) => {
    // Determine initial state based on durationHours
    const initialIsExactDays = durationHours > 0 && durationHours % 8 === 0;
    const [unit, setUnit] = useState(initialIsExactDays ? 'Days' : 'Hours');
    const [value, setValue] = useState(initialIsExactDays ? durationHours / 8 : (durationHours || ''));

    // Sync external changes
    useEffect(() => {
        if (durationHours === 0 || durationHours === null || durationHours === undefined) {
             setValue('');
             return;
        }
        if (unit === 'Days') {
            setValue(durationHours / 8);
        } else {
            setValue(durationHours);
        }
    }, [durationHours, unit]);

    const handleValueChange = (e) => {
        const val = e.target.value;
        const parsed = parseFloat(val);
        setValue(val);
        
        if (!isNaN(parsed) && parsed >= 0) {
            const hours = unit === 'Days' ? parsed * 8 : parsed;
            onChange(hours);
        } else {
            onChange(0);
        }
    };

    const handleUnitChange = (e) => {
        const newUnit = e.target.value;
        setUnit(newUnit);
        
        // Convert the current displayed value directly when unit swaps, keeping the numeric value the same in UI, but changing meaning
        // Or keep the hours matched. It's friendlier to keep the underlying hours matched.
        if (durationHours > 0) {
           if (newUnit === 'Days') {
               setValue(durationHours / 8);
           } else {
               setValue(durationHours);
           }
        }
    };

    return (
        <div className="flex w-full items-center gap-2">
            <input
                type="number"
                value={value}
                onChange={handleValueChange}
                disabled={disabled}
                className={`${className} flex-1`}
                placeholder="0"
                min="0"
                step="0.5"
            />
            <select 
                value={unit}
                onChange={handleUnitChange}
                disabled={disabled}
                className={`${className} w-24 shrink-0 px-2`}
            >
                <option value="Hours">Hours</option>
                <option value="Days">Days</option>
            </select>
        </div>
    );
};

export default DurationField;
