/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useState } from 'react';
import io from 'socket.io-client';
import { useAuth } from './AuthContext';
import { SOCKET_URL } from '../config/api';
const SocketContext = createContext();
export const useSocket = () => useContext(SocketContext);
export const SocketProvider = ({
  children
}) => {
  const [socket, setSocket] = useState(null);
  const {
    user
  } = useAuth();
  const userId = user?._id || user?.id;
  useEffect(() => {
    if (!userId) return;
    const newSocket = io(SOCKET_URL, {
      transports: ['polling'],
      upgrade: false,
      reconnectionAttempts: 5,
      timeout: 10000
    });
    newSocket.on('connect', () => {
      setSocket(newSocket);
      newSocket.emit('join_room', userId);
    });
    newSocket.on('disconnect', () => setSocket(null));
    return () => {
      newSocket.off('connect');
      newSocket.off('disconnect');
      newSocket.close();
    };
  }, [userId]);
  return <SocketContext.Provider value={{
    socket
  }}>
            {children}
        </SocketContext.Provider>;
};
