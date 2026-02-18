import React from 'react';

const ActivityFeed = ({ logs = [] }) => {
    if (!logs || logs.length === 0) {
        return (
            <div className="text-center py-4">
                <p className="text-sm text-gray-500 italic">No recent activity.</p>
            </div>
        );
    }

    // Sort logs by timestamp (newest first)
    const sortedLogs = [...logs].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    return (
        <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
            {sortedLogs.map((log, index) => (
                <div key={index} className="flex gap-3">
                    <div className="flex-shrink-0 mt-1">
                        <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-800">
                            {log.action}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                            {new Date(log.timestamp).toLocaleString()}
                        </p>
                    </div>
                </div>
            ))}
        </div>
    );
};

export default ActivityFeed;
