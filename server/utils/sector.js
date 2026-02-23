const CANONICAL_SECTORS = [
    'Enterprise',
    'Academics - College',
    'Academics - Universities',
    'School'
];

const LEGACY_TO_CANONICAL = {
    College: 'Academics - College',
    University: 'Academics - Universities',
    Universities: 'Academics - Universities'
};

function normalizeSector(value) {
    if (!value || typeof value !== 'string') return value;
    const trimmed = value.trim();
    if (!trimmed) return trimmed;
    if (LEGACY_TO_CANONICAL[trimmed]) return LEGACY_TO_CANONICAL[trimmed];
    if (CANONICAL_SECTORS.includes(trimmed)) return trimmed;
    if (trimmed === 'Academics') return 'Academics';
    return trimmed;
}

function sectorGroup(value) {
    const normalized = normalizeSector(value);
    if (
        normalized === 'Academics' ||
        normalized === 'Academics - College' ||
        normalized === 'Academics - Universities'
    ) {
        return 'Academics';
    }
    return normalized || 'Unspecified';
}

module.exports = {
    CANONICAL_SECTORS,
    normalizeSector,
    sectorGroup
};

