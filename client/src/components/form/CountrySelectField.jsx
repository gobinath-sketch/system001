const CountrySelectField = ({
  name,
  value,
  onChange,
  className = '',
  required = false,
  disabled = false,
  placeholder = 'Type location'
}) => {
  const normalizedValue = String(value || '');

  const handleChange = (e) => {
    if (name) {
      onChange({
        ...e,
        target: {
          ...e.target,
          name,
          value: e.target.value
        }
      });
      return;
    }
    onChange(e);
  };

  return (
    <div className={className}>
      <input
        type="text"
        name={name}
        value={normalizedValue}
        onChange={handleChange}
        disabled={disabled}
        placeholder={placeholder}
        required={required}
        className="w-full h-[36px] bg-white border border-gray-200 px-3 rounded text-[13px] text-gray-900 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-blue"
      />
    </div>
  );
};

export default CountrySelectField;
