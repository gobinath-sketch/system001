import React from 'react';
import PropTypes from 'prop-types';
import DocumentManager from '../DocumentManager';

const DocumentsTab = ({ opportunityId, editMode }) => {
    return (
        <div className="space-y-6">
            {/* Document Manager Component */}
            <DocumentManager opportunityId={opportunityId} editMode={editMode} />
        </div>
    );
};

DocumentsTab.propTypes = {
    opportunityId: PropTypes.string.isRequired,
    editMode: PropTypes.bool
};

export default DocumentsTab;
