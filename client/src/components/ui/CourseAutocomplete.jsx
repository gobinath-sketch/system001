import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { API_BASE } from '../../config/api';

const CourseAutocomplete = ({ technology, trainingRequirement, value, onChange, disabled, className }) => {
    const [options, setOptions] = useState([]);
    const [isOpen, setIsOpen] = useState(false);
    const [inputValue, setInputValue] = useState(value || '');
    const wrapperRef = useRef(null);

    // Sync external value changes (e.g. from parent on mount)
    useEffect(() => {
        setInputValue(value || '');
    }, [value]);

    useEffect(() => {
        const fetchRecommendations = async () => {
            if (!technology) {
                setOptions([]);
                return;
            }
            try {
                const token = sessionStorage.getItem('token');
                const cleanTech = technology.replace('Other technologies - ', '').replace('Emerging technologies - ', '');
                const res = await axios.get(`${API_BASE}/api/courses/recommend`, {
                    params: {
                        technology: cleanTech,
                        query: trainingRequirement || ''
                    },
                    headers: { Authorization: `Bearer ${token}` }
                });
                setOptions(res.data);
            } catch (err) {
                console.error('Error fetching courses:', err);
            }
        };

        if (isOpen) {
            fetchRecommendations();
        }
    }, [technology, trainingRequirement, isOpen]);

    useEffect(() => {
        function handleClickOutside(event) {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleInputChange = (e) => {
        const val = e.target.value;
        setInputValue(val);
        setIsOpen(true);
        
        let code = '';
        let name = val;
        if (val.includes('-')) {
            const parts = val.split('-');
            code = parts[0].trim();
            name = parts.slice(1).join('-').trim();
        }
        onChange(code, name, null);
    };

    const handleSelect = (course) => {
        const displayValue = `${course.courseCode} - ${course.courseName}`;
        setInputValue(displayValue);
        setIsOpen(false);
        onChange(course.courseCode, course.courseName, course.durationHours);
    };

    const filteredOptions = options.filter(opt => {
        const str = `${opt.courseCode} - ${opt.courseName}`.toLowerCase();
        return str.includes(inputValue.toLowerCase());
    });

    return (
        <div className="relative" ref={wrapperRef}>
            <input
                type="text"
                value={inputValue}
                onChange={handleInputChange}
                onFocus={() => setIsOpen(true)}
                disabled={disabled}
                className={className}
                placeholder="Select or type Course Code - Course Name"
            />
            {isOpen && !disabled && (
                <ul className="absolute z-10 w-full bg-white border border-gray-300 rounded-md mt-1 max-h-60 overflow-auto shadow-lg text-sm">
                    {filteredOptions.length > 0 ? (
                        filteredOptions.map((course) => (
                            <li
                                key={course._id}
                                className="px-4 py-2 hover:bg-gray-100 cursor-pointer flex flex-col"
                                onClick={() => handleSelect(course)}
                            >
                                <span className="font-semibold text-gray-800">{course.courseCode} - {course.courseName}</span>
                                {course.durationHours ? <span className="text-xs text-blue-600 mt-0.5">{course.durationHours} Hours</span> : null}
                            </li>
                        ))
                    ) : (
                        <li className="px-4 py-2 text-gray-500 italic">No exact matches in database. Manual entry active.</li>
                    )}
                </ul>
            )}
        </div>
    );
};

export default CourseAutocomplete;
