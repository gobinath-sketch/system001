import { useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { MessageCircle, Send, Paperclip, X, Search, Download } from 'lucide-react';
import { API_BASE, API_ENDPOINTS, uploadUrl } from '../../config/api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useSocket } from '../../context/SocketContext';

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

const Avatar = ({ name, avatarDataUrl, sizeClass = 'h-10 w-10' }) => {
  if (avatarDataUrl) {
    return (
      <img
        src={avatarDataUrl}
        alt={name || 'User'}
        className={`${sizeClass} rounded-full object-cover border border-primary-blue/20 shrink-0`}
      />
    );
  }
  return (
    <div className={`${sizeClass} rounded-full bg-gradient-to-br from-primary-blue/20 to-blue-400/15 text-primary-blue font-semibold text-xs inline-flex items-center justify-center border border-primary-blue/20 shrink-0`}>
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
  const fileInputRef = useRef(null);
  const messagesEndRef = useRef(null);

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

      const convoUserMap = new Map(convoList.map((row) => [row.user?._id, row]));
      const mergedUsers = usersList
        .map((userItem) => ({
          ...userItem,
          unreadCount: convoUserMap.get(userItem._id)?.unreadCount || 0,
          lastMessageAt: convoUserMap.get(userItem._id)?.lastMessage?.createdAt || null,
          lastMessage: convoUserMap.get(userItem._id)?.lastMessage || null
        }))
        .sort((a, b) => {
          const aTs = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
          const bTs = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
          if (aTs !== bTs) return bTs - aTs;
          return String(a.name || '').localeCompare(String(b.name || ''));
        });

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
        loadMessages(selectedUserId, { silent: true, autoScroll: false }).then(() => markConversationRead(selectedUserId));
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [isOpen, selectedUserId]);

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
        const unreadCount = senderId !== currentUserId && selectedUserId !== otherId ? Number(base.unreadCount || 0) + 1 : 0;
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
        return [updated, ...withoutCurrent];
      });

      setConversations((prev) => {
        const existing = prev.find((row) => row.user?._id === otherId);
        const row = existing || { user: fallbackUser, unreadCount: 0, lastMessage: null };
        const unreadCount = senderId !== currentUserId && selectedUserId !== otherId ? Number(row.unreadCount || 0) + 1 : 0;
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

    const handleEntityUpdated = (payload) => {
      if (payload?.entity === 'user' && isOpen) {
        refreshUsersAndConversations();
      }
    };

    socket.on('chat_message:new', handleIncomingMessage);
    socket.on('chat_message:read', handleRead);
    socket.on('entity_updated', handleEntityUpdated);
    return () => {
      socket.off('chat_message:new', handleIncomingMessage);
      socket.off('chat_message:read', handleRead);
      socket.off('entity_updated', handleEntityUpdated);
    };
  }, [socket, currentUserId, selectedUserId, isOpen]);

  const onSelectUser = (nextUserId) => {
    setSelectedUserId(nextUserId);
    setMessages([]);
    setDraftText('');
    setPendingFile(null);
    setUploadProgress(0);
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

    setSending(true);
    setUploadProgress(0);
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
          { text: textValue || '' },
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
      sendMessage();
    }
  };

  return (
    <>
      {!isOpen && (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="fixed bottom-5 right-5 z-[70] h-14 w-14 rounded-full bg-gradient-to-br from-primary-blue to-blue-700 text-white shadow-[0_12px_28px_rgba(16,66,131,0.4)] hover:shadow-[0_16px_32px_rgba(16,66,131,0.5)] transition-all"
          aria-label="Open chat"
        >
          <MessageCircle size={24} className="mx-auto" />
          {unreadTotal > 0 && (
            <span className="absolute -top-1 -right-1 min-w-6 h-6 px-1 rounded-full bg-red-500 text-white text-xs font-bold inline-flex items-center justify-center">
              {unreadTotal > 99 ? '99+' : unreadTotal}
            </span>
          )}
        </button>
      )}

      {isOpen && (
        <div
          className="fixed bottom-4 right-4 left-4 sm:left-auto z-[75] sm:w-[920px] h-[78vh] max-h-[720px] rounded-2xl border border-slate-200/70 bg-white/95 backdrop-blur-xl shadow-[0_25px_60px_rgba(15,23,42,0.25)] overflow-hidden flex"
          onDragEnter={onDragEnter}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
        >
          <aside className="w-[38%] min-w-[280px] max-w-[340px] border-r border-slate-200 bg-slate-50 flex flex-col">
            <div className="px-4 py-3 border-b border-slate-200 bg-white flex items-center justify-between">
              <div>
                <h3 className="text-[15px] font-semibold text-slate-900">Team Chat</h3>
                <p className="text-[11px] text-slate-500 mt-0.5">Direct messages</p>
              </div>
            </div>
            <div className="p-3 border-b border-slate-200 bg-white">
              <div className="relative">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search users..."
                  className="w-full h-9 pl-9 pr-3 text-sm border border-slate-200 rounded-lg bg-slate-50 focus:outline-none focus:ring-2 focus:ring-primary-blue"
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
                    className={`w-full px-3 py-3 text-left rounded-xl border transition-all ${selectedUserId === person._id ? 'bg-white border-primary-blue/40 shadow-sm' : 'bg-transparent border-transparent hover:bg-white/80 hover:border-slate-200'}`}
                  >
                    <div className="flex items-start gap-3">
                      <Avatar name={person.name} avatarDataUrl={person.avatarDataUrl} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-semibold text-slate-900 truncate">{person.name}</p>
                          <span className="text-[11px] text-slate-400">
                            {person.lastMessageAt ? formatTime(person.lastMessageAt) : ''}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 truncate">{person.role}</p>
                        <p className="mt-1 text-xs text-slate-600 truncate">
                          {getLastPreview(person.lastMessage)}
                        </p>
                      </div>
                      {Number(person.unreadCount || 0) > 0 && (
                        <span className="mt-1 min-w-5 h-5 px-1 rounded-full bg-red-500 text-white text-[11px] font-bold inline-flex items-center justify-center shadow-sm">
                          {person.unreadCount}
                        </span>
                      )}
                    </div>
                  </button>
                ))
              )}
            </div>
          </aside>

          <section className="flex-1 flex flex-col min-w-0 bg-white relative">
            {isDragOver && selectedUserId && (
              <div className="absolute inset-0 z-20 m-3 rounded-2xl border-2 border-dashed border-primary-blue bg-primary-blue/5 pointer-events-none grid place-items-center">
                <div className="rounded-xl bg-white/90 px-4 py-2 text-sm font-medium text-primary-blue shadow">
                  Drop file here to attach
                </div>
              </div>
            )}
            {selectedUser ? (
              <>
                <div className="h-[62px] px-4 border-b border-slate-200 flex items-center gap-3 bg-white">
                  <Avatar name={selectedUser.name} avatarDataUrl={selectedUser.avatarDataUrl} />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900 truncate">{selectedUser.name}</p>
                    <p className="text-xs text-slate-500 truncate">{selectedUser.role}</p>
                  </div>
                  <button
                    type="button"
                    className="ml-auto h-9 w-9 rounded-lg hover:bg-red-50 inline-flex items-center justify-center text-red-500 hover:text-red-600 transition-colors"
                    onClick={() => setIsOpen(false)}
                    aria-label="Close chat"
                    title="Close chat"
                  >
                    <X size={19} />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2 bg-gradient-to-b from-slate-50 to-white">
                  {loadingMessages ? (
                    <div className="text-sm text-slate-500">Loading conversation...</div>
                  ) : messages.length === 0 ? (
                    <div className="text-sm text-slate-500">Start the conversation.</div>
                  ) : (
                    messages.map((msg, idx) => {
                      const mine = getUserId(msg.sender) === currentUserId;
                      const nextMsg = messages[idx + 1];
                      const currentTimeLabel = formatTime(msg.createdAt);
                      const nextTimeLabel = nextMsg ? formatTime(nextMsg.createdAt) : '';
                      const shouldShowTime = !nextMsg || getUserId(nextMsg.sender) !== getUserId(msg.sender) || nextTimeLabel !== currentTimeLabel;
                      return (
                        <div key={msg._id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                          <div className={`max-w-[82%] rounded-2xl px-3.5 py-2.5 shadow-sm ${mine ? 'bg-gradient-to-br from-primary-blue to-blue-700 text-white rounded-br-md' : 'bg-white border border-slate-200 text-slate-900 rounded-bl-md'}`}>
                            {msg.text ? <p className="text-sm whitespace-pre-wrap break-words">{msg.text}</p> : null}
                            {msg.attachment ? (
                              <a
                                href={getAttachmentHref(msg.attachment)}
                                target="_blank"
                                rel="noreferrer"
                                className={`mt-2 inline-flex items-center gap-2 text-xs underline underline-offset-2 ${mine ? 'text-blue-100' : 'text-primary-blue'}`}
                              >
                                <Download size={13} />
                                {msg.attachment.originalName || 'Download file'}
                              </a>
                            ) : null}
                            {shouldShowTime ? (
                              <div className={`mt-1 text-[10px] ${mine ? 'text-blue-100' : 'text-slate-500'}`}>
                                {currentTimeLabel}
                              </div>
                            ) : null}
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={messagesEndRef} />
                </div>

                <div className="border-t border-slate-200 p-3 bg-white">
                  {pendingFile && (
                    <div className="mb-2 text-xs bg-slate-100 border border-slate-200 rounded-lg px-2 py-1.5 flex items-center justify-between gap-2">
                      <span className="truncate">
                        {pendingFile.name} ({formatBytes(pendingFile.size)})
                        {sending && uploadProgress > 0 ? ` - Uploading ${uploadProgress}%` : ''}
                      </span>
                      <button
                        type="button"
                        className="text-red-500 hover:text-red-700 font-medium"
                        onClick={() => {
                          setPendingFile(null);
                          if (fileInputRef.current) fileInputRef.current.value = '';
                        }}
                      >
                        Remove
                      </button>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <input ref={fileInputRef} type="file" className="hidden" onChange={onPickFile} />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="h-11 w-11 shrink-0 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 inline-flex items-center justify-center transition-colors"
                      aria-label="Attach file"
                    >
                      <Paperclip size={17} />
                    </button>
                    <input
                      type="text"
                      value={draftText}
                      onChange={(e) => setDraftText(e.target.value)}
                      onKeyDown={onMessageKeyDown}
                      placeholder="Type your message..."
                      className="flex-1 h-11 rounded-xl border border-slate-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-blue bg-slate-50/70"
                    />
                    <button
                      type="button"
                      onClick={sendMessage}
                      disabled={sending || (!draftText.trim() && !pendingFile)}
                      className="h-11 w-11 shrink-0 rounded-xl bg-gradient-to-br from-primary-blue to-blue-700 text-white hover:brightness-110 disabled:opacity-60 inline-flex items-center justify-center transition"
                      aria-label="Send message"
                    >
                      <Send size={16} />
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="h-[62px] px-4 border-b border-slate-200 flex items-center justify-end bg-white">
                  <button
                    type="button"
                    className="h-9 w-9 rounded-lg hover:bg-red-50 inline-flex items-center justify-center text-red-500 hover:text-red-600 transition-colors"
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
    </>
  );
};

export default InAppChatWidget;
