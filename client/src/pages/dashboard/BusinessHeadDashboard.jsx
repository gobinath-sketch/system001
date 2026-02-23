import { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import SalesExecutiveDashboard from './SalesExecutiveDashboard';
import { API_BASE } from '../../config/api';
const BusinessHeadDashboard = () => {
  const {
    user
  } = useAuth();
  const {
    socket
  } = useSocket();
  const [viewMode, setViewMode] = useState('self'); // 'self', managerId, or executiveId
  const [salesManagers, setSalesManagers] = useState([]);
  const [salesExecutives, setSalesExecutives] = useState([]);
  const [loading, setLoading] = useState(true);
  const fetchTeamStructure = async () => {
    try {
      const token = sessionStorage.getItem('token');
      const response = await axios.get(`${API_BASE}/api/dashboard/business-head/team-structure`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      setSalesManagers(response.data.salesManagers);
      setSalesExecutives(response.data.salesExecutives);
      setLoading(false);
    } catch (err) {
      console.error('Error fetching team structure:', err);
      setLoading(false);
    }
  };
  useEffect(() => {
    fetchTeamStructure();
  }, []);
  useEffect(() => {
    if (!socket) return;
    const handleEntityUpdated = event => {
      if (['user', 'opportunity', 'client'].includes(event?.entity)) {
        fetchTeamStructure();
      }
    };
    socket.on('entity_updated', handleEntityUpdated);
    return () => socket.off('entity_updated', handleEntityUpdated);
  }, [socket]);
  const getCustomUserId = () => {
    if (viewMode === 'self') {
      return user.id; // Business Head's own data
    } else {
      return viewMode; // Manager or Executive ID
    }
  };
  if (loading) {
    return <div className="flex items-center justify-center h-screen">
                <div className="text-xl font-semibold text-gray-600">Loading...</div>
            </div>;
  }
  return <SalesExecutiveDashboard user={user} customUserId={getCustomUserId()} showViewFilter={true} viewMode={viewMode} setViewMode={setViewMode} teamMembers={[...salesManagers, ...salesExecutives]} salesManagers={salesManagers} salesExecutives={salesExecutives} isBusinessHead={true} onRefreshTeam={fetchTeamStructure} />;
};
export default BusinessHeadDashboard;