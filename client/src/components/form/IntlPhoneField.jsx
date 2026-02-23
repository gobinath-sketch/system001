import PhoneInput from 'react-phone-input-2';
import 'react-phone-input-2/lib/style.css';
import { validatePhoneNumberLength } from 'libphonenumber-js/max';
import mobileExamples from 'libphonenumber-js/mobile/examples';

const normalizeForInput = value => String(value || '').replace(/\D/g, '');
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
  inputClass = ''
}) => {
  const sanitizedValue = normalizeForInput(value);
  const handlePhoneChange = (phoneValue, countryData) => {
    const normalizedDigits = normalizeForInput(phoneValue);
    if (!normalizedDigits) {
      onChange('');
      return;
    }

    const dialCode = normalizeForInput(countryData?.dialCode);
    const withPlus = `+${normalizedDigits}`;
    const countryCode = countryData?.countryCode ? String(countryData.countryCode).toUpperCase() : undefined;
    const maxMobileLocalLength = getMobileExampleLength(countryCode);

    if (dialCode && normalizedDigits.startsWith(dialCode) && maxMobileLocalLength > 0) {
      const localDigits = normalizedDigits.slice(dialCode.length);
      if (localDigits.length > maxMobileLocalLength) return;
    }

    if (normalizedDigits.length > 15) return;
    const lengthResult = validatePhoneNumberLength(withPlus, countryCode);
    if (lengthResult === 'TOO_LONG') return;

    onChange(withPlus);
  };

  return (
    <PhoneInput
      country={country}
      value={sanitizedValue}
      onChange={handlePhoneChange}
      enableSearch
      enableLongNumbers={false}
      countryCodeEditable={false}
      disableSearchIcon
      inputProps={{ required }}
      containerClass={containerClass}
      inputClass={inputClass}
      buttonClass="!border-gray-200 !bg-white"
      dropdownClass="!text-sm"
    />
  );
};

export default IntlPhoneField;
