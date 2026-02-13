import ibmLogo from '../assets/logos/ibm.svg';
import redhatLogo from '../assets/logos/redhat.svg';
import microsoftLogo from '../assets/logos/microsoft.svg';
import blockchainLogo from '../assets/logos/blockchain.svg';
import tableauLogo from '../assets/logos/tableau.svg';
import mulesoftLogo from '../assets/logos/mulesoft.svg';
import aiAllianceLogo from '../assets/logos/ai_alliance.svg';
import googleLogo from '../assets/logos/google.svg';
import emergingTechnologiesLogo from '../assets/logos/emerging_technologies.svg';
import otherTechnologiesLogo from '../assets/logos/other_technologies.svg';

export const TECHNOLOGIES = [
    'IBM',
    'Red hat',
    'Microsoft',
    'Blockchain',
    'Tableau',
    'Mulesoft',
    'Google',
    'AI alliance',
    'Emerging technologies',
    'Other technologies'
];

export const LOGO_MAP = {
    'IBM': ibmLogo,
    'Red hat': redhatLogo,
    'Microsoft': microsoftLogo,
    'Blockchain': blockchainLogo,
    'Tableau': tableauLogo,
    'Mulesoft': mulesoftLogo,
    'Google': googleLogo,
    'AI alliance': aiAllianceLogo,
    'Emerging technologies': emergingTechnologiesLogo,
    'Other technologies': otherTechnologiesLogo
};

export const getTechnologyLogo = (techName) => {
    return LOGO_MAP[techName] || null;
};

// Helper to get formatted options for SearchableSelect
export const getTechnologyOptions = () => {
    return TECHNOLOGIES.map(tech => ({
        value: tech,
        label: tech,
        icon: LOGO_MAP[tech]
    }));
};
