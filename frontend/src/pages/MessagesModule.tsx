import React, { useEffect, useState, useRef } from 'react';
import { useAppContext } from '../App';
import { Send, User, MessageSquare, Search, CheckCheck } from 'lucide-react';

interface Message {
  id: number;
  sender_id: number;
  receiver_id: number;
  content: string;
  timestamp: string;
  is_read: boolean;
}

export default function MessagesModule() {
  const { currentUser, drivers, role, secureFetch } = useAppContext();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  
  // Selected recipient for Manager
  const [selectedDriver, setSelectedDriver] = useState<any>(drivers[0] || null);
  const [searchQuery, setSearchQuery] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Determine target user ID
  const activeDriver = drivers.find(d => d.user_id === currentUser?.id) || drivers[0];
  const targetUserId = role === 'driver' 
    ? (activeDriver?.manager_id || 1)
    : (selectedDriver?.user_id || selectedDriver?.id || 1);

  const fetchMessages = async () => {
    if (!targetUserId) return;
    try {
      const res = await secureFetch(`http://localhost:8000/api/messages/${targetUserId}`);
      if (res.ok) {
        const data = await res.json();
        setMessages(data);
      }
    } catch (err) {
      console.error("Failed to fetch messages:", err);
    }
  };

  useEffect(() => {
    fetchMessages();
    const interval = setInterval(fetchMessages, 3000);
    return () => clearInterval(interval);
  }, [targetUserId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !targetUserId) return;

    try {
      const res = await secureFetch('http://localhost:8000/api/messages', {
        method: 'POST',
        body: JSON.stringify({
          receiver_id: targetUserId,
          content: inputText
        })
      });
      if (res.ok) {
        const newMessage = await res.json();
        setMessages(prev => [...prev, newMessage]);
        setInputText('');
      }
    } catch (err) {
      console.error("Failed to send message", err);
    }
  };

  const filteredDrivers = drivers.filter(d => 
    d.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (d.license && d.license.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="flex bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-soft-sm overflow-hidden h-[calc(100vh-170px)] animate-scale-in">
      {/* MANAGER VIEW: DRIVER SELECTION SIDEBAR */}
      {role === 'manager' && (
        <div className="w-72 border-r border-slate-200 dark:border-slate-800 flex flex-col bg-slate-50/50 dark:bg-slate-950/50 shrink-0">
          <div className="p-4 border-b border-slate-200 dark:border-slate-800">
            <h3 className="font-bold text-slate-800 dark:text-slate-100 text-sm flex items-center gap-2 mb-3">
              <MessageSquare className="w-4 h-4 text-primary-500" />
              Driver Messages
            </h3>
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search driver..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs focus:outline-none"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-1">
            {filteredDrivers.map(d => {
              const isSelected = selectedDriver?.id === d.id;
              return (
                <button
                  key={d.id}
                  onClick={() => setSelectedDriver(d)}
                  className={`p-3 rounded-lg text-left transition-all flex items-center gap-3 cursor-pointer ${
                    isSelected
                      ? 'bg-primary-50 dark:bg-primary-950/40 border border-primary-200 dark:border-primary-800 text-primary-700 dark:text-primary-300'
                      : 'hover:bg-slate-100 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  <div className="w-9 h-9 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center font-bold text-xs shrink-0">
                    {d.name.charAt(0)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex justify-between items-baseline">
                      <h4 className="font-bold text-xs truncate">{d.name}</h4>
                      <span className={`text-[9px] font-semibold px-1 rounded ${
                        d.availability === 'Available' ? 'bg-emerald-100 text-emerald-700' : 'bg-indigo-100 text-indigo-700'
                      }`}>
                        {d.availability}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-400 truncate mt-0.5">
                      {d.phone || d.email || 'Driver'}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* CHAT AREA */}
      <div className="flex-1 flex flex-col min-w-0 bg-white dark:bg-slate-900">
        {/* Header */}
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary-100 dark:bg-primary-900/50 flex items-center justify-center text-primary-600 font-bold">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 dark:text-slate-100 text-sm">
                {role === 'manager' ? (selectedDriver?.name || 'Select Driver') : 'Fleet Dispatcher (Manager)'}
              </h3>
              <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">
                {role === 'manager' ? `Private Chat • License: ${selectedDriver?.license || 'N/A'}` : 'Private Dispatch Line'}
              </p>
            </div>
          </div>
        </div>

        {/* Message History */}
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
          {messages.length === 0 ? (
            <div className="text-center text-slate-400 text-xs my-auto py-10">
              No message history found. Type a message below to start a private conversation.
            </div>
          ) : (
            messages.map(msg => {
              const isMe = msg.sender_id === currentUser?.id;
              return (
                <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                  <div 
                    className={`max-w-[75%] p-3 rounded-2xl text-xs leading-relaxed ${
                      isMe 
                        ? 'bg-primary-600 text-white rounded-br-none shadow-soft-sm' 
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-bl-none border border-slate-200/50 dark:border-slate-700/50'
                    }`}
                  >
                    {msg.content}
                  </div>
                  <span className="text-[9px] text-slate-400 mt-1 mx-1 flex items-center gap-1">
                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    {isMe && <CheckCheck className="w-3 h-3 text-primary-400" />}
                  </span>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input box */}
        <div className="p-3 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900">
          <form onSubmit={handleSendMessage} className="flex items-center gap-2">
            <input
              type="text"
              value={inputText}
              onChange={e => setInputText(e.target.value)}
              placeholder={role === 'manager' ? `Message ${selectedDriver?.name || 'driver'}...` : "Message fleet dispatcher..."}
              className="flex-1 px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full text-xs focus:outline-none focus:border-primary-500 text-slate-800 dark:text-slate-100"
            />
            <button
              type="submit"
              disabled={!inputText.trim()}
              className="w-9 h-9 rounded-full bg-primary-600 flex items-center justify-center text-white disabled:opacity-50 hover:bg-primary-700 transition-colors shadow-soft-sm cursor-pointer"
            >
              <Send className="w-4 h-4 -ml-0.5" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
