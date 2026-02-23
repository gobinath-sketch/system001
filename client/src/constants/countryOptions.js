import metadata from 'libphonenumber-js/metadata.min.json';

const regionDisplay = typeof Intl !== 'undefined' && typeof Intl.DisplayNames === 'function'
  ? new Intl.DisplayNames(['en'], { type: 'region' })
  : null;

const countryCodes = Object.keys(metadata?.countries || {}).filter(code => /^[A-Z]{2}$/.test(code));

export const COUNTRY_OPTIONS = countryCodes
  .map(code => ({
    code,
    name: regionDisplay?.of(code) || code
  }))
  .sort((a, b) => a.name.localeCompare(b.name));
