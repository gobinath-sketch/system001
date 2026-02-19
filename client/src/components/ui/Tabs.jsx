import { useState } from 'react';
import PropTypes from 'prop-types';
const Tabs = ({
  tabs,
  defaultTab,
  activeTab: controlledActiveTab,
  onChange,
  className = ''
}) => {
  const [internalActiveTab, setInternalActiveTab] = useState(defaultTab || tabs[0]?.id);

  // Use controlled prop if available, otherwise internal state
  const activeTab = controlledActiveTab !== undefined ? controlledActiveTab : internalActiveTab;
  const handleTabClick = tabId => {
    if (controlledActiveTab === undefined) {
      setInternalActiveTab(tabId);
    }
    if (onChange) {
      onChange(tabId);
    }
  };
  return <div className={`tabs-container ${className}`}>
            {/* Tab Headers */}
            <div className="flex space-x-1 border-b-2 border-gray-200 mb-6">
                {tabs.map(tab => <button key={tab.id} onClick={() => handleTabClick(tab.id)} className={`
              px-6 py-3 font-medium transition-all duration-200 relative
              ${activeTab === tab.id ? 'text-primary-blue border-b-4 border-accent-yellow -mb-0.5' : 'text-text-secondary hover:text-primary-blue hover:bg-gray-50'}
            `}>
                        {tab.icon && <tab.icon className="inline-block mr-2" size={18} />}
                        {tab.label}
                    </button>)}
            </div>

            {/* Tab Content */}
            <div className="tab-content">
                {tabs.map(tab => <div key={tab.id} className={activeTab === tab.id ? 'block' : 'hidden'}>
                        {tab.content}
                    </div>)}
            </div>
        </div>;
};
Tabs.propTypes = {
  tabs: PropTypes.arrayOf(PropTypes.shape({
    id: PropTypes.string.isRequired,
    label: PropTypes.string.isRequired,
    icon: PropTypes.elementType,
    content: PropTypes.node.isRequired
  })).isRequired,
  defaultTab: PropTypes.string,
  onChange: PropTypes.func,
  className: PropTypes.string
};
export default Tabs;