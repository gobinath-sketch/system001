import { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import SalesExecutiveDashboard from './SalesExecutiveDashboard';
import { API_BASE } from '../../config/api';
const SalesManagerDashboard = () => {
  const {
    user
  } = useAuth();
  const {
    socket
  } = useSocket();
  const [viewMode, setViewMode] = useState('self'); // 'self', 'team', or userId
  const [teamMembers, setTeamMembers] = useState([]);
  const fetchTeamMembers = async () => {
    try {
      const token = sessionStorage.getItem('token');
      const headers = {
        Authorization: `Bearer ${token}`
      };
      const teamRes = await axios.get(`${API_BASE}/api/dashboard/manager/team-members`, {
        headers
      });
      setTeamMembers(teamRes.data || []);
    } catch (err) {
      console.error('Error fetching team members:', err);
    }
  };
  useEffect(() => {
    fetchTeamMembers();
  }, []);
  useEffect(() => {
    if (!socket) return;
    const handleEntityUpdated = event => {
      if (event?.entity === 'user') {
        fetchTeamMembers();
      }
    };
    socket.on('entity_updated', handleEntityUpdated);
    return () => socket.off('entity_updated', handleEntityUpdated);
  }, [socket]);

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
  return <SalesExecutiveDashboard user={user} customUserId={getCustomUserId()} showViewFilter={true} viewMode={viewMode} setViewMode={setViewMode} teamMembers={teamMembers} />;
};
export default SalesManagerDashboard;