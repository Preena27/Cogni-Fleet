import React, { useState, useRef, useEffect } from 'react';
import { useAppContext } from '../App';
import { 
  Sparkles, MessageSquare, Send, X, Bot, RefreshCw, 
  ShieldAlert, Wrench, DollarSign, Truck, User, ArrowRight, Check,
  AlertTriangle, Lightbulb, Zap, TrendingUp, HelpCircle
} from 'lucide-react';

interface Message {
  sender: 'user' | 'assistant';
  text: string;
}

export default function AIAssistant() {
  const { drivers, alerts, addToast, refreshAll, secureFetch } = useAppContext();
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'proactive' | 'chat'>('proactive');
  const [categoryFilter, setCategoryFilter] = useState<string>('All');

  // AI Intelligence Data State
  const [intel, setIntel] = useState<any>(null);
  const [loadingIntel, setLoadingIntel] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Chat States
  const [messages, setMessages] = useState<Message[]>([
    { 
      sender: 'assistant', 
      text: "Hello! I am your CogniFleet AI Advisor. I continuously analyze live database telemetry.\n\nTry quick queries:\n- **Which truck is most profitable?**\n- **Which truck has highest fuel cost?**\n- **Which vehicle needs maintenance?**\n- **Which driver's license expires first?**\n- **Should we buy another vehicle?**" 
    }
  ]);
  const [inputText, setInputText] = useState('');
  const [loadingChat, setLoadingChat] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Fetch proactive intelligence from backend API
  const fetchIntelligence = async () => {
    setLoadingIntel(true);
    try {
      const res = await secureFetch('http://localhost:8000/api/ai/intelligence');
      if (res.ok) {
        const data = await res.json();
        setIntel(data);
      }
    } catch (err) {
      console.error("Failed to fetch AI intelligence:", err);
    } finally {
      setLoadingIntel(false);
    }
  };

  useEffect(() => {
    fetchIntelligence();
  }, [isOpen, drivers, alerts]);

  // Auto-scroll chat to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen && activeTab === 'chat') {
      scrollToBottom();
    }
  }, [messages, isOpen, activeTab]);

  // Execute 1-Click Recommendation Action
  const handleExecuteAction = async (rec: any) => {
    setActionLoading(rec.id);
    try {
      const res = await secureFetch('http://localhost:8000/api/ai/execute-recommendation', {
        method: 'POST',
        body: JSON.stringify({
          action_type: rec.action_type,
          action_payload: rec.action_payload
        })
      });

      if (res.ok) {
        const data = await res.json();
        addToast("AI Action Executed", data.message, "success");
        await refreshAll();
        await fetchIntelligence();
      } else {
        const errData = await res.json();
        addToast("Execution Failed", errData.detail || "Action could not be executed.", "error");
      }
    } catch (err) {
      console.error(err);
      addToast("Network Error", "Could not reach server.", "error");
    } finally {
      setActionLoading(null);
    }
  };

  const handleSendChat = async (queryText?: string) => {
    const textToSend = queryText || inputText;
    if (!textToSend.trim() || loadingChat) return;

    const userText = textToSend;
    const conversation = messages.map(msg => ({
      role: msg.sender === 'user' ? 'user' : 'assistant',
      content: msg.text
    }));

    if (!queryText) setInputText('');
    setMessages(prev => [...prev, { sender: 'user', text: userText }]);
    setLoadingChat(true);

    try {
      const res = await secureFetch('http://localhost:8000/api/ai-assistant', {
        method: 'POST',
        body: JSON.stringify({
          query: userText,
          conversation
        })
      });

      if (res.ok) {
        const data = await res.json();
        setMessages(prev => [...prev, { sender: 'assistant', text: data.response }]);
      } else {
        setMessages(prev => [...prev, { sender: 'assistant', text: "Error: Could not process request." }]);
      }
    } catch (err) {
      console.error(err);
      setMessages(prev => [...prev, { sender: 'assistant', text: "Network error connecting to backend API." }]);
    } finally {
      setLoadingChat(false);
    }
  };

  // Safe Markdown Parser
  const parseMarkdown = (text: string) => {
    let html = text;
    html = html.replace(/^### (.*$)/gim, '<h4 class="font-bold text-xs uppercase text-indigo-600 dark:text-indigo-400 mt-2 mb-1 flex items-center gap-1">$1</h4>');
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong class="font-bold text-slate-850 dark:text-slate-100">$1</strong>');
    html = html.replace(/^\s*[-*]\s+(.*$)/gim, '<li class="ml-3 list-disc pl-1">$1</li>');

    if (html.includes('|')) {
      const lines = html.split('\n');
      let tableOpen = false;
      let tableHtml = '';

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line.startsWith('|')) {
          if (line.includes('---')) continue;
          if (!tableOpen) {
            tableHtml += '<table class="w-full text-left my-2 border-collapse text-[10px]"><tbody class="divide-y border-y dark:border-slate-800">';
            tableOpen = true;
          }
          const cells = line.split('|').map(c => c.trim()).filter(c => c !== '');
          tableHtml += '<tr class="hover:bg-slate-50 dark:hover:bg-slate-800/20">';
          cells.forEach(cell => {
            tableHtml += `<td class="py-1.5 px-1">${cell}</td>`;
          });
          tableHtml += '</tr>';
        } else {
          if (tableOpen) {
            tableHtml += '</tbody></table>';
            tableOpen = false;
          }
          tableHtml += line + '\n';
        }
      }
      if (tableOpen) tableHtml += '</tbody></table>';
      html = tableHtml;
    }

    html = html.replace(/\n/g, '<br/>');
    return <div dangerouslySetInnerHTML={{ __html: html }} className="flex flex-col gap-1 text-xs text-slate-700 dark:text-slate-300 leading-relaxed font-sans" />;
  };

  const getPriorityStyle = (priority: string) => {
    switch (priority) {
      case 'CRITICAL': return 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-400 dark:border-red-800';
      case 'HIGH': return 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/30 dark:text-orange-400 dark:border-orange-800';
      case 'MEDIUM': return 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-800';
      case 'LOW': default: return 'bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-800/40 dark:text-slate-300 dark:border-slate-700';
    }
  };

  const filteredRecommendations = intel?.recommendations?.filter((r: any) => 
    categoryFilter === 'All' || r.category.toLowerCase() === categoryFilter.toLowerCase()
  ) || [];

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end font-sans">
      {/* AI Advisor Modal Drawer */}
      {isOpen && (
        <div className="mb-4 w-[460px] max-w-[92vw] h-[580px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-soft-2xl flex flex-col overflow-hidden animate-scale-in">
          
          {/* Header Bar */}
          <div className="bg-gradient-to-r from-indigo-600 via-blue-600 to-indigo-700 px-4 py-3 text-white flex items-center justify-between shrink-0 shadow-soft-sm">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center text-white">
                <Sparkles className="w-4 h-4 animate-pulse" />
              </div>
              <div>
                <h3 className="font-extrabold text-sm tracking-tight flex items-center gap-1.5">
                  CogniFleet AI Intelligence Engine
                </h3>
                <span className="text-[9px] uppercase tracking-wider block opacity-90 font-medium">Real-Time Database Operations Advisor</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button 
                onClick={fetchIntelligence} 
                className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition text-white" 
                title="Refresh Intelligence"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingIntel ? 'animate-spin' : ''}`} />
              </button>
              <button 
                onClick={() => setIsOpen(false)} 
                className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Mode Switch Tabs */}
          <div className="grid grid-cols-2 bg-slate-100 dark:bg-slate-850 p-1 border-b border-slate-200 dark:border-slate-800 shrink-0">
            <button
              type="button"
              onClick={() => setActiveTab('proactive')}
              className={`py-2 text-xs font-bold rounded-lg transition flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === 'proactive'
                  ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-soft-sm'
                  : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
              }`}
            >
              <Lightbulb className="w-3.5 h-3.5" />
              Proactive Recommendations
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('chat')}
              className={`py-2 text-xs font-bold rounded-lg transition flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === 'chat'
                  ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-soft-sm'
                  : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              Ask AI (Live Q&A)
            </button>
          </div>

          {/* MODE A: PROACTIVE RECOMMENDATIONS & DAILY BRIEFING */}
          {activeTab === 'proactive' && (
            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 bg-slate-50/50 dark:bg-slate-950/30">
              
              {/* Daily AI Briefing Banner */}
              {intel?.daily_briefing && (
                <div className="p-3.5 rounded-xl bg-gradient-to-r from-slate-900 to-indigo-950 text-white shadow-soft-md flex flex-col gap-2 border border-indigo-900/50">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-400 flex items-center gap-1">
                      <Zap className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
                      Today's AI Daily Briefing
                    </span>
                    <span className="text-[9px] bg-indigo-900/80 px-2 py-0.5 rounded text-indigo-200 font-mono">
                      {intel.scorecard?.fleet_utilization_pct}% Utilization
                    </span>
                  </div>
                  <p className="text-xs font-semibold leading-relaxed text-slate-100">{intel.daily_briefing.greeting}</p>
                  
                  {/* Fleet Scorecard Bar */}
                  <div className="grid grid-cols-4 gap-1.5 text-center text-[9px] font-bold pt-1 border-t border-white/10">
                    <div className="bg-emerald-950/60 text-emerald-300 rounded p-1">🟢 {intel.scorecard.operational_vehicles} Active</div>
                    <div className="bg-amber-950/60 text-amber-300 rounded p-1">🟡 {intel.scorecard.maintenance_soon_vehicles} Soon</div>
                    <div className="bg-red-950/60 text-red-300 rounded p-1">🔴 {intel.scorecard.critical_maintenance_vehicles} Overdue</div>
                    <div className="bg-blue-950/60 text-blue-300 rounded p-1">📜 {intel.scorecard.expiring_licenses} Expiring</div>
                  </div>
                </div>
              )}

              {/* Category Filter Chips */}
              <div className="flex gap-1.5 overflow-x-auto pb-1 shrink-0 text-[10px] no-scrollbar">
                {['All', 'Safety', 'Maintenance', 'Profit', 'Driver', 'Load', 'Capacity'].map(cat => (
                  <button
                    key={cat}
                    onClick={() => setCategoryFilter(cat)}
                    className={`px-2.5 py-1 rounded-full font-bold transition shrink-0 cursor-pointer ${
                      categoryFilter === cat
                        ? 'bg-indigo-600 text-white shadow-soft-sm'
                        : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-350 border border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              {/* Recommendations Feed List */}
              <div className="flex flex-col gap-3">
                {loadingIntel ? (
                  <div className="flex flex-col items-center justify-center py-12 text-slate-400 text-xs gap-2">
                    <RefreshCw className="w-6 h-6 animate-spin text-indigo-500" />
                    <span>Analyzing SQL database telemetry & profit patterns...</span>
                  </div>
                ) : filteredRecommendations.length === 0 ? (
                  <div className="p-6 bg-white dark:bg-slate-850 rounded-xl text-center text-xs text-slate-400 border border-slate-100 dark:border-slate-800">
                    No active recommendations for category "{categoryFilter}". Fleet is running optimally!
                  </div>
                ) : (
                  filteredRecommendations.map((rec: any) => (
                    <div
                      key={rec.id}
                      className="p-4 bg-white dark:bg-slate-850 border border-slate-200 dark:border-slate-800 rounded-xl shadow-soft-sm flex flex-col gap-2.5 text-xs transition hover:shadow-soft-md"
                    >
                      {/* Priority Header */}
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-1.5">
                          <span className={`px-2 py-0.5 rounded text-[9px] font-bold border uppercase ${getPriorityStyle(rec.priority)}`}>
                            {rec.priority}
                          </span>
                          <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[9px] font-bold">
                            {rec.category}
                          </span>
                        </div>
                        <span className="text-[9px] font-mono text-emerald-600 dark:text-emerald-400 font-bold">
                          {rec.confidence || 'HIGH'}
                        </span>
                      </div>

                      {/* WHAT / Title */}
                      <h4 className="font-extrabold text-sm text-slate-850 dark:text-slate-100 leading-snug">
                        {rec.title}
                      </h4>

                      {/* Problem summary */}
                      <p className="text-[11px] text-slate-600 dark:text-slate-350 leading-relaxed">
                        {rec.problem}
                      </p>

                      {/* WHY (Explainable AI bullets) */}
                      {rec.why && rec.why.length > 0 && (
                        <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800 flex flex-col gap-1">
                          <span className="text-[9px] uppercase font-bold text-slate-400 tracking-wider">Explainable AI Rationale:</span>
                          <ul className="space-y-0.5 text-[10px] text-slate-600 dark:text-slate-300">
                            {rec.why.map((w: string, idx: number) => (
                              <li key={idx} className="flex items-start gap-1">
                                <span className="text-indigo-500 font-bold">•</span> {w}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* EXPECTED IMPACT */}
                      <div className="text-[10px] text-emerald-700 dark:text-emerald-400 font-medium flex items-center gap-1">
                        <TrendingUp className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                        <span><strong>Expected Impact:</strong> {rec.expected_impact}</span>
                      </div>

                      {/* 1-CLICK ACTION BUTTON */}
                      {rec.action_type && (
                        <button
                          type="button"
                          onClick={() => handleExecuteAction(rec)}
                          disabled={actionLoading === rec.id}
                          className="mt-1 w-full py-2 px-3 bg-indigo-600 hover:bg-indigo-750 text-white font-bold rounded-lg shadow-soft-sm flex items-center justify-center gap-1.5 transition text-xs cursor-pointer disabled:bg-slate-400"
                        >
                          {actionLoading === rec.id ? (
                            <>
                              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                              Executing AI Action...
                            </>
                          ) : (
                            <>
                              <Check className="w-3.5 h-3.5" />
                              {rec.recommended_action}
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* MODE B: ASK AI CHATBOT (LIVE Q&A) */}
          {activeTab === 'chat' && (
            <div className="flex-1 flex flex-col overflow-hidden bg-slate-50/50 dark:bg-slate-950/30">
              
              {/* Quick Prompts Chips */}
              <div className="p-2 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex gap-1.5 overflow-x-auto text-[10px] shrink-0 no-scrollbar">
                <button 
                  onClick={() => handleSendChat("Which vehicle is most profitable?")}
                  className="px-2.5 py-1 rounded-full bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 font-bold hover:bg-indigo-100 transition whitespace-nowrap cursor-pointer"
                >
                  🏆 Most Profitable Truck?
                </button>
                <button 
                  onClick={() => handleSendChat("Which vehicle needs maintenance soon?")}
                  className="px-2.5 py-1 rounded-full bg-orange-50 dark:bg-orange-950/40 text-orange-700 dark:text-orange-300 font-bold hover:bg-orange-100 transition whitespace-nowrap cursor-pointer"
                >
                  🔧 Maintenance Required?
                </button>
                <button 
                  onClick={() => handleSendChat("Which driver's license expires first?")}
                  className="px-2.5 py-1 rounded-full bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 font-bold hover:bg-blue-100 transition whitespace-nowrap cursor-pointer"
                >
                  📜 License Expiries?
                </button>
                <button 
                  onClick={() => handleSendChat("Should the fleet consider purchasing another vehicle?")}
                  className="px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 font-bold hover:bg-emerald-100 transition whitespace-nowrap cursor-pointer"
                >
                  🚛 Buy Next Truck?
                </button>
              </div>

              {/* Chat Messages */}
              <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3.5">
                {messages.map((msg, idx) => (
                  <div
                    key={idx}
                    className={`flex gap-2 max-w-[90%] ${
                      msg.sender === 'user' ? 'self-end flex-row-reverse' : 'self-start'
                    }`}
                  >
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-white font-bold text-[9px] ${
                      msg.sender === 'user' ? 'bg-primary-600' : 'bg-indigo-600'
                    }`}>
                      {msg.sender === 'user' ? 'U' : 'AI'}
                    </div>
                    <div className={`p-3 rounded-xl text-xs shadow-soft-sm border ${
                      msg.sender === 'user'
                        ? 'bg-primary-600 border-primary-600 text-white rounded-tr-none'
                        : 'bg-white dark:bg-slate-850 border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 rounded-tl-none'
                    }`}>
                      {msg.sender === 'user' ? (
                        <p className="leading-relaxed">{msg.text}</p>
                      ) : (
                        parseMarkdown(msg.text)
                      )}
                    </div>
                  </div>
                ))}

                {loadingChat && (
                  <div className="flex gap-2 max-w-[85%] self-start animate-pulse">
                    <div className="w-6 h-6 rounded-full bg-indigo-600 flex items-center justify-center shrink-0 text-white font-bold text-[9px]">
                      AI
                    </div>
                    <div className="p-2.5 rounded-xl text-[10px] bg-white dark:bg-slate-850 border border-slate-200 dark:border-slate-800 text-slate-400 font-semibold flex items-center gap-1.5 rounded-tl-none">
                      <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-500" />
                      Analyzing SQL database metrics...
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Chat Input Form */}
              <form onSubmit={(e) => { e.preventDefault(); handleSendChat(); }} className="p-3 border-t bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 flex gap-2 shrink-0">
                <input 
                  type="text" 
                  placeholder="Ask any question (e.g. Which truck is most profitable?)..."
                  value={inputText}
                  onChange={e => setInputText(e.target.value)}
                  className="flex-1 px-3 py-2 rounded-lg border border-slate-250 dark:border-slate-800 bg-transparent text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:border-indigo-500 font-sans"
                />
                <button 
                  type="submit"
                  disabled={!inputText.trim() || loadingChat}
                  className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white font-bold rounded-lg flex items-center justify-center transition shadow-soft-sm cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </form>
            </div>
          )}

        </div>
      )}

      {/* Floating Trigger Button */}
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="w-13 h-13 bg-gradient-to-tr from-indigo-600 via-blue-600 to-indigo-700 text-white rounded-full flex items-center justify-center shadow-soft-xl hover:shadow-2xl transition-all hover:scale-105 glow-primary cursor-pointer border-2 border-white/20"
      >
        {isOpen ? <X className="w-6 h-6" /> : <Sparkles className="w-6 h-6 animate-pulse" />}
      </button>
    </div>
  );
}
