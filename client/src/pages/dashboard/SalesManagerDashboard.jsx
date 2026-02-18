import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import SalesExecutiveDashboard from './SalesExecutiveDashboard';

const SalesManagerDashboard = () => {
    const { user } = useAuth();
    const [viewMode, setViewMode] = useState('self'); // 'self', 'team', or userId
    const [teamMembers, setTeamMembers] = useState([]);

    useEffect(() => {
        const fetchTeamMembers = async () => {
            try {
                const token = localStorage.getItem('token');
                const headers = { Authorization: `Bearer ${token}` };
                const teamRes = await axios.get('http://localhost:5000/api/dashboard/manager/team-members', { headers });
                setTeamMembers(teamRes.data || []);
            } catch (err) {
                console.error('Error fetching team members:', err);
            }
        };
        fetchTeamMembers();
    }, []);

    // Determine customUserId based on viewMode
    const getCustomUserId = () => {
        if (viewMode === 'self') {
            return user.id; // Only Sales Manager's own opportunities
        } else if (viewMode === 'team') {
            return null; // No userId = default behavior (team data for managers)
        } else {
            return viewMode; // Specific team member's ID
        }
    };

    return (
        <SalesExecutiveDashboard
            user={user}
            customUserId={getCustomUserId()}
            showViewFilter={true}
            viewMode={viewMode}
            setViewMode={setViewMode}
            teamMembers={teamMembers}
        />
    );
};

export default SalesManagerDashboard;
