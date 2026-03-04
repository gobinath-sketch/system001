import { useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import {
  Send, Paperclip, X, Search, Download, PanelLeft, Reply, Pencil, Trash2, Copy, Forward
} from 'lucide-react';
import { API_BASE, API_ENDPOINTS, uploadUrl } from '../../config/api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useSocket } from '../../context/SocketContext';
import chatIcon from '../../assets/chat-icon.svg';

const formatTime = (value) => {
  if (!value) return '';
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return '';
  return dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const getUserId = (value) => {
  if (!value) return '';
  if (typeof value === 'string') return value;
  return value._id || value.id || '';
};

const getInitials = (name = '') => {
  return String(name)
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((chunk) => chunk[0]?.toUpperCase() || '')
    .join('') || 'U';
};

const getLastPreview = (message) => {
  if (!message) return 'No messages yet';
  if (message.text) return message.text;
  if (message.attachment) return 'Attachment shared';
  return 'No messages yet';
};

const sortUsersByLastMessage = (list = []) => {
  return [...list].sort((a, b) => {
    const aTs = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
    const bTs = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
    if (aTs !== bTs) return bTs - aTs;
    return String(a.name || '').localeCompare(String(b.name || ''));
  });
};

const defaultUploadConfig = {
  enabled: true,
  maxFileSizeBytes: 500 * 1024 * 1024,
  singleUploadLimitBytes: 15 * 1024 * 1024,
  chunkSizeBytes: 5 * 1024 * 1024
};

const formatBytes = (value) => {
  const size = Number(value || 0);
  if (size <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const idx = Math.min(Math.floor(Math.log(size) / Math.log(1024)), units.length - 1);
  const amount = size / (1024 ** idx);
  return `${amount.toFixed(amount >= 100 || idx === 0 ? 0 : 1)} ${units[idx]}`;
};

const getAttachmentHref = (attachment) => {
  if (!attachment) return '';
  if (attachment.url) return attachment.url;
  if (attachment.path) return uploadUrl(attachment.path);
  return '';
};

const deletedMessageLabel = 'This message was deleted';

const toReplyPreview = (msg) => {
  if (!msg) return '';
  if (msg.deletedForEveryoneAt) return deletedMessageLabel;
  if (msg.text) return msg.text;
  if (msg.attachment?.originalName) return msg.attachment.originalName;
  if (msg.attachment) return 'Attachment';
  return '';
};

const TypingDots = () => (
  <div className="inline-flex items-center gap-1 px-1 py-1">
    <span className="h-1.5 w-1.5 rounded-full bg-slate-500 animate-bounce [animation-delay:0ms]" />
    <span className="h-1.5 w-1.5 rounded-full bg-slate-500 animate-bounce [animation-delay:120ms]" />
    <span className="h-1.5 w-1.5 rounded-full bg-slate-500 animate-bounce [animation-delay:240ms]" />
  </div>
);

const Avatar = ({ name, avatarDataUrl, sizeClass = 'h-10 w-10' }) => {
  if (avatarDataUrl) {
    return (
      <img
        src={avatarDataUrl}
        alt={name || 'User'}
        className={`${sizeClass} rounded-full object-cover border border-slate-300/90 shrink-0 shadow-sm`}
      />
    );
  }
  return (
    <div className={`${sizeClass} rounded-full bg-gradient-to-br from-slate-200 to-blue-100 text-slate-700 font-semibold text-xs inline-flex items-center justify-center border border-slate-300/90 shrink-0`}>
      {getInitials(name)}
    </div>
  );
};

const InAppChatWidget = () => {
  const { user } = useAuth();
  const { addToast } = useToast();
  const { socket } = useSocket();
  const [isOpen, setIsOpen] = useState(false);
  const [loadingConversations, setLoadingConversations] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [users, setUsers] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [messages, setMessages] = useState([]);
  const [draftText, setDraftText] = useState('');
  const [query, setQuery] = useState('');
  const [pendingFile, setPendingFile] = useState(null);
  const [uploadConfig, setUploadConfig] = useState(defaultUploadConfig);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isDragOver, setIsDragOver] = useState(false);
  const [dragDepth, setDragDepth] = useState(0);
  const [iconPosition, setIconPosition] = useState({ x: null, y: null });
  const [iconDragging, setIconDragging] = useState(false);
  const [panelPosition, setPanelPosition] = useState({ x: null, y: null });
  const [panelDragging, setPanelDragging] = useState(false);
  const [isMobileView, setIsMobileView] = useState(() => (typeof window !== 'undefined' ? window.innerWidth < 640 : false));
  const [mobileUsersOpen, setMobileUsersOpen] = useState(false);
  const [actionMessageId, setActionMessageId] = useState('');
  const [actionMenuPos, setActionMenuPos] = useState({ x: 0, y: 0 });
  const [replyTo, setReplyTo] = useState(null);
  const [editingMessageId, setEditingMessageId] = useState('');
  const [editText, setEditText] = useState('');
  const [forwardMessage, setForwardMessage] = useState(null);
  const [swipeOffsets, setSwipeOffsets] = useState({});
  const [typingByUser, setTypingByUser] = useState({});
  const fileInputRef = useRef(null);
  const messagesEndRef = useRef(null);
  const actionMenuRef = useRef(null);
  const swipeStartRef = useRef({ id: '', x: 0, y: 0, tracking: false });
  const longPressTimerRef = useRef(null);
  const longPressStateRef = useRef({
    id: '',
    fired: false,
    startX: 0,
    startY: 0
  });
  const dragStartRef = useRef({ startX: 0, startY: 0, baseX: 0, baseY: 0, moved: false });
  const panelDragRef = useRef({ startX: 0, startY: 0, baseX: 0, baseY: 0 });
  const typingStopTimerRef = useRef(null);
  const typingStateRef = useRef({ toUserId: '', isTyping: false });

  const currentUserId = user?._id || user?.id || '';

  const authConfig = useMemo(() => {
    const token = sessionStorage.getItem('token');
    return {
      headers: {
        Authorization: `Bearer ${token}`
      }
    };
  }, []);

  const unreadTotal = useMemo(
    () => conversations.reduce((acc, row) => acc + Number(row.unreadCount || 0), 0),
    [conversations]
  );

  const selectedUser = useMemo(() => users.find((u) => u._id === selectedUserId) || null, [users, selectedUserId]);

  const filteredUsers = useMemo(() => {
    const lowered = query.trim().toLowerCase();
    if (!lowered) return users;
    return users.filter((u) => {
      const haystack = `${u.name || ''} ${u.role || ''}`.toLowerCase();
      return haystack.includes(lowered);
    });
  }, [users, query]);

  const actionTargetMessage = useMemo(
    () => messages.find((msg) => msg._id === actionMessageId) || null,
    [messages, actionMessageId]
  );

  const applyMessageUpdate = (updated) => {
    if (!updated?._id) return;
    setMessages((prev) => prev.map((msg) => (msg._id === updated._id ? { ...msg, ...updated } : msg)));
    setUsers((prev) => {
      const otherId = getUserId(updated.sender) === currentUserId ? getUserId(updated.receiver) : getUserId(updated.sender);
      if (!otherId) return prev;
      return prev.map((u) => {
        if (u._id !== otherId) return u;
        if (u.lastMessage?._id !== updated._id) return u;
        return { ...u, lastMessage: { ...u.lastMessage, ...updated } };
      });
    });
    setConversations((prev) => prev.map((row) => {
      if (!row?.lastMessage?._id || row.lastMessage._id !== updated._id) return row;
      return { ...row, lastMessage: { ...row.lastMessage, ...updated } };
    }));
  };

  const removeMessageLocally = (messageId) => {
    setMessages((prev) => prev.filter((msg) => msg._id !== messageId));
  };

  const scrollToBottom = () => {
    window.requestAnimationFrame(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    });
  };

  const refreshUsersAndConversations = async (options = {}) => {
    const silent = Boolean(options.silent);
    if (!silent) setLoadingConversations(true);
    try {
      const [usersRes, convoRes] = await Promise.all([
        axios.get(`${API_BASE}${API_ENDPOINTS.chat.users}`, authConfig),
        axios.get(`${API_BASE}${API_ENDPOINTS.chat.conversations}`, authConfig)
      ]);

      const usersList = Array.isArray(usersRes.data) ? usersRes.data : [];
      const convoList = Array.isArray(convoRes.data) ? convoRes.data : [];
      setConversations(convoList);

      const convoUserMap = new Map(
        convoList
          .map((row) => [getUserId(row.user), row])
          .filter(([id]) => Boolean(id))
      );
      const mergedUsers = sortUsersByLastMessage(
        usersList
        .map((userItem) => ({
          ...userItem,
          unreadCount: convoUserMap.get(userItem._id)?.unreadCount || 0,
          lastMessageAt:
            convoUserMap.get(userItem._id)?.lastMessage?.createdAt
            || convoUserMap.get(userItem._id)?.lastMessageAt
            || null,
          lastMessage: convoUserMap.get(userItem._id)?.lastMessage || null
        }))
      );

      setUsers(mergedUsers);
      if (!selectedUserId && mergedUsers.length > 0) {
        setSelectedUserId(mergedUsers[0]._id);
      }
    } catch (err) {
      console.error('Failed to load chat bootstrap data:', err);
      addToast('Failed to load chat users', 'error');
    } finally {
      if (!silent) setLoadingConversations(false);
    }
  };

  const refreshUnreadConversations = async () => {
    try {
      const convoRes = await axios.get(`${API_BASE}${API_ENDPOINTS.chat.conversations}`, authConfig);
      const convoList = Array.isArray(convoRes.data) ? convoRes.data : [];
      setConversations(convoList);
    } catch (err) {
      // Silent fallback for badge sync
      console.error('Failed to refresh unread conversations:', err);
    }
  };

  const loadMessages = async (otherUserId, options = {}) => {
    const silent = Boolean(options.silent);
    const autoScroll = options.autoScroll !== false;
    if (!otherUserId) return;
    if (!silent) setLoadingMessages(true);
    try {
      const response = await axios.get(`${API_BASE}${API_ENDPOINTS.chat.messagesByUser(otherUserId)}`, authConfig);
      const nextMessages = Array.isArray(response.data?.messages) ? response.data.messages : [];
      setMessages((prev) => {
        const sameLength = prev.length === nextMessages.length;
        const sameLastId = sameLength ? prev[prev.length - 1]?._id === nextMessages[nextMessages.length - 1]?._id : false;
        if (sameLength && sameLastId) return prev;
        if (autoScroll) scrollToBottom();
        return nextMessages;
      });
    } catch (err) {
      console.error('Failed to load chat messages:', err);
      addToast('Failed to load messages', 'error');
    } finally {
      if (!silent) setLoadingMessages(false);
    }
  };

  const markConversationRead = async (otherUserId) => {
    if (!otherUserId) return;
    try {
      await axios.post(`${API_BASE}${API_ENDPOINTS.chat.markConversationRead(otherUserId)}`, {}, authConfig);
      setUsers((prev) => prev.map((u) => (u._id === otherUserId ? { ...u, unreadCount: 0 } : u)));
      setConversations((prev) => prev.map((row) => (row.user?._id === otherUserId ? { ...row, unreadCount: 0 } : row)));
      setMessages((prev) => prev.map((msg) => {
        const fromUser = getUserId(msg.sender);
        if (fromUser === otherUserId && !msg.readAt) {
          return { ...msg, readAt: new Date().toISOString() };
        }
        return msg;
      }));
    } catch (err) {
      console.error('Failed to mark messages as read:', err);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    refreshUsersAndConversations();
    axios.get(`${API_BASE}${API_ENDPOINTS.chat.uploadConfig}`, authConfig)
      .then((res) => {
        if (res?.data && typeof res.data === 'object') {
          setUploadConfig({
            enabled: Boolean(res.data.enabled),
            maxFileSizeBytes: Number(res.data.maxFileSizeBytes || defaultUploadConfig.maxFileSizeBytes),
            singleUploadLimitBytes: Number(res.data.singleUploadLimitBytes || defaultUploadConfig.singleUploadLimitBytes),
            chunkSizeBytes: Number(res.data.chunkSizeBytes || defaultUploadConfig.chunkSizeBytes)
          });
        }
      })
      .catch(() => {
        setUploadConfig(defaultUploadConfig);
      });
  }, [isOpen]);

  useEffect(() => {
    if (!selectedUserId || !isOpen) return;
    loadMessages(selectedUserId).then(() => markConversationRead(selectedUserId));
  }, [selectedUserId, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const timer = setInterval(() => {
      refreshUsersAndConversations({ silent: true });
      if (selectedUserId) {
        loadMessages(selectedUserId, { silent: true, autoScroll: true }).then(() => markConversationRead(selectedUserId));
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [isOpen, selectedUserId]);

  useEffect(() => {
    if (isOpen) return;
    const timer = setInterval(() => {
      refreshUnreadConversations();
    }, 3000);
    return () => clearInterval(timer);
  }, [isOpen]);

  useEffect(() => {
    if (!socket || !currentUserId) return;

    const handleIncomingMessage = (message) => {
      const senderId = getUserId(message.sender);
      const receiverId = getUserId(message.receiver);
      if (senderId !== currentUserId && receiverId !== currentUserId) return;

      const otherId = senderId === currentUserId ? receiverId : senderId;
      if (!otherId) return;
      const fallbackUser = senderId === currentUserId ? message.receiver : message.sender;

      setUsers((prev) => {
        const existing = prev.find((u) => u._id === otherId);
        const base = existing || {
          _id: otherId,
          name: fallbackUser?.name || 'User',
          role: fallbackUser?.role || '',
          avatarDataUrl: fallbackUser?.avatarDataUrl || '',
          unreadCount: 0
        };
        const shouldIncrementUnread = senderId !== currentUserId && (!isOpen || selectedUserId !== otherId);
        const unreadCount = shouldIncrementUnread ? Number(base.unreadCount || 0) + 1 : 0;
        const updated = {
          ...base,
          name: fallbackUser?.name || base.name,
          role: fallbackUser?.role || base.role,
          avatarDataUrl: fallbackUser?.avatarDataUrl || base.avatarDataUrl || '',
          unreadCount,
          lastMessageAt: message.createdAt,
          lastMessage: message
        };
        const withoutCurrent = prev.filter((u) => u._id !== otherId);
        return sortUsersByLastMessage([updated, ...withoutCurrent]);
      });

      setConversations((prev) => {
        const existing = prev.find((row) => row.user?._id === otherId);
        const row = existing || { user: fallbackUser, unreadCount: 0, lastMessage: null };
        const shouldIncrementUnread = senderId !== currentUserId && (!isOpen || selectedUserId !== otherId);
        const unreadCount = shouldIncrementUnread ? Number(row.unreadCount || 0) + 1 : 0;
        const updated = {
          ...row,
          user: {
            ...(row.user || {}),
            _id: otherId,
            name: fallbackUser?.name || row.user?.name || 'User',
            role: fallbackUser?.role || row.user?.role || '',
            avatarDataUrl: fallbackUser?.avatarDataUrl || row.user?.avatarDataUrl || ''
          },
          unreadCount,
          lastMessage: message
        };
        const remaining = prev.filter((item) => item.user?._id !== otherId);
        return [updated, ...remaining];
      });

      if (selectedUserId === otherId) {
        setMessages((prev) => (prev.some((item) => item._id === message._id) ? prev : [...prev, message]));
        scrollToBottom();
        if (senderId !== currentUserId) {
          markConversationRead(otherId);
        }
      }
    };

    const handleRead = ({ by }) => {
      if (String(by) !== String(selectedUserId)) return;
      setMessages((prev) => prev.map((msg) => (getUserId(msg.sender) === currentUserId ? { ...msg, readAt: msg.readAt || new Date().toISOString() } : msg)));
    };

    const handleMessageUpdated = (updated) => {
      const senderId = getUserId(updated?.sender);
      const receiverId = getUserId(updated?.receiver);
      if (senderId !== currentUserId && receiverId !== currentUserId) return;
      applyMessageUpdate(updated);
    };

    const handleMessageHidden = ({ messageId, userId }) => {
      if (!messageId || String(userId) !== String(currentUserId)) return;
      removeMessageLocally(messageId);
    };

    const handleTyping = ({ fromUserId, isTyping }) => {
      if (!fromUserId || String(fromUserId) === String(currentUserId)) return;
      setTypingByUser((prev) => ({ ...prev, [String(fromUserId)]: Boolean(isTyping) }));
    };

    const handleEntityUpdated = (payload) => {
      if (payload?.entity === 'user' && isOpen) {
        refreshUsersAndConversations();
      }
    };

    socket.on('chat_message:new', handleIncomingMessage);
    socket.on('chat_message:read', handleRead);
    socket.on('chat_message:updated', handleMessageUpdated);
    socket.on('chat_message:hidden', handleMessageHidden);
    socket.on('chat_typing', handleTyping);
    socket.on('entity_updated', handleEntityUpdated);
    return () => {
      socket.off('chat_message:new', handleIncomingMessage);
      socket.off('chat_message:read', handleRead);
      socket.off('chat_message:updated', handleMessageUpdated);
      socket.off('chat_message:hidden', handleMessageHidden);
      socket.off('chat_typing', handleTyping);
      socket.off('entity_updated', handleEntityUpdated);
    };
  }, [socket, currentUserId, selectedUserId, isOpen]);

  useEffect(() => {
    if (!socket || !currentUserId || !selectedUserId || !isOpen) return;
    const nextText = editingMessageId ? editText : draftText;
    const hasText = Boolean(String(nextText || '').trim());

    if (hasText) {
      if (!typingStateRef.current.isTyping || typingStateRef.current.toUserId !== selectedUserId) {
        socket.emit('chat_typing', {
          toUserId: selectedUserId,
          fromUserId: currentUserId,
          isTyping: true
        });
        typingStateRef.current = { toUserId: selectedUserId, isTyping: true };
      }
      if (typingStopTimerRef.current) clearTimeout(typingStopTimerRef.current);
      typingStopTimerRef.current = setTimeout(() => {
        socket.emit('chat_typing', {
          toUserId: selectedUserId,
          fromUserId: currentUserId,
          isTyping: false
        });
        typingStateRef.current = { toUserId: '', isTyping: false };
      }, 1200);
      return;
    }

    if (typingStopTimerRef.current) {
      clearTimeout(typingStopTimerRef.current);
      typingStopTimerRef.current = null;
    }
    if (typingStateRef.current.isTyping && typingStateRef.current.toUserId === selectedUserId) {
      socket.emit('chat_typing', {
        toUserId: selectedUserId,
        fromUserId: currentUserId,
        isTyping: false
      });
      typingStateRef.current = { toUserId: '', isTyping: false };
    }
  }, [draftText, editText, editingMessageId, socket, currentUserId, selectedUserId, isOpen]);

  useEffect(() => {
    if (!actionMessageId) return undefined;
    const onDocClick = (event) => {
      if (!actionMenuRef.current?.contains(event.target)) {
        setActionMessageId('');
      }
    };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('touchstart', onDocClick);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('touchstart', onDocClick);
    };
  }, [actionMessageId]);

  useEffect(() => () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
    }
    if (typingStopTimerRef.current) {
      clearTimeout(typingStopTimerRef.current);
    }
  }, []);

  const onSelectUser = (nextUserId) => {
    if (socket && typingStateRef.current.isTyping && typingStateRef.current.toUserId) {
      socket.emit('chat_typing', {
        toUserId: typingStateRef.current.toUserId,
        fromUserId: currentUserId,
        isTyping: false
      });
      typingStateRef.current = { toUserId: '', isTyping: false };
    }
    setSelectedUserId(nextUserId);
    setMessages([]);
    setDraftText('');
    setPendingFile(null);
    setUploadProgress(0);
    setActionMessageId('');
    setReplyTo(null);
    setEditingMessageId('');
    setEditText('');
    setForwardMessage(null);
    if (isMobileView) setMobileUsersOpen(false);
  };

  const onPickFile = (event) => {
    const selected = event.target.files?.[0] || null;
    setDroppedFile(selected);
  };

  const setDroppedFile = (file) => {
    if (!file) return;
    if (file.size > uploadConfig.maxFileSizeBytes) {
      addToast(`File size must be ${formatBytes(uploadConfig.maxFileSizeBytes)} or less`, 'error');
      return;
    }
    setPendingFile(file);
  };

  const onDragEnter = (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (!selectedUserId) return;
    setDragDepth((prev) => prev + 1);
    setIsDragOver(true);
  };

  const onDragOver = (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (!selectedUserId) return;
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'copy';
    }
    setIsDragOver(true);
  };

  const onDragLeave = (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (!selectedUserId) return;
    setDragDepth((prev) => {
      const next = Math.max(prev - 1, 0);
      if (next === 0) setIsDragOver(false);
      return next;
    });
  };

  const onDrop = (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (!selectedUserId) return;
    setDragDepth(0);
    setIsDragOver(false);
    const file = event.dataTransfer?.files?.[0];
    setDroppedFile(file || null);
  };

  const sendMessage = async () => {
    if (!selectedUserId || sending) return;
    const textValue = draftText.trim();
    if (!textValue && !pendingFile) return;

    const formData = new FormData();
    formData.append('receiverId', selectedUserId);
    if (textValue) formData.append('text', textValue);
    if (pendingFile) formData.append('file', pendingFile);
    if (replyTo?._id) formData.append('replyToMessageId', replyTo._id);
    if (forwardMessage?._id) formData.append('forwardFromMessageId', forwardMessage._id);

    setSending(true);
    setUploadProgress(0);
    if (socket && typingStateRef.current.isTyping && selectedUserId) {
      socket.emit('chat_typing', {
        toUserId: selectedUserId,
        fromUserId: currentUserId,
        isTyping: false
      });
      typingStateRef.current = { toUserId: '', isTyping: false };
    }
    try {
      const token = sessionStorage.getItem('token');
      let created = null;

      const shouldUseChunkedUpload = Boolean(
        pendingFile &&
        uploadConfig.enabled &&
        pendingFile.size > uploadConfig.singleUploadLimitBytes
      );

      if (shouldUseChunkedUpload) {
        const initRes = await axios.post(
          `${API_BASE}${API_ENDPOINTS.chat.initiateUpload}`,
          {
            receiverId: selectedUserId,
            fileName: pendingFile.name,
            fileSize: pendingFile.size,
            mimeType: pendingFile.type || 'application/octet-stream'
          },
          { headers: { Authorization: `Bearer ${token}` } }
        );

        const uploadId = initRes.data?.uploadId;
        const chunkSizeBytes = Number(initRes.data?.chunkSizeBytes || uploadConfig.chunkSizeBytes);
        const totalChunks = Number(initRes.data?.totalChunks || Math.ceil(pendingFile.size / chunkSizeBytes));
        if (!uploadId) throw new Error('Failed to initialize chunk upload');

        for (let i = 0; i < totalChunks; i += 1) {
          const start = i * chunkSizeBytes;
          const end = Math.min(start + chunkSizeBytes, pendingFile.size);
          const chunkBlob = pendingFile.slice(start, end);
          const chunkForm = new FormData();
          chunkForm.append('chunk', chunkBlob, pendingFile.name);
          await axios.post(
            `${API_BASE}${API_ENDPOINTS.chat.uploadChunk(uploadId, i)}`,
            chunkForm,
            {
              headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'multipart/form-data'
              }
            }
          );
          setUploadProgress(Math.round(((i + 1) / totalChunks) * 100));
        }

        const completeRes = await axios.post(
          `${API_BASE}${API_ENDPOINTS.chat.completeUpload(uploadId)}`,
          {
            text: textValue || '',
            replyToMessageId: replyTo?._id || '',
            forwardFromMessageId: forwardMessage?._id || ''
          },
          { headers: { Authorization: `Bearer ${token}` } }
        );
        created = completeRes.data;
      } else {
        const res = await axios.post(`${API_BASE}${API_ENDPOINTS.chat.sendMessage}`, formData, {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'multipart/form-data'
          }
        });
        created = res.data;
      }

      setMessages((prev) => (prev.some((msg) => msg._id === created._id) ? prev : [...prev, created]));
      setDraftText('');
      setPendingFile(null);
      setReplyTo(null);
      setForwardMessage(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      scrollToBottom();
    } catch (err) {
      console.error('Failed to send message:', err);
      addToast(err.response?.data?.message || 'Failed to send message', 'error');
    } finally {
      setSending(false);
      setUploadProgress(0);
    }
  };

  const onMessageKeyDown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      if (editingMessageId) {
        saveEditMessage();
      } else {
        sendMessage();
      }
    }
  };

  const onEditMessage = (msg) => {
    if (!msg || getUserId(msg.sender) !== currentUserId || msg.deletedForEveryoneAt) return;
    setEditingMessageId(msg._id);
    setEditText(msg.text || '');
    setActionMessageId('');
  };

  const saveEditMessage = async () => {
    const nextText = editText.trim();
    if (!editingMessageId || !nextText) return;
    try {
      const res = await axios.patch(
        `${API_BASE}${API_ENDPOINTS.chat.updateMessage(editingMessageId)}`,
        { text: nextText },
        authConfig
      );
      applyMessageUpdate(res.data);
      setEditingMessageId('');
      setEditText('');
    } catch (err) {
      addToast(err.response?.data?.message || 'Failed to edit message', 'error');
    }
  };

  const copyMessage = async (msg) => {
    if (!msg || !msg.text) return;
    try {
      await navigator.clipboard.writeText(msg.text);
      addToast('Message copied', 'success');
    } catch {
      addToast('Copy failed', 'error');
    } finally {
      setActionMessageId('');
    }
  };

  const deleteMessage = async (msg, mode) => {
    if (!msg?._id) return;
    try {
      const res = await axios.delete(
        `${API_BASE}${API_ENDPOINTS.chat.deleteMessage(msg._id)}`,
        {
          ...authConfig,
          data: { mode }
        }
      );
      if (mode === 'me') {
        removeMessageLocally(msg._id);
      } else if (res.data?.message) {
        applyMessageUpdate(res.data.message);
      }
      setActionMessageId('');
      if (replyTo?._id === msg._id) setReplyTo(null);
    } catch (err) {
      addToast(err.response?.data?.message || 'Failed to delete message', 'error');
    }
  };

  const forwardToUser = async (msg, receiverId) => {
    if (!msg?._id || !receiverId) return;
    try {
      await axios.post(
        `${API_BASE}${API_ENDPOINTS.chat.forwardMessage(msg._id)}`,
        { receiverIds: [receiverId] },
        authConfig
      );
      setForwardMessage(null);
      setActionMessageId('');
      addToast('Message forwarded', 'success');
    } catch (err) {
      addToast(err.response?.data?.message || 'Failed to forward message', 'error');
    }
  };

  const startReplyToMessage = (msg) => {
    if (!msg?._id) return;
    setReplyTo(msg);
    setForwardMessage(null);
    setActionMessageId('');
  };

  const onMessageTouchStart = (event, msgId) => {
    if (!msgId) return;
    const t = event.touches?.[0];
    if (!t) return;
    swipeStartRef.current = { id: msgId, x: t.clientX, y: t.clientY, tracking: true };
    longPressStateRef.current = {
      id: msgId,
      fired: false,
      startX: t.clientX,
      startY: t.clientY
    };
    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
    longPressTimerRef.current = window.setTimeout(() => {
      if (longPressStateRef.current.id !== msgId) return;
      longPressStateRef.current.fired = true;
      setActionMessageId(msgId);
      setActionMenuPos({
        x: longPressStateRef.current.startX + 10,
        y: longPressStateRef.current.startY + 10
      });
    }, 600);
  };

  const onMessageTouchMove = (event, msgId) => {
    if (!msgId || swipeStartRef.current.id !== msgId || !swipeStartRef.current.tracking) return;
    const t = event.touches?.[0];
    if (!t) return;
    const dx = t.clientX - swipeStartRef.current.x;
    const dy = t.clientY - swipeStartRef.current.y;
    const lpDx = Math.abs(t.clientX - (longPressStateRef.current.startX || t.clientX));
    const lpDy = Math.abs(t.clientY - (longPressStateRef.current.startY || t.clientY));
    if (lpDx > 10 || lpDy > 10) {
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }
      if (!longPressStateRef.current.fired) {
        longPressStateRef.current.id = '';
      }
    }
    if (Math.abs(dy) > Math.abs(dx) || dx < 0) return;
    const offset = Math.min(dx, 92);
    setSwipeOffsets((prev) => ({ ...prev, [msgId]: offset }));
  };

  const onMessageTouchEnd = (msg) => {
    const msgId = msg?._id;
    if (!msgId) return;
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    if (longPressStateRef.current.id === msgId && longPressStateRef.current.fired) {
      setSwipeOffsets((prev) => ({ ...prev, [msgId]: 0 }));
      swipeStartRef.current = { id: '', x: 0, y: 0, tracking: false };
      longPressStateRef.current = { id: '', fired: false, startX: 0, startY: 0 };
      return;
    }
    const dx = Number(swipeOffsets[msgId] || 0);
    if (dx >= 64) {
      startReplyToMessage(msg);
    }
    setSwipeOffsets((prev) => ({ ...prev, [msgId]: 0 }));
    swipeStartRef.current = { id: '', x: 0, y: 0, tracking: false };
    longPressStateRef.current = { id: '', fired: false, startX: 0, startY: 0 };
  };

  const getActionMenuStyle = () => {
    if (typeof window === 'undefined') return { right: '12px', bottom: '12px' };
    const menuWidth = 210;
    const menuHeight = 300;
    const x = Number(actionMenuPos.x || 0);
    const y = Number(actionMenuPos.y || 0);
    return {
      left: `${Math.max(8, Math.min(x, window.innerWidth - menuWidth - 8))}px`,
      top: `${Math.max(8, Math.min(y, window.innerHeight - menuHeight - 8))}px`
    };
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (iconPosition.x !== null && iconPosition.y !== null) return;
    const defaultX = Math.max(window.innerWidth - 156, 12);
    const defaultY = Math.max(window.innerHeight - 90, 12);
    setIconPosition({ x: defaultX, y: defaultY });
  }, [iconPosition.x, iconPosition.y]);

  const clampIconPosition = (x, y) => {
    const min = 8;
    const maxX = Math.max((window.innerWidth || 0) - 56, min);
    const maxY = Math.max((window.innerHeight || 0) - 56, min);
    return {
      x: Math.min(Math.max(x, min), maxX),
      y: Math.min(Math.max(y, min), maxY)
    };
  };

  const startIconDrag = (startX, startY) => {
    dragStartRef.current = {
      startX,
      startY,
      baseX: iconPosition.x ?? Math.max(window.innerWidth - 156, 12),
      baseY: iconPosition.y ?? Math.max(window.innerHeight - 90, 12),
      moved: false
    };
  };

  const onIconMouseDown = (event) => {
    if (isOpen) return;
    event.preventDefault();
    startIconDrag(event.clientX, event.clientY);

    const handleMove = (moveEvent) => {
      const dx = moveEvent.clientX - dragStartRef.current.startX;
      const dy = moveEvent.clientY - dragStartRef.current.startY;
      if (Math.abs(dx) > 6 || Math.abs(dy) > 6) dragStartRef.current.moved = true;
      if (!dragStartRef.current.moved) return;
      const next = clampIconPosition(dragStartRef.current.baseX + dx, dragStartRef.current.baseY + dy);
      setIconPosition(next);
      setIconDragging(true);
    };

    const handleUp = () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
      setIconDragging(false);
      if (!dragStartRef.current.moved) setIsOpen(true);
    };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
  };

  const onIconTouchStart = (event) => {
    if (isOpen) return;
    if (!event.touches?.[0]) return;
    const touch = event.touches[0];
    startIconDrag(touch.clientX, touch.clientY);

    const handleMove = (moveEvent) => {
      if (!moveEvent.touches?.[0]) return;
      const t = moveEvent.touches[0];
      const dx = t.clientX - dragStartRef.current.startX;
      const dy = t.clientY - dragStartRef.current.startY;
      if (Math.abs(dx) > 6 || Math.abs(dy) > 6) dragStartRef.current.moved = true;
      if (!dragStartRef.current.moved) return;
      const next = clampIconPosition(dragStartRef.current.baseX + dx, dragStartRef.current.baseY + dy);
      setIconPosition(next);
      setIconDragging(true);
    };

    const handleEnd = () => {
      window.removeEventListener('touchmove', handleMove);
      window.removeEventListener('touchend', handleEnd);
      setIconDragging(false);
      if (!dragStartRef.current.moved) setIsOpen(true);
    };

    window.addEventListener('touchmove', handleMove, { passive: false });
    window.addEventListener('touchend', handleEnd);
  };

  const isDesktopViewport = () => !isMobileView;

  const getPanelSize = () => {
    const width = 820;
    const height = Math.min(Math.round((window.innerHeight || 0) * 0.7), 640);
    return { width, height };
  };

  const clampPanelPosition = (x, y) => {
    const { width, height } = getPanelSize();
    const min = 8;
    const maxX = Math.max((window.innerWidth || 0) - width - min, min);
    const maxY = Math.max((window.innerHeight || 0) - height - min, min);
    return {
      x: Math.min(Math.max(x, min), maxX),
      y: Math.min(Math.max(y, min), maxY)
    };
  };

  const getDefaultPanelPosition = () => {
    const { width, height } = getPanelSize();
    return clampPanelPosition(
      (window.innerWidth || 0) - width - 16,
      (window.innerHeight || 0) - height - 16
    );
  };

  const startPanelDrag = (startX, startY) => {
    const base = panelPosition.x !== null && panelPosition.y !== null
      ? panelPosition
      : getDefaultPanelPosition();
    panelDragRef.current = {
      startX,
      startY,
      baseX: base.x,
      baseY: base.y
    };
  };

  const onPanelMouseDown = (event) => {
    if (!isDesktopViewport()) return;
    if (!event.target.closest('[data-chat-drag-handle]')) return;
    if (event.target.closest('button, a, input, textarea')) return;
    event.preventDefault();
    startPanelDrag(event.clientX, event.clientY);
    setPanelDragging(true);

    const handleMove = (moveEvent) => {
      const dx = moveEvent.clientX - panelDragRef.current.startX;
      const dy = moveEvent.clientY - panelDragRef.current.startY;
      const next = clampPanelPosition(panelDragRef.current.baseX + dx, panelDragRef.current.baseY + dy);
      setPanelPosition(next);
    };

    const handleUp = () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
      setPanelDragging(false);
    };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
  };

  const onPanelTouchStart = (event) => {
    if (!isDesktopViewport()) return;
    if (!event.target.closest('[data-chat-drag-handle]')) return;
    if (event.target.closest('button, a, input, textarea')) return;
    if (!event.touches?.[0]) return;
    const touch = event.touches[0];
    startPanelDrag(touch.clientX, touch.clientY);
    setPanelDragging(true);

    const handleMove = (moveEvent) => {
      if (!moveEvent.touches?.[0]) return;
      moveEvent.preventDefault();
      const t = moveEvent.touches[0];
      const dx = t.clientX - panelDragRef.current.startX;
      const dy = t.clientY - panelDragRef.current.startY;
      const next = clampPanelPosition(panelDragRef.current.baseX + dx, panelDragRef.current.baseY + dy);
      setPanelPosition(next);
    };

    const handleEnd = () => {
      window.removeEventListener('touchmove', handleMove);
      window.removeEventListener('touchend', handleEnd);
      setPanelDragging(false);
    };

    window.addEventListener('touchmove', handleMove, { passive: false });
    window.addEventListener('touchend', handleEnd);
  };

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const updateViewportMode = () => {
      setIsMobileView(window.innerWidth < 640);
    };
    updateViewportMode();
    window.addEventListener('resize', updateViewportMode);
    return () => window.removeEventListener('resize', updateViewportMode);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    if (!isMobileView) {
      setMobileUsersOpen(false);
      return;
    }
    if (!selectedUserId) {
      setMobileUsersOpen(true);
    }
  }, [isOpen, isMobileView, selectedUserId]);

  useEffect(() => {
    if (!isOpen || !isDesktopViewport()) return;
    if (panelPosition.x !== null && panelPosition.y !== null) return;
    setPanelPosition(getDefaultPanelPosition());
  }, [isOpen, isMobileView, panelPosition.x, panelPosition.y]);

  useEffect(() => {
    if (!isOpen || panelPosition.x === null || panelPosition.y === null) return;
    const handleResize = () => {
      setPanelPosition((prev) => {
        if (!prev || prev.x === null || prev.y === null) return prev;
        return clampPanelPosition(prev.x, prev.y);
      });
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isOpen, panelPosition.x, panelPosition.y]);

  return (
    <>
      {!isOpen && (
        <button
          type="button"
          onMouseDown={onIconMouseDown}
          onTouchStart={onIconTouchStart}
          className="fixed z-[70] h-[45px] w-[45px] bg-transparent border-0 p-0 inline-flex items-center justify-center cursor-grab active:cursor-grabbing touch-none"
          style={iconPosition.x !== null && iconPosition.y !== null ? { left: `${iconPosition.x}px`, top: `${iconPosition.y}px` } : { right: '92px', bottom: '26px' }}
          aria-label="Open chat"
        >
          <img src={chatIcon} alt="Chat" className="h-[45px] w-[45px] object-contain" />
          {unreadTotal > 0 && (
            <span className="absolute -top-1 -right-1 min-w-6 h-6 px-1 rounded-full bg-red-500 text-white text-xs font-bold inline-flex items-center justify-center">
              {unreadTotal > 99 ? '99+' : unreadTotal}
            </span>
          )}
        </button>
      )}

      {isOpen && (
        <div
          className={`fixed z-[75] h-[72vh] max-h-[660px] rounded-[28px] border border-[#d2dceb] bg-[#ecf2fb]/95 backdrop-blur-xl shadow-[0_30px_70px_rgba(30,41,59,0.24)] overflow-hidden flex ${panelDragging ? 'select-none' : ''} ${isMobileView ? 'left-2 right-2 bottom-2 h-[76vh] max-h-[76vh] rounded-2xl' : 'sm:w-[840px]'} ${!isMobileView && (panelPosition.x === null || panelPosition.y === null || !isDesktopViewport()) ? 'right-4 left-4 sm:left-auto' : ''}`}
          style={panelPosition.x !== null && panelPosition.y !== null && isDesktopViewport() ? { left: `${panelPosition.x}px`, top: `${panelPosition.y}px` } : undefined}
          onMouseDown={onPanelMouseDown}
          onTouchStart={onPanelTouchStart}
          onDragEnter={onDragEnter}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
        >
          {isMobileView && mobileUsersOpen && (
            <button
              type="button"
              aria-label="Close users list"
              className="absolute inset-0 z-20 bg-slate-900/25"
              onClick={() => setMobileUsersOpen(false)}
            />
          )}

          <aside className={`${isMobileView ? `absolute inset-y-0 left-0 z-30 w-[88%] max-w-[320px] min-w-0 border-r border-[#c8d4e6] shadow-[8px_0_24px_rgba(15,23,42,0.22)] transition-transform duration-200 ${mobileUsersOpen ? 'translate-x-0' : '-translate-x-[105%]'}` : 'w-[36%] min-w-[255px] max-w-[310px] border-r'} border-[#c8d4e6] bg-gradient-to-b from-[#dde6f3] via-[#e4ecf7] to-[#ecf2f9] flex flex-col`}>
            <div data-chat-drag-handle className="px-4 py-3 border-b border-[#c8d4e6] bg-[#d2ddee] flex items-center justify-between cursor-move select-none">
              <div>
                <h3 className="text-[16px] font-extrabold text-slate-900 tracking-[0.06em] uppercase">Chat</h3>
              </div>
              {isMobileView && (
                <button
                  type="button"
                  className="h-8 w-8 rounded-lg hover:bg-white/60 text-slate-600 inline-flex items-center justify-center"
                  onClick={() => setMobileUsersOpen(false)}
                  aria-label="Collapse users"
                >
                  <X size={16} />
                </button>
              )}
            </div>
            <div className="p-3 border-b border-[#cbd6e8] bg-transparent">
              <div className="relative">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search users..."
                  className="w-full h-10 pl-9 pr-3 text-sm font-medium border border-[#bfcce1] rounded-xl bg-[#f8fbff] text-slate-800 placeholder:text-slate-500 shadow-inner focus:outline-none focus:ring-2 focus:ring-[#9fb4d6] focus:border-[#9fb4d6]"
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {loadingConversations && users.length === 0 ? (
                <div className="px-4 py-6 text-sm text-slate-500">Loading users...</div>
              ) : filteredUsers.length === 0 ? (
                <div className="px-4 py-6 text-sm text-slate-500">No users found.</div>
              ) : (
                filteredUsers.map((person) => (
                  <button
                    key={person._id}
                    type="button"
                    onClick={() => onSelectUser(person._id)}
                    className={`w-full px-3 py-2.5 text-left rounded-2xl border transition-all duration-150 ${selectedUserId === person._id ? 'bg-[#b8cbe5] border-[#97afcf] shadow-[0_8px_18px_rgba(71,85,105,0.16)]' : 'bg-white/35 border-transparent hover:bg-white/55 hover:border-[#becde4]'}`}
                  >
                    <div className="flex items-start gap-2.5">
                      <Avatar name={person.name} avatarDataUrl={person.avatarDataUrl} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-bold text-slate-900 truncate">{person.name}</p>
                          <span className="text-[11px] font-medium text-slate-600">
                            {person.lastMessageAt ? formatTime(person.lastMessageAt) : ''}
                          </span>
                        </div>
                        <p className="text-[12px] font-medium text-slate-700/90 truncate">{person.role}</p>
                      </div>
                      {Number(person.unreadCount || 0) > 0 && (
                        <span className="mt-1 min-w-5 h-5 px-1 rounded-full bg-rose-500 text-white text-[11px] font-bold inline-flex items-center justify-center shadow-sm">
                          {person.unreadCount}
                        </span>
                      )}
                    </div>
                  </button>
                ))
              )}
            </div>
          </aside>

          <section className="flex-1 flex flex-col min-w-0 bg-[radial-gradient(circle_at_20%_15%,#e9f0fb_0%,#f4f8fd_42%,#edf3fb_100%)] relative overflow-hidden">
            {isDragOver && selectedUserId && (
              <div className="absolute inset-0 z-20 m-3 rounded-2xl border-2 border-dashed border-primary-blue bg-primary-blue/5 pointer-events-none grid place-items-center">
                <div className="rounded-xl bg-white/90 px-4 py-2 text-sm font-medium text-primary-blue shadow">
                  Drop file here to attach
                </div>
              </div>
            )}
            {selectedUser ? (
              <>
                <div data-chat-drag-handle className="h-[58px] px-3 border-b border-[#ccd7e8] flex items-center gap-2 bg-[#edf3fb]/80 backdrop-blur-sm cursor-move select-none">
                  {isMobileView && (
                    <button
                      type="button"
                      onClick={() => setMobileUsersOpen((prev) => !prev)}
                      className="h-9 w-9 rounded-lg border border-[#c4d1e4] bg-white/80 text-slate-700 inline-flex items-center justify-center"
                      aria-label="Toggle users list"
                      title="Users"
                    >
                      <PanelLeft size={16} />
                    </button>
                  )}
                  <div className="inline-flex max-w-[70%] items-center gap-2 rounded-xl border border-[#c4d1e4] bg-white/70 px-2.5 py-1.5">
                    <Avatar name={selectedUser.name} avatarDataUrl={selectedUser.avatarDataUrl} sizeClass="h-8 w-8" />
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-slate-900 truncate">{selectedUser.name}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="ml-auto h-9 w-9 rounded-lg hover:bg-rose-50 inline-flex items-center justify-center text-rose-500 hover:text-rose-600 transition-colors"
                    onClick={() => setIsOpen(false)}
                    aria-label="Close chat"
                    title="Close chat"
                  >
                    <X size={19} />
                  </button>
                </div>

                <div className={`flex-1 overflow-y-auto overflow-x-hidden px-4 py-4 space-y-2 bg-transparent ${isMobileView ? 'pb-2' : ''}`}>
                  {loadingMessages ? (
                    <div className="text-sm text-slate-500">Loading conversation...</div>
                  ) : messages.length === 0 ? (
                    <div className="text-sm text-slate-500">Start the conversation.</div>
                  ) : (
                    messages.map((msg) => {
                      const mine = getUserId(msg.sender) === currentUserId;
                      const isDeleted = Boolean(msg.deletedForEveryoneAt);
                      const swipeOffset = Number(swipeOffsets[msg._id] || 0);
                      return (
                        <div key={msg._id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                          <div className="relative max-w-[88%]">
                            {isMobileView && (
                              <div className={`absolute top-1/2 -translate-y-1/2 ${mine ? '-left-8' : '-right-8'} text-slate-500 transition-opacity ${swipeOffset > 10 ? 'opacity-100' : 'opacity-0'}`}>
                                <Reply size={16} />
                              </div>
                            )}
                            <div
                              className="transition-transform duration-150"
                              style={{ transform: `translateX(${swipeOffset}px)` }}
                              onTouchStart={(event) => onMessageTouchStart(event, msg._id)}
                              onTouchMove={(event) => onMessageTouchMove(event, msg._id)}
                              onTouchEnd={() => onMessageTouchEnd(msg)}
                              onContextMenu={(event) => {
                                event.preventDefault();
                                setActionMessageId(msg._id);
                                setActionMenuPos({ x: event.clientX + 10, y: event.clientY + 10 });
                              }}
                            >
                              <div className={`rounded-2xl px-3.5 py-2.5 shadow-sm ${mine ? 'bg-gradient-to-br from-[#d7e4f5] to-[#c7d8ee] text-slate-800 border border-[#aec3df] rounded-br-md shadow-[0_8px_16px_rgba(148,163,184,0.22)]' : 'bg-white/88 border border-[#c3d0e4] text-slate-800 rounded-bl-md'}`}>
                                {msg.isForwarded ? <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-600 mb-1">Forwarded</p> : null}
                                {msg.replyTo ? (
                                  <div className="mb-2 rounded-lg border border-slate-300/80 bg-white/65 px-2 py-1">
                                    <p className="text-[10px] font-bold text-slate-700">
                                      {getUserId(msg.replyTo.sender) === currentUserId ? 'You' : (msg.replyTo.sender?.name || 'Message')}
                                    </p>
                                    <p className="text-[11px] font-medium text-slate-700 truncate">{toReplyPreview(msg.replyTo)}</p>
                                  </div>
                                ) : null}
                                {isDeleted ? (
                                  <p className="text-sm italic font-medium text-slate-600">{deletedMessageLabel}</p>
                                ) : (
                                  <>
                                    {msg.text ? (
                                      <p className="text-sm font-medium text-slate-900 whitespace-pre-wrap break-words">
                                        {msg.text}
                                        {msg.editedAt ? <span className="ml-1 text-[10px] font-medium italic tracking-wide text-slate-500/90 align-baseline leading-none">(edited)</span> : null}
                                      </p>
                                    ) : null}
                                    {msg.attachment ? (
                                      <a
                                        href={getAttachmentHref(msg.attachment)}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="mt-2 inline-flex items-center gap-2 text-xs font-medium underline underline-offset-2 text-blue-700"
                                      >
                                        <Download size={13} />
                                        {msg.attachment.originalName || 'Download file'}
                                      </a>
                                    ) : null}
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                  {selectedUserId && typingByUser[String(selectedUserId)] ? (
                    <div className="flex justify-start">
                      <TypingDots />
                    </div>
                  ) : null}
                  <div ref={messagesEndRef} />
                </div>

                <div className={`border-t border-[#c7d3e5] p-3 bg-[#edf3fb]/90 backdrop-blur-sm ${isMobileView ? 'pb-[max(12px,env(safe-area-inset-bottom))]' : ''}`}>
                  {replyTo && (
                    <div className="mb-2 rounded-xl border border-[#c3d0e4] bg-white/85 px-3 py-2 flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-[11px] font-bold text-slate-700">Replying to {getUserId(replyTo.sender) === currentUserId ? 'yourself' : (replyTo.sender?.name || 'message')}</p>
                        <p className="text-xs font-medium text-slate-700 truncate">{toReplyPreview(replyTo)}</p>
                      </div>
                      <button type="button" className="text-slate-500 hover:text-slate-700" onClick={() => setReplyTo(null)} aria-label="Cancel reply">
                        <X size={14} />
                      </button>
                    </div>
                  )}
                  {forwardMessage && (
                    <div className="mb-2 rounded-xl border border-[#c3d0e4] bg-white/85 px-3 py-2">
                      <p className="text-[11px] font-semibold text-slate-600 mb-2">Forward to...</p>
                      <div className="max-h-32 overflow-y-auto space-y-1">
                        {users.filter((u) => u._id !== currentUserId).map((u) => (
                          <button
                            key={u._id}
                            type="button"
                            onClick={() => forwardToUser(forwardMessage, u._id)}
                            className="w-full text-left px-2 py-1.5 rounded-lg hover:bg-slate-100 text-sm text-slate-700"
                          >
                            {u.name}
                          </button>
                        ))}
                      </div>
                      <div className="mt-2 text-right">
                        <button type="button" className="text-xs text-slate-600 hover:text-slate-800" onClick={() => setForwardMessage(null)}>
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                  {editingMessageId && (
                    <div className="mb-2 rounded-xl border border-[#c3d0e4] bg-white/85 px-3 py-2 flex items-center justify-between gap-2">
                      <p className="text-xs text-slate-600">Editing message</p>
                      <button type="button" className="text-xs text-slate-600 hover:text-slate-800" onClick={() => { setEditingMessageId(''); setEditText(''); }}>
                        Cancel
                      </button>
                    </div>
                  )}
                  {pendingFile && (
                    <div className="mb-2 text-xs bg-white/90 border border-[#c3d0e4] rounded-xl px-2 py-1.5 flex items-center justify-between gap-2 text-slate-700">
                      <span className="truncate">
                        {pendingFile.name} ({formatBytes(pendingFile.size)})
                        {sending && uploadProgress > 0 ? ` - Uploading ${uploadProgress}%` : ''}
                      </span>
                      <button
                        type="button"
                        className="text-rose-500 hover:text-rose-700 font-medium"
                        onClick={() => {
                          setPendingFile(null);
                          if (fileInputRef.current) fileInputRef.current.value = '';
                        }}
                      >
                        Remove
                      </button>
                    </div>
                  )}
                  <div className={`flex items-center gap-2 ${isMobileView ? 'w-full' : ''}`}>
                    <input ref={fileInputRef} type="file" className="hidden" onChange={onPickFile} />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="h-11 w-11 shrink-0 rounded-xl border border-[#bccadf] bg-white/90 text-slate-600 hover:bg-white inline-flex items-center justify-center transition-colors"
                      aria-label="Attach file"
                    >
                      <Paperclip size={17} />
                    </button>
                    <input
                      type="text"
                      value={editingMessageId ? editText : draftText}
                      onChange={(e) => {
                        if (editingMessageId) {
                          setEditText(e.target.value);
                        } else {
                          setDraftText(e.target.value);
                        }
                      }}
                      onKeyDown={onMessageKeyDown}
                      placeholder={editingMessageId ? 'Edit your message...' : 'Type your message...'}
                      className="flex-1 h-11 rounded-xl border border-[#bccadf] px-3 text-sm font-medium text-slate-900 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[#9db2d3] focus:border-[#9db2d3] bg-white/95"
                    />
                    <button
                      type="button"
                      onClick={editingMessageId ? saveEditMessage : sendMessage}
                      disabled={editingMessageId ? (!editText.trim() || sending) : (sending || (!draftText.trim() && !pendingFile))}
                      className="h-11 w-11 shrink-0 rounded-xl bg-gradient-to-br from-[#4f739f] to-[#456991] text-white hover:brightness-110 disabled:opacity-60 inline-flex items-center justify-center transition shadow-[0_10px_18px_rgba(71,105,145,0.34)]"
                      aria-label={editingMessageId ? 'Save edit' : 'Send message'}
                    >
                      {editingMessageId ? <Pencil size={16} /> : <Send size={16} />}
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div data-chat-drag-handle className="h-[62px] px-4 border-b border-[#ccd8e8] flex items-center justify-between bg-[#edf3fb] cursor-move select-none">
                  {isMobileView ? (
                    <button
                      type="button"
                      onClick={() => setMobileUsersOpen((prev) => !prev)}
                      className="h-9 px-3 rounded-lg border border-[#c4d1e4] bg-white/80 text-slate-700 inline-flex items-center gap-2 text-sm font-medium"
                      aria-label="Toggle users list"
                    >
                      <PanelLeft size={15} />
                      Chats
                    </button>
                  ) : <div />}
                  <button
                    type="button"
                    className="h-9 w-9 rounded-lg hover:bg-rose-50 inline-flex items-center justify-center text-rose-500 hover:text-rose-600 transition-colors"
                    onClick={() => setIsOpen(false)}
                    aria-label="Close chat"
                    title="Close chat"
                  >
                    <X size={19} />
                  </button>
                </div>
                <div className="flex-1 grid place-items-center text-sm text-slate-500">
                  Select a user to start chatting.
                </div>
              </>
            )}
          </section>
        </div>
      )}
      {actionMessageId && actionTargetMessage && (
        <div
          ref={actionMenuRef}
          className="fixed z-[130] min-w-[200px] rounded-2xl border border-slate-300/90 bg-white/98 backdrop-blur-sm shadow-[0_16px_36px_rgba(15,23,42,0.18)] py-1.5"
          style={getActionMenuStyle()}
        >
          <button type="button" className="w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100 inline-flex items-center gap-2" onClick={() => startReplyToMessage(actionTargetMessage)}>
            <Reply size={14} /> Reply
          </button>
          {!actionTargetMessage.deletedForEveryoneAt && actionTargetMessage.text ? (
            <button type="button" className="w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100 inline-flex items-center gap-2" onClick={() => copyMessage(actionTargetMessage)}>
              <Copy size={14} /> Copy
            </button>
          ) : null}
          {!actionTargetMessage.deletedForEveryoneAt && getUserId(actionTargetMessage.sender) === currentUserId && actionTargetMessage.text ? (
            <button type="button" className="w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100 inline-flex items-center gap-2" onClick={() => onEditMessage(actionTargetMessage)}>
              <Pencil size={14} /> Edit
            </button>
          ) : null}
          {!actionTargetMessage.deletedForEveryoneAt ? (
            <button type="button" className="w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100 inline-flex items-center gap-2" onClick={() => { setForwardMessage(actionTargetMessage); setActionMessageId(''); }}>
              <Forward size={14} /> Forward
            </button>
          ) : null}
          <button type="button" className="w-full px-3 py-2 text-left text-sm hover:bg-rose-50 text-rose-600 inline-flex items-center gap-2" onClick={() => deleteMessage(actionTargetMessage, 'me')}>
            <Trash2 size={14} /> Delete for me
          </button>
          {!actionTargetMessage.deletedForEveryoneAt && getUserId(actionTargetMessage.sender) === currentUserId ? (
            <button type="button" className="w-full px-3 py-2 text-left text-sm hover:bg-rose-50 text-rose-600 inline-flex items-center gap-2" onClick={() => deleteMessage(actionTargetMessage, 'everyone')}>
              <Trash2 size={14} /> Delete for everyone
            </button>
          ) : null}
        </div>
      )}
    </>
  );
};

export default InAppChatWidget;
