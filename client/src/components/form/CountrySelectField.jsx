import Select from 'react-select';
import ReactCountryFlag from 'react-country-flag';
import { COUNTRY_OPTIONS } from '../../constants/countryOptions';

const CountrySelectField = ({
  name,
  value,
  onChange,
  className = '',
  required = false,
  disabled = false,
  placeholder = 'Select country'
}) => {
  const normalizedValue = String(value || '').trim();
  const hasExisting = COUNTRY_OPTIONS.some(option => option.name === normalizedValue);
  const options = COUNTRY_OPTIONS.map(option => ({
    value: option.name,
    label: option.name,
    code: option.code
  }));
  if (normalizedValue && !hasExisting) {
    options.unshift({
      value: normalizedValue,
      label: normalizedValue,
      code: ''
    });
  }

  const selectedOption = options.find(option => option.value === normalizedValue) || null;
  const handleChange = option => {
    onChange({
      target: {
        name,
        value: option?.value || ''
      }
    });
  };
  return (
    <div className={className}>
      {required ? <input tabIndex={-1} autoComplete="off" value={normalizedValue} onChange={() => { }} required className="absolute opacity-0 pointer-events-none h-0 w-0" /> : null}
      <Select
        options={options}
        value={selectedOption}
        onChange={handleChange}
        isDisabled={disabled}
        placeholder={placeholder}
        isSearchable
        classNamePrefix="country-select"
        formatOptionLabel={(option) => (
          <div className="flex items-center gap-2">
            {option.code ? <ReactCountryFlag countryCode={option.code} svg style={{ width: '1.1em', height: '1.1em' }} /> : null}
            <span>{option.label}</span>
          </div>
        )}
        styles={{
          control: (base, state) => ({
            ...base,
            minHeight: 36,
            borderColor: state.isFocused ? '#003D7A' : '#e5e7eb',
            boxShadow: state.isFocused ? '0 0 0 2px rgba(0, 61, 122, 0.2)' : 'none',
            borderRadius: 6,
            backgroundColor: '#fff'
          }),
          valueContainer: base => ({
            ...base,
            padding: '0 12px'
          }),
          input: base => ({
            ...base,
            margin: 0,
            padding: 0,
            ...{
              fontSize: '13px'
            }
          }),
          singleValue: base => ({
            ...base,
            fontSize: '13px'
          }),
          option: (base, state) => ({
            ...base,
            fontSize: '13px',
            backgroundColor: state.isFocused ? '#eff6ff' : '#fff',
            color: '#111827'
          }),
          placeholder: base => ({
            ...base,
            fontSize: '13px',
            color: '#6b7280'
          }),
          menuPortal: base => ({
            ...base,
            zIndex: 70
          })
        }}
        menuPortalTarget={typeof document !== 'undefined' ? document.body : null}
      />
    </div>
  );
};

export default CountrySelectField;
