import React from 'react';

// A simple Bar Chart implementation using HTML/CSS/Divs to avoid heavy chart.js dependency if not already present.
// If user has chart.js, we could use that, but simple CSS bars work well for this requirement.

const PerformanceChart = ({ teamData, timeline }) => {
    // teamData expected: [{ name: 'John', target: 50000, achieved: 45000 }, ...]

    if (!teamData || teamData.length === 0) return <div className="text-gray-500 text-center py-4">No performance data available</div>;

    const maxVal = Math.max(...teamData.map(d => Math.max(d.target, d.achieved)), 1);

    return (
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
            <h3 className="text-lg font-bold text-gray-800 mb-4">Team Performance ({timeline})</h3>

            <div className="space-y-6">
                {teamData.map((member, idx) => (
                    <div key={idx}>
                        <div className="flex justify-between text-sm mb-1">
                            <span className="font-semibold text-gray-700">{member.name}</span>
                            <span className="text-gray-500">
                                ${member.achieved.toLocaleString()} / ${member.target.toLocaleString()}
                            </span>
                        </div>

                        {/* Bars container */}
                        <div className="h-6 w-full bg-gray-100 rounded-lg relative overflow-hidden flex">
                            {/* Achieved Bar */}
                            <div
                                className="h-full bg-blue-500 absolute top-0 left-0 z-10 rounded-l-lg transition-all"
                                style={{ width: `${(member.achieved / maxVal) * 100}%` }}
                                title={`Achieved: $${member.achieved}`}
                            ></div>

                            {/* Target Marker - if we want a line, or just a second bar behind? 
                                Stacked bar requested. Let's do Target as a ghost bar or marker.
                                Actually sidebar requirement says "Bar chart / stacked bar chart". 
                                Let's show Target as a gray/light-blue background or a separate thin line?
                                Standard "Target vs Actual" is often bullet chart or side-by-side. 
                                Let's try overlapping: Target is a thin line marker, or background bar.
                                Let's make Target a lighter blue bar behind, and Achieved dark blue in front.
                            */}
                            <div
                                className="h-full bg-blue-200 absolute top-0 left-0 rounded-lg"
                                style={{ width: `${(member.target / maxVal) * 100}%` }}
                                title={`Target: $${member.target}`}
                            ></div>
                        </div>
                        {member.achieved > member.target && (
                            <div className="text-xs text-green-600 font-bold mt-1 text-right">
                                +${(member.achieved - member.target).toLocaleString()} Over
                            </div>
                        )}
                    </div>
                ))}
            </div>

            <div className="flex justify-end items-center space-x-4 mt-4 text-xs text-gray-500">
                <div className="flex items-center"><div className="w-3 h-3 bg-blue-500 mr-1 rounded"></div> Achieved</div>
                <div className="flex items-center"><div className="w-3 h-3 bg-blue-200 mr-1 rounded"></div> Target</div>
            </div>
        </div>
    );
};

export default PerformanceChart;
