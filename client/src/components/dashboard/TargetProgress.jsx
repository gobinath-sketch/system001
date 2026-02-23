import { useState, useEffect } from 'react';
import axios from 'axios';
import { Target, TrendingUp, AlertTriangle } from 'lucide-react';
import { useSocket } from '../../context/SocketContext';
import { API_BASE } from '../../config/api';
const TargetProgress = ({
  userId
}) => {
  const {
    socket
  } = useSocket();
  const [timeline, setTimeline] = useState('Yearly');
  const [data, setData] = useState({
    target: 0,
    achieved: 0,
    percentage: 0
  });
  const [loading, setLoading] = useState(true);
  const fetchData = async () => {
    try {
      const token = sessionStorage.getItem('token');
      const res = await axios.get(`${API_BASE}/api/dashboard/performance/${userId}?timeline=${timeline}`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      setData(res.data);
      setLoading(false);
    } catch (err) {
      console.error("Error fetching target data:", err);
      setLoading(false);
    }
  };
  useEffect(() => {
    if (userId) {
      fetchData();
    } else {
      console.warn("TargetProgress: No userId provided");
      setLoading(false);
    }
  }, [userId, timeline]);
  useEffect(() => {
    if (!socket || !userId) return;
    const handleEntityUpdated = event => {
      if (['user', 'opportunity'].includes(event?.entity)) {
        fetchData();
      }
    };
    socket.on('entity_updated', handleEntityUpdated);
    return () => socket.off('entity_updated', handleEntityUpdated);
  }, [socket, userId, timeline]);
  if (loading) return <div className="animate-pulse h-32 bg-gray-100 rounded-lg"></div>;
  const getColor = pct => {
    if (pct >= 100) return 'bg-green-500';
    if (pct >= 50) return 'bg-brand-blue';
    return 'bg-blue-400'; // Softer blue for low progress instead of red
  };
  return <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold text-gray-800 flex items-center">
                    <Target className="mr-2 text-brand-blue" size={20} />
                    Target Progress
                </h3>
                <select value={timeline} onChange={e => setTimeline(e.target.value)} className="text-sm border-gray-300 border rounded-md px-2 py-1 focus:outline-none focus:border-brand-blue">
                    <option value="Yearly">Yearly</option>
                    <option value="Half-Yearly">Half-Yearly</option>
                    <option value="Quarterly">Quarterly</option>
                </select>
            </div>

            <div className="mb-2 flex justify-between text-sm text-gray-600">
                <span>Achieved: <strong>${data.achieved.toLocaleString()}</strong></span>
                <span>Target: <strong>${data.target.toLocaleString()}</strong></span>
            </div>

            <div className="w-full bg-gray-200 rounded-full h-4 mb-4 overflow-hidden relative">
                <div className={`${getColor(data.percentage)} h-4 rounded-full transition-all duration-1000`} style={{
        width: `${Math.min(data.percentage, 100)}%`
      }}></div>
                {data.percentage > 100 && <div className="absolute top-0 right-0 h-4 w-1 bg-white animate-pulse" title="Overachieved!"></div>}
            </div>

            <div className="flex justify-between items-center">
                <div className="text-sm font-medium">
                    {data.percentage.toFixed(1)}% Achieved
                </div>
                {data.percentage >= 100 && <div className="text-xs font-bold text-green-600 flex items-center">
                        <TrendingUp size={14} className="mr-1" />
                        Target Met!
                    </div>}
                {data.percentage < 100 && <div className="text-xs text-red-500 flex items-center">
                        <AlertTriangle size={14} className="mr-1" />
                        ${(data.target - data.achieved).toLocaleString()} remaining
                    </div>}
            </div>
        </div>;
};
export default TargetProgress;