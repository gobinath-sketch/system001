import PhoneInput from 'react-phone-input-2';
import 'react-phone-input-2/lib/high-res.css';
import { validatePhoneNumberLength } from 'libphonenumber-js/max';
import mobileExamples from 'libphonenumber-js/mobile/examples';

const normalizeForInput = (value, includePlus = false) => {
  if (!value) return '';
  const sanitized = String(value).replace(/[^\d+]/g, '');
  if (includePlus) return sanitized.startsWith('+') ? sanitized : `+${sanitized.replace(/\+/g, '')}`;
  return sanitized.replace(/\+/g, '');
};

const getMobileExampleLength = iso2 => {
  const code = String(iso2 || '').toUpperCase();
  const example = code ? mobileExamples[code] : '';
  return example ? String(example).replace(/\D/g, '').length : 0;
};

const IntlPhoneField = ({
  value,
  onChange,
  required = false,
  country = 'in',
  containerClass = '',
  inputClass = '',
  inputHeight = '36px'
}) => {
  const sanitizedValue = value ? String(value).replace(/\D/g, '') : '';
  const handlePhoneChange = (phoneValue, countryData) => {
    const normalizedDigits = normalizeForInput(phoneValue);
    if (!normalizedDigits) {
      onChange('');
      return;
    }

    const dialCode = normalizeForInput(countryData?.dialCode);
    const withPlus = `+${normalizedDigits}`;
    onChange(withPlus);
  };

  return (
    <PhoneInput
      country={country}
      value={sanitizedValue}
      onChange={handlePhoneChange}
      enableSearch
      enableLongNumbers={true}
      countryCodeEditable={true}
      disableSearchIcon
      inputProps={{ required }}
      containerClass={`intl-phone-field ${containerClass}`.trim()}
      inputClass={inputClass}
      containerStyle={{ width: '100%' }}
      inputStyle={{ width: '100%', height: inputHeight }}
      buttonStyle={{ height: inputHeight }}
      buttonClass="!border-gray-200 !bg-white"
      dropdownClass="!text-sm"
    />
  );
};

export default IntlPhoneField;
