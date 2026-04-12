import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import { API_BASE } from '../../config/api';

const CourseAutocomplete = ({ technology, trainingRequirement, value, onChange, disabled, className }) => {
    const [options, setOptions] = useState([]);
    const [isOpen, setIsOpen] = useState(false);
    const [inputValue, setInputValue] = useState(value || '');
    const [isFetching, setIsFetching] = useState(false);
    const wrapperRef = useRef(null);
    const debounceRef = useRef(null);

    // Sync external value changes (e.g. from parent on mount)
    useEffect(() => {
        setInputValue(value || '');
    }, [value]);

    // Fetch recommendations — debounced, triggered by inputValue or open state
    const fetchRecommendations = useCallback(async (query) => {
        if (!technology) {
            setOptions([]);
            return;
        }
        setIsFetching(true);
        try {
            const token = sessionStorage.getItem('token');
            const cleanTech = technology
                .replace('Other technologies - ', '')
                .replace('Emerging technologies - ', '');
            const res = await axios.get(`${API_BASE}/api/courses/recommend`, {
                params: { technology: cleanTech, query: query || '' },
                headers: { Authorization: `Bearer ${token}` }
            });
            setOptions(res.data);
        } catch (err) {
            console.error('Error fetching courses:', err);
        } finally {
            setIsFetching(false);
        }
    }, [technology]);

    // Debounce on inputValue change (only when dropdown is open)
    useEffect(() => {
        if (!isOpen) return;
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
            // Use inputValue as query; seed with trainingRequirement if input is blank
            const query = inputValue.trim() || trainingRequirement || '';
            fetchRecommendations(query);
        }, 300);
        return () => clearTimeout(debounceRef.current);
    }, [inputValue, isOpen, trainingRequirement, fetchRecommendations]);

    // On initial open with blank input, seed from trainingRequirement
    useEffect(() => {
        if (isOpen && inputValue === '' && trainingRequirement) {
            fetchRecommendations(trainingRequirement);
        }
    }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

    // Close on outside click
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

        // Parse "CODE - Name" format for manual entry
        let code = '';
        let name = val;
        if (val.includes(' - ')) {
            const idx = val.indexOf(' - ');
            code = val.slice(0, idx).trim();
            name = val.slice(idx + 3).trim();
        }
        onChange(code, name, null);
    };

    const handleSelect = (course) => {
        const displayValue = `${course.courseCode} - ${course.courseName}`;
        setInputValue(displayValue);
        setIsOpen(false);
        onChange(course.courseCode, course.courseName, course.durationHours ?? null);
    };

    // Determine if an option is an exact match against current input
    const normalizedInput = inputValue.trim().toLowerCase();
    const isExactMatch = (course) =>
        course.matchType === 'exact' ||
        course.courseName.toLowerCase() === normalizedInput ||
        course.courseCode.toLowerCase() === normalizedInput;

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
                autoComplete="off"
            />
            {isOpen && !disabled && (
                <ul className="absolute z-10 w-full bg-white border border-gray-300 rounded-md mt-1 max-h-60 overflow-auto shadow-lg text-sm">
                    {isFetching ? (
                        <li className="px-4 py-2 text-gray-400 italic">Searching...</li>
                    ) : options.length > 0 ? (
                        options.map((course) => {
                            const exact = isExactMatch(course);
                            return (
                                <li
                                    key={course._id}
                                    className="px-4 py-2 hover:bg-blue-50 cursor-pointer flex flex-col border-b border-gray-100 last:border-0"
                                    onClick={() => handleSelect(course)}
                                >
                                    <div className="flex items-center justify-between gap-2">
                                        <span className="font-semibold text-gray-800">
                                            {course.courseCode} — {course.courseName}
                                        </span>
                                        {exact ? (
                                            <span className="shrink-0 text-xs font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-700">
                                                Exact Match
                                            </span>
                                        ) : (
                                            <span className="shrink-0 text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
                                                Suggested
                                            </span>
                                        )}
                                    </div>
                                    {course.durationHours ? (
                                        <span className="text-xs text-blue-600 mt-0.5">{course.durationHours} Hours</span>
                                    ) : null}
                                </li>
                            );
                        })
                    ) : (
                        <li className="px-4 py-2 text-gray-500 italic">
                            No matches found in database. Manual entry active.
                        </li>
                    )}
                </ul>
            )}
        </div>
    );
};

export default CourseAutocomplete;
