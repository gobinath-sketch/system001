import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown } from 'lucide-react';
const SearchableSelect = ({
  options,
  value,
  onChange,
  placeholder,
  disabled,
  className,
  required,
  name
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState({
    top: 0,
    left: 0,
    width: 0
  });
  const [isArrowOpen, setIsArrowOpen] = useState(false);
  const wrapperRef = useRef(null);
  const inputRef = useRef(null);

  // Update position on scroll/resize
  useEffect(() => {
    const updatePosition = () => {
      if (isOpen && wrapperRef.current) {
        const rect = wrapperRef.current.getBoundingClientRect();
        setDropdownPosition({
          top: rect.bottom,
          left: rect.left,
          width: rect.width
        });
      }
    };
    if (isOpen) {
      updatePosition();
      window.addEventListener('scroll', updatePosition, true); // Capture phase for modal scroll
      window.addEventListener('resize', updatePosition);
    }
    return () => {
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
    };
  }, [isOpen]);
  useEffect(() => {
    event => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        // Also check if click is inside portal (optional, but often handled by portal event bubbling)
        // Since portal events bubble to React tree, standard wrapperRef check might fail if portal is outside.
        // We need to check if click is on the dropdown element?
        // Actually, events bubble. So click on dropdown inside portal WILL propagate to wrapperRef if portal is child?
        // No, portal is at document.body.
        // But React events bubble through the React tree.
        // So handleClickOutside on document might miss it if we check wrapperRef.contains(target).
        // Target is actual DOM node. wrapperRef is in modal. dropdown is in body.
        // So wrapperRef.contains(dropdownNode) is false.
        // We need to detect click outside BOTH.
        // Let's add an ID or ref to the dropdown content.
      }
      // Simplified: If we click outside wrapper, we close.
      // But if we click dropdown item, what happens?
      // Dropdown item click handler calls setIsOpen(false). Stop propagation?
      // Dropdown item click handler calls setIsOpen(false). Stop propagation?
    }; // We can't use simple handleClickOutside with Portal easily without a ref to Portal content.
    // Let's rely on onBlur or just specific click handling.
    // Or adding a backdrop?
    // Or simpler: The dropdown items have onClick.
    // If user clicks elsewhere on page, we need to close.
    // We can check if target is inside the dropdown ID.
  }, []);

  // Improved click outside logic for Portal
  useEffect(() => {
    const handleClick = event => {
      const dropdownEl = document.getElementById('searchable-select-dropdown');
      if (wrapperRef.current && !wrapperRef.current.contains(event.target) && (!dropdownEl || !dropdownEl.contains(event.target))) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClick);
    }
    return () => document.removeEventListener('mousedown', handleClick);
  }, [isOpen]);
  const handleInputChange = e => {
    if (!isOpen) setIsOpen(true);
    setIsArrowOpen(false); // Reset arrow open state on typing
    if (onChange) {
      onChange(e);
    }
  };
  const handleOptionClick = option => {
    setIsOpen(false);
    if (onChange) {
      onChange({
        target: {
          name,
          value: option
        }
      });
    }
    if (inputRef.current) {
      inputRef.current.blur();
    }
  };
  const filteredOptions = isArrowOpen ? options : options.filter(option => {
    const label = typeof option === 'string' ? option : option.label;
    return (label || '').toLowerCase().includes((value || '').toLowerCase());
  });
  return <div className="relative w-full" ref={wrapperRef}>
            <div className="relative">
                <input ref={inputRef} type="text" name={name} value={value || ''} onChange={handleInputChange} onClick={() => !disabled && setIsOpen(true)} onKeyDown={e => {
        if (e.key === 'Enter') {
          e.preventDefault();
          setIsOpen(false);
          e.target.blur();
        }
      }} disabled={disabled} placeholder={placeholder} className={`${className} pr-8 cursor-text bg-white`} autoComplete="off" required={required} />
                <div className="absolute right-3 top-1/2 transform -translate-y-1/2 cursor-pointer text-gray-500" onClick={e => {
        e.stopPropagation();
        // If closed, open and show all. If open, close.
        if (!isOpen) {
          setIsOpen(true);
          setIsArrowOpen(true);
          inputRef.current?.focus();
        } else {
          setIsOpen(false);
        }
      }}>
                    <ChevronDown size={18} />
                </div>
            </div>

            {isOpen && !disabled && filteredOptions.length > 0 && createPortal(<div id="searchable-select-dropdown" className="fixed z-[9999] bg-white border border-gray-200 rounded-md shadow-lg overflow-y-auto" style={{
      top: `${dropdownPosition.top}px`,
      left: `${dropdownPosition.left}px`,
      width: `${dropdownPosition.width}px`,
      maxHeight: '400px' // Reasonable max height for "full dropdown"
    }}>
                    {filteredOptions.map((option, index) => {
        const isString = typeof option === 'string';
        const label = isString ? option : option.label;
        const optionValue = isString ? option : option.value;
        const icon = !isString ? option.icon : null;
        return <div key={index} className="px-4 py-2 cursor-pointer hover:bg-blue-50 text-sm text-gray-700 hover:text-primary-blue transition-colors flex items-center" onClick={() => handleOptionClick(optionValue)}>
                                {icon && (typeof icon === 'string' ? <img src={icon} alt="" className="w-5 h-5 object-contain mr-3" /> : <div className="mr-3 text-gray-500">
                                            {icon}
                                        </div>)}
                                <span>{label}</span>
                            </div>;
      })}
                </div>, document.body)}
        </div>;
};
export default SearchableSelect;