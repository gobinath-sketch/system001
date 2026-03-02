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
        className={`w-full border p-2 rounded-lg text-base border-gray-500 ${disabled ? 'bg-gray-100 text-gray-800 cursor-not-allowed' : 'bg-gray-50 text-gray-900 focus:ring-2 focus:ring-primary-blue focus:outline-none'}`}
      />
    </div>
  );
};

export default CountrySelectField;
