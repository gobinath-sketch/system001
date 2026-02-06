import React from 'react';
import PropTypes from 'prop-types';
import Card from '../../ui/Card';

const ScopeTab = ({ opportunity, editMode, canEditField, handleUpdate }) => {
    const typeSpecificDetails = opportunity.typeSpecificDetails || {};

    // Filter out certain fields
    const filteredDetails = Object.entries(typeSpecificDetails)
        .filter(([key]) => key !== 'batchSize' && key !== 'voucherRegions');

    return (
        <Card>
            <h3 className="text-lg font-bold text-primary-blue mb-4">Scope of Work - Type Specific Details</h3>

            {filteredDetails.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {filteredDetails.map(([key, value]) => (
                        <div key={key}>
                            <label className="block text-sm font-medium text-text-secondary mb-1 capitalize">
                                {key.replace(/([A-Z])/g, ' $1').trim()}
                            </label>
                            {canEditField('scope') && editMode ? (
                                <input
                                    type="text"
                                    value={value || ''}
                                    onChange={(e) => {
                                        const newDetails = { ...opportunity.typeSpecificDetails, [key]: e.target.value };
                                        handleUpdate('typeSpecificDetails', null, newDetails);
                                    }}
                                    className="w-full border border-gray-300 p-2 rounded-lg focus:ring-2 focus:ring-primary-blue focus:border-transparent"
                                />
                            ) : (
                                <p className="text-text-primary font-medium">{value?.toString() || 'N/A'}</p>
                            )}
                        </div>
                    ))}
                </div>
            ) : (
                <div className="text-center py-8">
                    <p className="text-text-secondary">No type-specific details available for this opportunity.</p>
                </div>
            )}
        </Card>
    );
};

ScopeTab.propTypes = {
    opportunity: PropTypes.object.isRequired,
    editMode: PropTypes.bool.isRequired,
    canEditField: PropTypes.func.isRequired,
    handleUpdate: PropTypes.func.isRequired
};

export default ScopeTab;
