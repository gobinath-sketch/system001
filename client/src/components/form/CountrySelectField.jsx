import { useEffect, useMemo, useRef, useState } from 'react';
import ReactCountryFlag from 'react-country-flag';
import countries from 'i18n-iso-countries';
import enLocale from 'i18n-iso-countries/langs/en.json';
import { City, State } from 'country-state-city';

countries.registerLocale(enLocale);

const COUNTRY_OPTIONS = Object.entries(countries.getNames('en', { select: 'official' }))
  .map(([code, name]) => ({ code, name }))
  .sort((a, b) => a.name.localeCompare(b.name));

const normalizeText = (value = '') => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .trim()
  .toLowerCase();

const parseLocation = (rawValue = '') => {
  const normalizedValue = String(rawValue || '').trim();
  if (!normalizedValue) return { country: '', stateOrCity: '' };

  const [countryPart, ...stateOrCityParts] = normalizedValue.split(',');
  return {
    country: (countryPart || '').trim(),
    stateOrCity: stateOrCityParts.join(',').trim()
  };
};

const findCountryByName = (countryName = '') => {
  const normalized = normalizeText(countryName);
  if (!normalized) return null;
  return COUNTRY_OPTIONS.find(option => normalizeText(option.name) === normalized) || null;
};

const CountrySelectField = ({
  name,
  value,
  onChange,
  className = '',
  required = false,
  disabled = false,
  placeholder = 'Select country'
}) => {
  const countryWrapperRef = useRef(null);
  const stateWrapperRef = useRef(null);
  const { country, stateOrCity } = parseLocation(value);
  const [countryQuery, setCountryQuery] = useState(country);
  const [isCountryOpen, setIsCountryOpen] = useState(false);
  const [stateQuery, setStateQuery] = useState(stateOrCity);
  const [isStateOpen, setIsStateOpen] = useState(false);

  useEffect(() => {
    setCountryQuery(country);
  }, [country]);

  useEffect(() => {
    setStateQuery(stateOrCity);
  }, [stateOrCity]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (countryWrapperRef.current && !countryWrapperRef.current.contains(event.target)) {
        setIsCountryOpen(false);
      }
      if (stateWrapperRef.current && !stateWrapperRef.current.contains(event.target)) {
        setIsStateOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredCountries = useMemo(() => {
    const search = normalizeText(countryQuery);
    if (!search) return COUNTRY_OPTIONS;
    return COUNTRY_OPTIONS.filter(option => normalizeText(option.name).includes(search));
  }, [countryQuery]);

  const selectedCountry = useMemo(() => findCountryByName(countryQuery), [countryQuery]);
  const locationOptions = useMemo(() => {
    if (!selectedCountry?.code) return [];
    const statesRaw = State.getStatesOfCountry(selectedCountry.code);
    const stateNameByCode = new Map(statesRaw.map(option => [option.isoCode, option.name]));

    const states = statesRaw
      .map(option => ({
        id: `state-${option.isoCode}-${option.name}`,
        type: 'state',
        label: `State: ${option.name}`,
        value: option.name,
        selectionValue: option.name,
        searchText: normalizeText(option.name)
      }));
    const cities = City.getCitiesOfCountry(selectedCountry.code)
      .map(option => ({
        id: `city-${option.stateCode || 'na'}-${option.name}`,
        type: 'city',
        label: stateNameByCode.get(option.stateCode)
          ? `City: ${option.name} (${stateNameByCode.get(option.stateCode)})`
          : `City: ${option.name}`,
        value: option.name,
        selectionValue: stateNameByCode.get(option.stateCode)
          ? `${option.name}, ${stateNameByCode.get(option.stateCode)}`
          : option.name,
        searchText: normalizeText(`${option.name} ${stateNameByCode.get(option.stateCode) || ''}`)
      }));

    return [...states, ...cities].sort((a, b) => a.label.localeCompare(b.label));
  }, [selectedCountry]);
  const filteredLocations = useMemo(() => {
    const search = normalizeText(stateQuery);
    if (!search) return locationOptions;
    return locationOptions.filter(option => option.searchText.includes(search));
  }, [stateQuery, locationOptions]);

  const emitChange = (nextCountry, nextStateOrCity) => {
    const mergedLocation = [nextCountry.trim(), nextStateOrCity.trim()]
      .filter(Boolean)
      .join(', ');

    const syntheticEvent = {
      target: {
        name,
        value: mergedLocation
      }
    };

    onChange(syntheticEvent);
  };

  const selectCountry = (selectedCountry) => {
    setCountryQuery(selectedCountry.name);
    emitChange(selectedCountry.name, stateOrCity);
    setIsCountryOpen(false);
  };

  const handleCountryInputChange = (e) => {
    const inputValue = e.target.value;
    setCountryQuery(inputValue);
    setIsCountryOpen(true);

    if (!inputValue.trim()) {
      setStateQuery('');
      setIsStateOpen(false);
      emitChange('', '');
    }
  };

  const handleCountryInputBlur = () => {
    const normalizedQuery = normalizeText(countryQuery);
    if (!normalizedQuery) {
      setCountryQuery('');
      setStateQuery('');
      emitChange('', '');
      return;
    }

    const matched = findCountryByName(countryQuery);
    if (matched) {
      emitChange(matched.name, stateOrCity);
      setCountryQuery(matched.name);
      return;
    }
    const startsWithMatch = COUNTRY_OPTIONS.find(option => normalizeText(option.name).startsWith(normalizedQuery));
    if (startsWithMatch) {
      emitChange(startsWithMatch.name, stateOrCity);
      setCountryQuery(startsWithMatch.name);
      return;
    }
    setCountryQuery(country);
  };

  const selectState = (option) => {
    setStateQuery(option.selectionValue);
    emitChange(country, option.selectionValue);
    setIsStateOpen(false);
  };

  const handleStateInputChange = (e) => {
    const inputValue = e.target.value;
    setStateQuery(inputValue);
    setIsStateOpen(true);
  };

  const handleStateInputBlur = () => {
    const normalizedStateQuery = normalizeText(stateQuery);
    if (!normalizedStateQuery) {
      emitChange(country, '');
      setStateQuery('');
      return;
    }

    const exact = locationOptions.find(option => normalizeText(option.selectionValue) === normalizedStateQuery);
    if (exact) {
      emitChange(country, exact.selectionValue);
      setStateQuery(exact.selectionValue);
      return;
    }

    const startsWithMatch = locationOptions.find(option => option.searchText.startsWith(normalizedStateQuery));
    if (startsWithMatch) {
      emitChange(country, startsWithMatch.selectionValue);
      setStateQuery(startsWithMatch.selectionValue);
      return;
    }

    emitChange(country, stateQuery);
  };

  return (
    <div className={className}>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div className="relative" ref={countryWrapperRef}>
          {selectedCountry && (
            <span className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
              <ReactCountryFlag countryCode={selectedCountry.code} svg style={{ width: '1.1em', height: '1.1em' }} />
            </span>
          )}
          <input
            type="text"
            name={name}
            value={countryQuery}
            onChange={handleCountryInputChange}
            onFocus={() => !disabled && setIsCountryOpen(true)}
            onBlur={handleCountryInputBlur}
            disabled={disabled}
            placeholder={placeholder}
            required={required}
            autoComplete="off"
            className={`w-full h-[36px] bg-white border border-gray-200 rounded text-[13px] text-gray-900 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-blue ${selectedCountry ? 'pl-9 pr-3' : 'px-3'}`}
          />
          {isCountryOpen && !disabled && (
            <div className="absolute z-[10000] mt-1 w-full bg-white border border-gray-200 rounded-md shadow-lg max-h-56 overflow-y-auto overflow-x-hidden">
              {filteredCountries.length > 0 ? (
                filteredCountries.map(option => (
                  <button
                    key={option.code}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => selectCountry(option)}
                    className="w-full px-3 py-2 text-left text-[13px] text-gray-800 hover:bg-blue-50 flex items-center gap-2"
                  >
                    <ReactCountryFlag countryCode={option.code} svg style={{ width: '1.1em', height: '1.1em' }} />
                    <span>{option.name}</span>
                  </button>
                ))
              ) : (
                <div className="px-3 py-2 text-[13px] text-gray-500">No countries found</div>
              )}
            </div>
          )}
        </div>
        <div className="relative" ref={stateWrapperRef}>
          <input
            type="text"
            name={name}
            data-field="stateOrCity"
            value={stateQuery}
            onChange={handleStateInputChange}
            onFocus={() => !disabled && selectedCountry && setIsStateOpen(true)}
            onBlur={handleStateInputBlur}
            disabled={disabled || !selectedCountry}
            placeholder={selectedCountry ? 'Select state or city' : 'Select country first'}
            className="w-full h-[36px] bg-white border border-gray-200 px-3 rounded text-[13px] text-gray-900 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-blue disabled:bg-gray-100 disabled:text-gray-500"
          />
          {isStateOpen && !disabled && selectedCountry && (
            <div className="absolute z-[10000] mt-1 w-full bg-white border border-gray-200 rounded-md shadow-lg max-h-56 overflow-y-auto overflow-x-hidden">
              {filteredLocations.length > 0 ? (
                filteredLocations.map(option => (
                  <button
                    key={option.id}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => selectState(option)}
                    className="w-full px-3 py-2 text-left text-[13px] text-gray-800 hover:bg-blue-50 overflow-hidden whitespace-nowrap text-ellipsis"
                  >
                    {option.label}
                  </button>
                ))
              ) : (
                <div className="px-3 py-2 text-[13px] text-gray-500">No states/cities found</div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CountrySelectField;
