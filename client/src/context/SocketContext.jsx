/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useEffect, useState } from 'react';
import io from 'socket.io-client';
import { useAuth } from './AuthContext';

const SocketContext = createContext();

export const useSocket = () => useContext(SocketContext);

export const SocketProvider = ({ children }) => {
    const [socket, setSocket] = useState(null);
    const { user } = useAuth();
    const userId = user?._id || user?.id;

    useEffect(() => {
        if (!userId) return;

        const fallbackSocketUrl = `${window.location.protocol}//${window.location.hostname}:5000`;
        const socketUrl = import.meta.env.VITE_SOCKET_URL || import.meta.env.VITE_API_URL || fallbackSocketUrl;

        const newSocket = io(socketUrl, {
            transports: ['websocket', 'polling']
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

    return (
        <SocketContext.Provider value={{ socket }}>
            {children}
        </SocketContext.Provider>
    );
};
