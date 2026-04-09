import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_BASE } from '../config/api';
import { useAuth } from '../context/AuthContext';
import { getDefaultRouteForRole } from '../utils/navigation';

const OAuthCallback = () => {
  const navigate = useNavigate();
  const { setUserFromOAuth } = useAuth();
  const [status, setStatus] = useState('Signing you in...');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const error = params.get('error');
    if (error === 'pending_admin_approval') {
      setStatus('Not authenticated!!! Sent for admin approval');
      return;
    }

    const token = params.get('token');
    if (!token) {
      setStatus('Missing token. Please try Outlook login again.');
      return;
    }

    sessionStorage.setItem('token', token);

    const loadUser = async () => {
      try {
        const resp = await fetch(`${API_BASE}/api/auth/me`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!resp.ok) {
          throw new Error('Failed to fetch user');
        }
        const data = await resp.json();
        const user = data.user;
        setUserFromOAuth(user);
        navigate(getDefaultRouteForRole(user.role), { replace: true });
      } catch (err) {
        setStatus('Login failed. Please try again.');
      }
    };

    loadUser();
  }, [navigate, setUserFromOAuth]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 text-gray-800">
      <div className="bg-white rounded-xl shadow-lg px-6 py-4 text-sm">
        {status}
      </div>
    </div>
  );
};

export default OAuthCallback;
