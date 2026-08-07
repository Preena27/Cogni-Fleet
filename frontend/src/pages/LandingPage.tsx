import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Truck, 
  ShieldCheck, 
  Zap, 
  Cpu, 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle2, 
  Sparkles, 
  ArrowRight, 
  Layers, 
  Users, 
  MapPin, 
  Clock, 
  Fuel, 
  Wrench, 
  FileText, 
  Search, 
  MessageSquare, 
  ChevronRight, 
  Database, 
  Activity, 
  Radio, 
  ShieldAlert,
  Bot,
  Play,
  BarChart3,
  Check,
  X,
  Compass,
  ChevronDown
} from 'lucide-react';
import { useAppContext } from '../App';

interface LandingPageProps {
  onLoginClick?: () => void;
}

export default function LandingPage({ onLoginClick }: LandingPageProps) {
  const navigate = useNavigate();
  const { isLoggedIn } = useAppContext();
  const [activeStep, setActiveStep] = useState(0);
  const [activeTab, setActiveTab] = useState<'all' | 'vehicles' | 'drivers' | 'ai'>('all');
  const [chatMessageIndex, setChatMessageIndex] = useState(0);

  // Auto-cycle through steps for storytelling demo
  useEffect(() => {
    const interval = setInterval(() => {
      setActiveStep((prev) => (prev + 1) % 4);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  const handleAction = () => {
    if (isLoggedIn) {
      navigate('/');
    } else if (onLoginClick) {
      onLoginClick();
    } else {
      navigate('/login');
    }
  };

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-cyan-500 selection:text-white overflow-x-hidden">
      
      {/* ==========================================
          1. STICKY NAVBAR
      ========================================== */}
      <header className="sticky top-0 z-50 backdrop-blur-md bg-slate-950/80 border-b border-slate-800/80 transition-all duration-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          
          {/* Logo */}
          <div 
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="flex items-center gap-3 cursor-pointer group"
          >
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-600 via-blue-600 to-indigo-600 flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-cyan-500/20 group-hover:scale-105 transition-transform">
              <Truck className="w-5 h-5 text-white" />
            </div>
            <div>
              <span className="font-bold text-xl tracking-tight text-white flex items-center gap-1.5">
                Cognifleet
                <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></span>
              </span>
              <span className="text-[10px] block font-semibold uppercase tracking-widest text-cyan-400 -mt-1">
                AI Fleet Intelligence
              </span>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-300">
            <button onClick={() => scrollToSection('products')} className="hover:text-cyan-400 transition-colors">Products</button>
            <button onClick={() => scrollToSection('solutions')} className="hover:text-cyan-400 transition-colors">Solutions</button>
            <button onClick={() => scrollToSection('ai-intelligence')} className="hover:text-cyan-400 transition-colors">AI Intelligence</button>
            <button onClick={() => scrollToSection('how-it-works')} className="hover:text-cyan-400 transition-colors">How It Works</button>
            <button onClick={() => scrollToSection('alerts')} className="hover:text-cyan-400 transition-colors">Resources</button>
          </nav>

          {/* Right Action Buttons */}
          <div className="flex items-center gap-4">
            <button
              onClick={handleAction}
              className="text-sm font-semibold text-slate-300 hover:text-white transition-colors px-4 py-2 rounded-lg hover:bg-slate-900"
            >
              {isLoggedIn ? 'Dashboard' : 'Login'}
            </button>
            <button
              onClick={handleAction}
              className="text-sm font-semibold text-white bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 px-5 py-2.5 rounded-xl shadow-lg shadow-cyan-500/25 hover:shadow-cyan-500/40 transition-all flex items-center gap-2 group cursor-pointer"
            >
              <span>Get Started</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>

        </div>
      </header>

      {/* ==========================================
          2. HERO SECTION
      ========================================== */}
      <section className="relative pt-12 pb-24 lg:pt-20 lg:pb-32 overflow-hidden">
        {/* Glowing background circles */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-cyan-500/10 blur-[140px] rounded-full pointer-events-none"></div>
        <div className="absolute top-1/3 right-10 w-[400px] h-[400px] bg-blue-600/10 blur-[120px] rounded-full pointer-events-none"></div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
            
            {/* Left Column: Hero Text */}
            <div className="lg:col-span-6 text-center lg:text-left">
              
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-cyan-950/60 border border-cyan-800/60 text-cyan-300 text-xs font-semibold mb-6 shadow-inner">
                <Sparkles className="w-3.5 h-3.5 text-cyan-400 animate-spin-slow" />
                <span>Next-Gen Autonomous Fleet Operations</span>
              </div>

              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-white tracking-tight leading-[1.1] mb-6">
                Manage Smarter.<br />
                <span className="bg-gradient-to-r from-cyan-400 via-teal-300 to-blue-500 bg-clip-text text-transparent">
                  Drive Safer.
                </span><br />
                Predict Before Problems.
              </h1>

              <p className="text-base sm:text-lg text-slate-400 mb-8 max-w-xl mx-auto lg:mx-0 leading-relaxed">
                An AI-powered fleet management system that helps fleet managers monitor vehicles, drivers, trips, maintenance and compliance from one intelligent platform.
              </p>

              <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4">
                <button
                  onClick={() => scrollToSection('how-it-works')}
                  className="w-full sm:w-auto px-7 py-3.5 rounded-xl bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white font-bold text-sm shadow-xl shadow-cyan-500/20 hover:shadow-cyan-500/35 transition-all flex items-center justify-center gap-2.5 cursor-pointer"
                >
                  <span>Explore Cognifleet</span>
                  <ChevronRight className="w-4 h-4" />
                </button>

                <button
                  onClick={() => scrollToSection('ai-intelligence')}
                  className="w-full sm:w-auto px-7 py-3.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700/80 hover:border-cyan-500/50 font-bold text-sm transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Bot className="w-4 h-4 text-cyan-400" />
                  <span>See How AI Works</span>
                </button>
              </div>

              {/* Trust Badges */}
              <div className="mt-12 pt-8 border-t border-slate-800/80 flex items-center justify-center lg:justify-start gap-8 text-slate-500 text-xs font-semibold">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-cyan-400" />
                  <span>99.9% Uptime SLA</span>
                </div>
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-amber-400" />
                  <span>Real-Time Live Telemetry</span>
                </div>
                <div className="flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-emerald-400" />
                  <span>SQL AI Engine</span>
                </div>
              </div>

            </div>

            {/* Right Column: Animated Fleet Dashboard Preview */}
            <div className="lg:col-span-6 relative">
              <div className="relative rounded-2xl border border-slate-800 bg-slate-900/90 p-4 sm:p-6 shadow-2xl shadow-cyan-950/50 backdrop-blur-xl group hover:border-slate-700 transition-colors">
                
                {/* Header controls bar */}
                <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-800 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-red-500/80 inline-block"></span>
                    <span className="w-3 h-3 rounded-full bg-amber-500/80 inline-block"></span>
                    <span className="w-3 h-3 rounded-full bg-emerald-500/80 inline-block"></span>
                    <span className="text-slate-400 font-mono text-[11px] ml-2">cognifleet.ai/live-dashboard</span>
                  </div>
                  <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 text-[10px] font-bold tracking-wider uppercase border border-emerald-500/20 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                    Live Live Stream
                  </span>
                </div>

                {/* Dashboard Grid Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
                  
                  {/* Total Vehicles */}
                  <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800">
                    <div className="text-slate-400 text-[11px] font-medium flex items-center justify-between">
                      <span>Total Vehicles</span>
                      <Truck className="w-3.5 h-3.5 text-cyan-400" />
                    </div>
                    <div className="text-xl font-bold text-white mt-1">48</div>
                    <div className="text-[10px] text-emerald-400 font-semibold mt-0.5">↑ +12% active</div>
                  </div>

                  {/* Active Vehicles */}
                  <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800">
                    <div className="text-slate-400 text-[11px] font-medium flex items-center justify-between">
                      <span>Active Vehicles</span>
                      <Activity className="w-3.5 h-3.5 text-emerald-400" />
                    </div>
                    <div className="text-xl font-bold text-white mt-1">38</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">79.1% utilization</div>
                  </div>

                  {/* Available Drivers */}
                  <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800 col-span-2 sm:col-span-1">
                    <div className="text-slate-400 text-[11px] font-medium flex items-center justify-between">
                      <span>Available Drivers</span>
                      <Users className="w-3.5 h-3.5 text-blue-400" />
                    </div>
                    <div className="text-xl font-bold text-white mt-1">12</div>
                    <div className="text-[10px] text-cyan-400 mt-0.5">Ready for dispatch</div>
                  </div>

                </div>

                {/* Active Trips & Fuel Row */}
                <div className="grid grid-cols-2 gap-3 mb-4">
                  
                  {/* Active Trips */}
                  <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800">
                    <div className="text-slate-400 text-[11px] font-medium flex items-center justify-between">
                      <span>Active Trips</span>
                      <MapPin className="w-3.5 h-3.5 text-amber-400" />
                    </div>
                    <div className="text-lg font-bold text-white mt-1">24 En Route</div>
                    <div className="w-full bg-slate-800 rounded-full h-1.5 mt-2 overflow-hidden">
                      <div className="bg-gradient-to-r from-amber-500 to-emerald-400 h-full w-[85%] rounded-full animate-pulse"></div>
                    </div>
                  </div>

                  {/* Fuel Status */}
                  <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800">
                    <div className="text-slate-400 text-[11px] font-medium flex items-center justify-between">
                      <span>Fuel Status</span>
                      <Fuel className="w-3.5 h-3.5 text-cyan-400" />
                    </div>
                    <div className="text-lg font-bold text-white mt-1">88% Avg</div>
                    <div className="text-[10px] text-emerald-400 font-semibold mt-0.5">Peak Eco Efficiency</div>
                  </div>

                </div>

                {/* Maintenance Alert Pulse */}
                <div className="bg-amber-950/40 border border-amber-800/60 p-3 rounded-xl mb-4 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center">
                      <AlertTriangle className="w-4 h-4 animate-bounce" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-amber-200">Maintenance Warning</div>
                      <div className="text-[10px] text-amber-300/80">TRK-102 requires brake check in 120 km</div>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 uppercase">HIGH</span>
                </div>

                {/* AI Recommendation Floating Widget */}
                <div className="bg-gradient-to-r from-cyan-950/90 to-blue-950/90 border border-cyan-500/40 p-3.5 rounded-xl shadow-lg shadow-cyan-500/10">
                  <div className="flex items-center gap-2 mb-1.5">
                    <Sparkles className="w-4 h-4 text-cyan-400 animate-spin-slow" />
                    <span className="text-xs font-bold text-cyan-200 uppercase tracking-wider">AI Proactive Dispatch Recommendation</span>
                  </div>
                  <p className="text-xs text-slate-200 font-medium">
                    Assign <strong className="text-cyan-300">TRK-104</strong> to driver <strong className="text-cyan-300">Babu</strong> for Chennai ➔ Bangalore trip.
                  </p>
                  <div className="mt-2 flex items-center justify-between text-[10px] text-cyan-400 font-mono">
                    <span>Match Confidence: 94%</span>
                    <span>Fuel Saved: ~$180</span>
                  </div>
                </div>

              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ==========================================
          3. PROBLEM SECTION
      ========================================== */}
      <section id="solutions" className="py-24 bg-slate-900/60 border-y border-slate-800 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className="text-xs font-bold uppercase tracking-widest text-red-400 mb-3 block">Traditional Fleet Bottlenecks</span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
              Fleet Management Shouldn't Be Manual.
            </h2>
            <p className="text-slate-400 mt-4 text-sm sm:text-base">
              Traditional fleet managers waste hours dealing with scattered records, unexpected breakdowns, and compliance fines.
            </p>
          </div>

          {/* Scattered Pain Points Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
            
            {[
              { icon: FileText, title: "Manual Vehicle Records", desc: "Paper logs & messy spreadsheets lead to missing data." },
              { icon: Wrench, title: "Missed Service Dates", desc: "Forgetting routine oil checks causes major engine failures." },
              { icon: ShieldAlert, title: "Expired Driver Licenses", desc: "Sudden legal fines & compliance stops on highways." },
              { icon: Fuel, title: "Unmonitored Fuel Theft", desc: "No visibility into fuel drainages or mileage wastage." },
              { icon: Users, title: "Driver Availability Confusion", desc: "Don't know which driver is free or over their legal hours." },
              { icon: MapPin, title: "Unoptimized Trip Routes", desc: "Longer transit times & excessive wear-and-tear." },
              { icon: Activity, title: "Scattered Information", desc: "Data stored in 5 different tools with zero central vision." },
              { icon: AlertTriangle, title: "Operational Breakdown", desc: "Reactive chaos instead of proactive predictability." }
            ].map((item, idx) => {
              const Icon = item.icon;
              return (
                <div 
                  key={idx} 
                  className="bg-slate-950/60 border border-slate-800/80 p-6 rounded-2xl hover:border-red-500/40 hover:bg-slate-950 transition-all group"
                >
                  <div className="w-10 h-10 rounded-xl bg-red-950/40 border border-red-900/60 text-red-400 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                    <Icon className="w-5 h-5" />
                  </div>
                  <h3 className="text-base font-bold text-white mb-2">{item.title}</h3>
                  <p className="text-xs text-slate-400 leading-relaxed">{item.desc}</p>
                </div>
              );
            })}

          </div>

          {/* Visual Transition Diagram */}
          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6 sm:p-10 text-center relative overflow-hidden">
            <div className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-6">The Legacy Escalation Chain</div>
            
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-6 text-xs sm:text-sm font-bold">
              <div className="px-4 py-3 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 w-full sm:w-auto">
                MANUAL DATA
              </div>
              <ChevronRight className="w-5 h-5 text-slate-600 rotate-90 sm:rotate-0" />
              <div className="px-4 py-3 rounded-xl bg-slate-900 border border-slate-800 text-amber-300 w-full sm:w-auto">
                SCATTERED INFORMATION
              </div>
              <ChevronRight className="w-5 h-5 text-slate-600 rotate-90 sm:rotate-0" />
              <div className="px-4 py-3 rounded-xl bg-slate-900 border border-slate-800 text-orange-400 w-full sm:w-auto">
                MISSED ALERTS
              </div>
              <ChevronRight className="w-5 h-5 text-slate-600 rotate-90 sm:rotate-0" />
              <div className="px-4 py-3 rounded-xl bg-red-950/80 border border-red-800 text-red-300 w-full sm:w-auto">
                OPERATIONAL PROBLEMS
              </div>
            </div>

            {/* Introducing Cognifleet Banner */}
            <div className="mt-10 pt-8 border-t border-slate-800/80 flex flex-col items-center">
              <div className="text-sm font-semibold text-slate-400 mb-2">Transform your fleet operations with AI:</div>
              <div className="text-3xl font-extrabold text-white tracking-tight flex items-center gap-2">
                <span>Meet</span>
                <span className="bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">Cognifleet.</span>
              </div>
            </div>

          </div>

        </div>
      </section>

      {/* ==========================================
          4. SOLUTION SECTION (Orbit / Ecosystem)
      ========================================== */}
      <section id="products" className="py-24 relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className="text-xs font-bold uppercase tracking-widest text-cyan-400 mb-3 block">Central Unified Intelligence</span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
              One Intelligent Platform for Your Entire Fleet.
            </h2>
            <p className="text-slate-400 mt-4 text-sm sm:text-base">
              Cognifleet acts as the central brain of your fleet, bringing telemetry, AI recommendations, compliance, and drivers into a single synchronized system.
            </p>
          </div>

          {/* Ecosystem Orbit Visualization */}
          <div className="relative max-w-4xl mx-auto aspect-square sm:aspect-[16/9] flex items-center justify-center">
            
            {/* Center Glowing Hub */}
            <div className="relative z-20 w-32 h-32 sm:w-44 sm:h-44 rounded-full bg-gradient-to-tr from-cyan-600 via-blue-600 to-indigo-600 p-1 shadow-2xl shadow-cyan-500/40 flex items-center justify-center text-center animate-pulse">
              <div className="w-full h-full bg-slate-950 rounded-full flex flex-col items-center justify-center p-2">
                <Bot className="w-8 h-8 sm:w-10 sm:h-10 text-cyan-400 mb-1" />
                <span className="text-xs sm:text-sm font-extrabold text-white">Cognifleet AI</span>
                <span className="text-[9px] text-cyan-400 font-mono uppercase">Core Brain</span>
              </div>
            </div>

            {/* Orbiting Ring 1 */}
            <div className="absolute w-[280px] h-[280px] sm:w-[480px] sm:h-[480px] rounded-full border border-cyan-500/20 pointer-events-none animate-spin-slow"></div>
            
            {/* Orbiting Capability Nodes */}
            {[
              { label: "Vehicles", icon: Truck, color: "text-cyan-400", pos: "top-4 left-1/4" },
              { label: "Drivers", icon: Users, color: "text-blue-400", pos: "top-4 right-1/4" },
              { label: "Trips", icon: MapPin, color: "text-amber-400", pos: "top-1/2 -left-4 sm:left-4" },
              { label: "Maintenance", icon: Wrench, color: "text-red-400", pos: "top-1/2 -right-4 sm:right-4" },
              { label: "Fuel", icon: Fuel, color: "text-emerald-400", pos: "bottom-4 left-1/4" },
              { label: "Compliance", icon: ShieldCheck, color: "text-indigo-400", pos: "bottom-4 right-1/4" },
            ].map((node, i) => {
              const NodeIcon = node.icon;
              return (
                <div 
                  key={i} 
                  className={`absolute ${node.pos} z-30 bg-slate-900 border border-slate-700/80 px-3.5 py-2 rounded-xl shadow-xl flex items-center gap-2 hover:scale-110 hover:border-cyan-400 transition-all cursor-pointer`}
                >
                  <NodeIcon className={`w-4 h-4 ${node.color}`} />
                  <span className="text-xs font-bold text-slate-200">{node.label}</span>
                </div>
              );
            })}

          </div>

        </div>
      </section>

      {/* ==========================================
          5. AI INTELLIGENCE SECTION
      ========================================== */}
      <section id="ai-intelligence" className="py-24 bg-slate-950 border-y border-slate-800 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className="text-xs font-bold uppercase tracking-widest text-cyan-400 mb-3 block">Neural Fleet Analytics</span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
              From Fleet Data to Intelligent Decisions.
            </h2>
            <p className="text-slate-400 mt-4 text-sm sm:text-base">
              Cognifleet continuously queries your live database to generate real-time proactive recommendations with transparent explanations.
            </p>
          </div>

          {/* 8 AI Capabilities Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            
            {[
              { icon: Bot, title: "AI Driver Recommendation", desc: "Matches available drivers based on duty hours, ratings & license validity." },
              { icon: Truck, title: "AI Vehicle Recommendation", desc: "Selects optimal vehicle by load capacity, fuel economy & maintenance status." },
              { icon: Wrench, title: "Predictive Maintenance", desc: "Forecasts service limits before costly roadside breakdowns occur." },
              { icon: Fuel, title: "Fuel Prediction", desc: "Monitors consumption rate per km & identifies abnormal fuel drainages." },
              { icon: ShieldAlert, title: "Risk Detection", desc: "Alerts on driver duty-hour overages and driver license expiration timelines." },
              { icon: Compass, title: "Trip Optimization", desc: "Calculates optimal transit corridors for maximum fuel savings." },
              { icon: ShieldCheck, title: "Compliance Monitoring", desc: "Ensures 100% adherence to legal driving limits and transport rules." },
              { icon: TrendingUp, title: "Fleet Performance Analysis", desc: "Ranks vehicles by Net Profit per km & flags high-operating-cost assets." }
            ].map((card, idx) => {
              const CardIcon = card.icon;
              return (
                <div 
                  key={idx}
                  className="bg-slate-900/80 border border-slate-800 p-6 rounded-2xl hover:border-cyan-500/50 hover:bg-slate-900 transition-all group"
                >
                  <div className="w-10 h-10 rounded-xl bg-cyan-950/60 border border-cyan-800 text-cyan-400 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                    <CardIcon className="w-5 h-5" />
                  </div>
                  <h3 className="text-base font-bold text-white mb-2">{card.title}</h3>
                  <p className="text-xs text-slate-400 leading-relaxed">{card.desc}</p>
                </div>
              );
            })}

          </div>

        </div>
      </section>

      {/* ==========================================
          6. HOW IT WORKS SECTION
      ========================================== */}
      <section id="how-it-works" className="py-24 bg-slate-900/40 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className="text-xs font-bold uppercase tracking-widest text-cyan-400 mb-3 block">Step-By-Step Intelligence Flow</span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
              How Cognifleet Works.
            </h2>
            <p className="text-slate-400 mt-4 text-sm sm:text-base">
              A continuous automated pipeline from raw telemetry collection to proactive decision execution.
            </p>
          </div>

          {/* 4 Steps Interactive Storytelling */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-16">
            
            {[
              { step: "STEP 01", title: "COLLECT", desc: "Vehicle, driver and trip information enters Cognifleet via real-time API telemetry." },
              { step: "STEP 02", title: "ANALYZE", desc: "AI analyzes fleet data, calculating duty hours, fuel mileage & service thresholds." },
              { step: "STEP 03", title: "PREDICT", desc: "AI detects potential risks, license expiries & maintenance needs before they occur." },
              { step: "STEP 04", title: "RECOMMEND", desc: "Cognifleet recommends 1-click actions to maximize profitability & safety." }
            ].map((st, i) => (
              <div 
                key={i}
                onClick={() => setActiveStep(i)}
                className={`p-6 rounded-2xl border transition-all cursor-pointer ${
                  activeStep === i 
                    ? 'bg-slate-900 border-cyan-500 shadow-xl shadow-cyan-500/10' 
                    : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                }`}
              >
                <span className="text-[11px] font-extrabold font-mono text-cyan-400">{st.step}</span>
                <h3 className="text-lg font-bold text-white mt-1 mb-2">{st.title}</h3>
                <p className="text-xs text-slate-400 leading-relaxed">{st.desc}</p>
              </div>
            ))}

          </div>

          {/* Visual Flow Banner */}
          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6 text-center">
            <div className="flex flex-wrap items-center justify-center gap-3 text-xs sm:text-sm font-extrabold font-mono text-slate-300">
              <span className="px-3 py-1.5 rounded-lg bg-slate-900 text-slate-200 border border-slate-800">DATA</span>
              <ArrowRight className="w-4 h-4 text-cyan-400" />
              <span className="px-3 py-1.5 rounded-lg bg-slate-900 text-cyan-300 border border-slate-800">AI ANALYSIS</span>
              <ArrowRight className="w-4 h-4 text-cyan-400" />
              <span className="px-3 py-1.5 rounded-lg bg-slate-900 text-amber-300 border border-slate-800">PREDICTION</span>
              <ArrowRight className="w-4 h-4 text-cyan-400" />
              <span className="px-3 py-1.5 rounded-lg bg-slate-900 text-indigo-300 border border-slate-800">RECOMMENDATION</span>
              <ArrowRight className="w-4 h-4 text-cyan-400" />
              <span className="px-3 py-1.5 rounded-lg bg-cyan-600 text-white shadow-md">ACTION</span>
            </div>
          </div>

        </div>
      </section>

      {/* ==========================================
          7. AI TRIP ASSIGNMENT SECTION
      ========================================== */}
      <section className="py-24 bg-slate-950 border-y border-slate-800 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            
            <div className="lg:col-span-5">
              <span className="text-xs font-bold uppercase tracking-widest text-cyan-400 mb-3 block">Smart Dispatching Engine</span>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight mb-4">
                Automated AI Trip Assignment.
              </h2>
              <p className="text-slate-400 text-sm leading-relaxed mb-6">
                When a new cargo load is registered, Cognifleet instantly evaluates all available drivers and vehicles in the SQL database to recommend the highest-profit, safest match.
              </p>

              <div className="space-y-3 text-xs font-semibold text-slate-300">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>Eliminates manual driver calling & availability checking</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>Strictly enforces legal duty hour limitations</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>Calculates vehicle weight capacity & fuel economy</span>
                </div>
              </div>
            </div>

            {/* Interactive Scenario Card */}
            <div className="lg:col-span-7">
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl">
                
                {/* Trip Header */}
                <div className="flex items-center justify-between pb-6 mb-6 border-b border-slate-800">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-cyan-400">Incoming Shipment Order</span>
                    <h3 className="text-xl font-bold text-white mt-0.5">Chennai ➔ Bangalore</h3>
                    <p className="text-xs text-slate-400 mt-0.5">Cargo: <strong>Electronics</strong> | Weight: <strong>8 Tons</strong></p>
                  </div>
                  <span className="px-3 py-1 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-800 text-xs font-bold">
                    Priority: High
                  </span>
                </div>

                {/* AI Recommendation Box */}
                <div className="bg-slate-950 border border-cyan-500/40 rounded-xl p-5 mb-6">
                  
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-cyan-400" />
                      <span className="text-xs font-bold text-cyan-200 uppercase tracking-wider">AI Recommendation Match</span>
                    </div>
                    <span className="px-2.5 py-1 rounded bg-emerald-500/20 text-emerald-400 text-xs font-extrabold border border-emerald-500/30">
                      Match Score: 94%
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-4 text-xs">
                    <div className="bg-slate-900 p-3 rounded-lg border border-slate-800">
                      <span className="text-slate-400 block text-[10px]">RECOMMENDED DRIVER</span>
                      <strong className="text-sm text-white font-bold block mt-0.5">Babu</strong>
                      <span className="text-emerald-400 text-[10px]">7.5 hrs legal limit left</span>
                    </div>

                    <div className="bg-slate-900 p-3 rounded-lg border border-slate-800">
                      <span className="text-slate-400 block text-[10px]">RECOMMENDED VEHICLE</span>
                      <strong className="text-sm text-white font-bold block mt-0.5">TRK-104</strong>
                      <span className="text-cyan-400 text-[10px]">10T Capacity | 10.5 km/L</span>
                    </div>
                  </div>

                  {/* Checklist Reasons */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-slate-300 font-medium">
                    <div className="flex items-center gap-1.5"><Check className="w-3.5 h-3.5 text-emerald-400" /> Driver available</div>
                    <div className="flex items-center gap-1.5"><Check className="w-3.5 h-3.5 text-emerald-400" /> License valid</div>
                    <div className="flex items-center gap-1.5"><Check className="w-3.5 h-3.5 text-emerald-400" /> Working hours sufficient</div>
                    <div className="flex items-center gap-1.5"><Check className="w-3.5 h-3.5 text-emerald-400" /> Vehicle capacity matches</div>
                    <div className="flex items-center gap-1.5"><Check className="w-3.5 h-3.5 text-emerald-400" /> Fuel sufficient</div>
                    <div className="flex items-center gap-1.5"><Check className="w-3.5 h-3.5 text-emerald-400" /> Maintenance healthy</div>
                  </div>

                </div>

              </div>
            </div>

          </div>

        </div>
      </section>

      {/* ==========================================
          8. PREDICTIVE MAINTENANCE SECTION
      ========================================== */}
      <section className="py-24 bg-slate-900/50 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className="text-xs font-bold uppercase tracking-widest text-amber-400 mb-3 block">Proactive Maintenance Engine</span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
              Fix Problems Before They Stop Your Fleet.
            </h2>
            <p className="text-slate-400 mt-4 text-sm sm:text-base">
              Cognifleet tracks vehicle odometers against scheduled service thresholds to issue early maintenance warnings.
            </p>
          </div>

          {/* Maintenance Timeline Card */}
          <div className="max-w-3xl mx-auto bg-slate-950 border border-slate-800 rounded-2xl p-6 sm:p-8">
            
            <div className="flex items-center justify-between pb-6 border-b border-slate-800">
              <div>
                <span className="text-xs font-bold text-slate-400 font-mono">VEHICLE TIMELINE AUDIT</span>
                <h3 className="text-xl font-bold text-white">TRK-102</h3>
              </div>
              <span className="px-2.5 py-1 rounded bg-amber-500/20 text-amber-300 text-xs font-bold border border-amber-500/30">
                Demo / Simulated Data
              </span>
            </div>

            {/* Timeline */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 my-6">
              
              <div className="bg-slate-900 p-4 rounded-xl border border-slate-800">
                <span className="text-[10px] font-bold text-slate-500 block uppercase">LAST SERVICE</span>
                <span className="text-sm font-bold text-slate-200 block mt-1">02 May 2026</span>
                <span className="text-[10px] text-slate-400">Regular Oil Check</span>
              </div>

              <div className="bg-slate-900 p-4 rounded-xl border border-slate-800">
                <span className="text-[10px] font-bold text-slate-500 block uppercase">CURRENT STATUS</span>
                <span className="text-sm font-bold text-emerald-400 block mt-1">Healthy</span>
                <span className="text-[10px] text-slate-400">Odometer: 24,500 km</span>
              </div>

              <div className="bg-amber-950/40 p-4 rounded-xl border border-amber-800/80">
                <span className="text-[10px] font-bold text-amber-400 block uppercase">PREDICTED MAINTENANCE</span>
                <span className="text-sm font-bold text-amber-200 block mt-1">Due Soon</span>
                <span className="text-[10px] text-amber-300/80">Service in 120 km</span>
              </div>

            </div>

            {/* AI Warning Box */}
            <div className="bg-amber-950/30 border border-amber-800/60 p-4 rounded-xl flex items-center gap-3 text-xs text-amber-200">
              <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
              <span><strong>AI Warning:</strong> AI detected that TRK-102 may require maintenance soon. Pre-book service appointment before long-haul dispatch.</span>
            </div>

          </div>

        </div>
      </section>

      {/* ==========================================
          9. SMART ALERTS SECTION
      ========================================== */}
      <section id="alerts" className="py-24 bg-slate-950 border-y border-slate-800 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className="text-xs font-bold uppercase tracking-widest text-red-400 mb-3 block">Real-Time Notification Center</span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
              Smart Alerts & Incident Center.
            </h2>
            <p className="text-slate-400 mt-4 text-sm sm:text-base">
              Instant alerts keep managers informed on compliance deadlines, maintenance risks, and fuel events.
            </p>
          </div>

          {/* 5 Animated Notification Cards */}
          <div className="max-w-2xl mx-auto space-y-4">
            
            {[
              { type: "CRITICAL", title: "Driver License Expiry Soon", text: "Driver Babu's commercial license expires in 12 days.", color: "bg-red-950/60 border-red-800 text-red-200" },
              { type: "HIGH", title: "Vehicle Service Due", text: "TRK-104 has reached 10,000 km threshold.", color: "bg-amber-950/60 border-amber-800 text-amber-200" },
              { type: "MEDIUM", title: "Low Fuel Detected", text: "TRK-101 fuel level dropped below 15%.", color: "bg-orange-950/60 border-orange-800 text-orange-200" },
              { type: "HIGH", title: "Driver Working-Hour Limit", text: "Driver John Davis logged 10.2 hrs today (11.0 hr limit).", color: "bg-amber-950/60 border-amber-800 text-amber-200" },
              { type: "CRITICAL", title: "Maintenance Overdue", text: "TRK-102 service is overdue by 350 km.", color: "bg-red-950/60 border-red-800 text-red-200" }
            ].map((alert, idx) => (
              <div 
                key={idx}
                className={`p-4 rounded-xl border flex items-center justify-between transition-all hover:scale-[1.01] ${alert.color}`}
              >
                <div className="flex items-center gap-3">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <div>
                    <div className="text-xs font-bold">{alert.title}</div>
                    <div className="text-[11px] opacity-80">{alert.text}</div>
                  </div>
                </div>
                <span className="text-[10px] font-extrabold px-2 py-0.5 rounded bg-slate-900/80 uppercase tracking-wider">
                  {alert.type}
                </span>
              </div>
            ))}

          </div>

        </div>
      </section>

      {/* ==========================================
          10. AI ASSISTANT SECTION
      ========================================== */}
      <section className="py-24 bg-slate-900/40 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className="text-xs font-bold uppercase tracking-widest text-cyan-400 mb-3 block">Conversational Fleet Q&A</span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
              Ask Your Fleet. Get Intelligent Answers.
            </h2>
            <p className="text-slate-400 mt-4 text-sm sm:text-base">
              Query your fleet database using natural language. Cognifleet AI answers with exact SQL quantitative facts.
            </p>
          </div>

          {/* Large Chatbot Interface Preview */}
          <div className="max-w-3xl mx-auto bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
            
            {/* Header */}
            <div className="bg-slate-900 px-6 py-4 border-b border-slate-800 flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-cyan-600 flex items-center justify-center text-white font-bold">
                <Bot className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white">Cognifleet AI Live Q&A Assistant</h4>
                <span className="text-[10px] text-emerald-400 font-mono">Connected to Live SQL Database</span>
              </div>
            </div>

            {/* Chat Body */}
            <div className="p-6 space-y-4 text-xs font-sans">
              
              {/* User Q1 */}
              <div className="flex justify-end">
                <div className="bg-cyan-600 text-white p-3 rounded-xl rounded-tr-none max-w-md font-medium">
                  Which vehicles need maintenance?
                </div>
              </div>

              {/* AI A1 */}
              <div className="flex justify-start">
                <div className="bg-slate-900 border border-slate-800 text-slate-200 p-4 rounded-xl rounded-tl-none max-w-lg leading-relaxed">
                  <div className="font-bold text-cyan-400 mb-1 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5" /> Cognifleet AI:
                  </div>
                  3 vehicles require maintenance within the next 7 days:
                  <ul className="list-disc list-inside mt-2 space-y-1 text-slate-300">
                    <li><strong>TRK-104</strong>: Overdue by 610 km (Critical)</li>
                    <li><strong>TRK-102</strong>: Service due in 120 km</li>
                    <li><strong>TRK-101</strong>: Oil inspection recommended</li>
                  </ul>
                </div>
              </div>

              {/* User Q2 */}
              <div className="flex justify-end">
                <div className="bg-cyan-600 text-white p-3 rounded-xl rounded-tr-none max-w-md font-medium">
                  Which driver is available for a 10-ton trip?
                </div>
              </div>

              {/* AI A2 */}
              <div className="flex justify-start">
                <div className="bg-slate-900 border border-slate-800 text-slate-200 p-4 rounded-xl rounded-tl-none max-w-lg leading-relaxed">
                  <div className="font-bold text-cyan-400 mb-1 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5" /> Cognifleet AI:
                  </div>
                  <strong>Babu</strong> is currently available with 7.5 legal driving hours remaining, and <strong>TRK-104</strong> (10-ton capacity) is the best matching vehicle.
                </div>
              </div>

            </div>

          </div>

        </div>
      </section>

      {/* ==========================================
          11. FLEET DASHBOARD PREVIEW SECTION
      ========================================== */}
      <section className="py-24 bg-slate-950 border-t border-slate-800 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          
          <span className="text-xs font-bold uppercase tracking-widest text-cyan-400 mb-3 block">Product Experience</span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight mb-4">
            Built for Modern Fleet Operations Managers.
          </h2>
          <p className="text-slate-400 text-sm sm:text-base max-w-2xl mx-auto mb-12">
            Get full operational command over vehicles, drivers, loads, and financial analytics.
          </p>

          {/* Large Dashboard Screenshot Mockup */}
          <div className="relative max-w-5xl mx-auto rounded-2xl border border-slate-800 bg-slate-900 p-4 shadow-2xl overflow-hidden group hover:border-slate-700 transition-colors">
            
            <div className="bg-slate-950 rounded-xl p-6 text-left space-y-6">
              
              {/* Header */}
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <div>
                  <h3 className="text-lg font-bold text-white">Cognifleet Manager Command Center</h3>
                  <span className="text-xs text-slate-400">Live Operating Status</span>
                </div>
                <button
                  onClick={handleAction}
                  className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs shadow-md cursor-pointer"
                >
                  Explore Dashboard
                </button>
              </div>

              {/* Metrics Row */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                <div className="bg-slate-900 p-4 rounded-xl border border-slate-800">
                  <span className="text-slate-400 block">Fleet Revenue</span>
                  <strong className="text-xl font-bold text-white mt-1 block">$96,600.00</strong>
                </div>
                <div className="bg-slate-900 p-4 rounded-xl border border-slate-800">
                  <span className="text-slate-400 block">Fuel Cost</span>
                  <strong className="text-xl font-bold text-white mt-1 block">$23,674.00</strong>
                </div>
                <div className="bg-slate-900 p-4 rounded-xl border border-slate-800">
                  <span className="text-slate-400 block">Net Profit</span>
                  <strong className="text-xl font-bold text-emerald-400 mt-1 block">$66,676.00</strong>
                </div>
                <div className="bg-slate-900 p-4 rounded-xl border border-slate-800">
                  <span className="text-slate-400 block">Fleet Utilization</span>
                  <strong className="text-xl font-bold text-cyan-400 mt-1 block">79.1%</strong>
                </div>
              </div>

            </div>

          </div>

        </div>
      </section>

      {/* ==========================================
          12. FINAL CTA SECTION
      ========================================== */}
      <section className="py-24 bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 border-t border-slate-800 relative">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          
          <div className="w-16 h-16 rounded-2xl bg-cyan-600/20 border border-cyan-500/40 text-cyan-400 flex items-center justify-center mx-auto mb-6">
            <Truck className="w-8 h-8" />
          </div>

          <h2 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight leading-tight mb-4">
            Turn Your Fleet Data Into Smarter Decisions.
          </h2>

          <p className="text-slate-400 text-base sm:text-lg max-w-2xl mx-auto mb-8 leading-relaxed">
            With Cognifleet, fleet management moves from manual tracking to intelligent decision-making.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={handleAction}
              className="w-full sm:w-auto px-8 py-4 rounded-xl bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white font-extrabold text-base shadow-xl shadow-cyan-500/25 hover:shadow-cyan-500/40 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>Get Started Now</span>
              <ArrowRight className="w-5 h-5" />
            </button>

            <button
              onClick={handleAction}
              className="w-full sm:w-auto px-8 py-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 font-extrabold text-base transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>Explore Dashboard</span>
            </button>
          </div>

        </div>
      </section>

      {/* ==========================================
          13. FOOTER
      ========================================== */}
      <footer className="py-12 bg-slate-950 border-t border-slate-800 text-xs text-slate-400">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-12">
            
            <div className="md:col-span-1">
              <div className="flex items-center gap-2.5 mb-3">
                <div className="w-7 h-7 rounded-lg bg-cyan-600 flex items-center justify-center text-white font-bold">
                  CF
                </div>
                <span className="font-bold text-lg text-white">Cognifleet</span>
              </div>
              <p className="text-slate-500 leading-relaxed text-[11px]">
                AI-Powered Smart Fleet Management System.
              </p>
            </div>

            <div>
              <h5 className="font-bold text-white uppercase text-[10px] tracking-widest mb-3">Products</h5>
              <ul className="space-y-2 text-slate-400">
                <li><button onClick={() => scrollToSection('products')} className="hover:text-cyan-400">Fleet Operations</button></li>
                <li><button onClick={() => scrollToSection('ai-intelligence')} className="hover:text-cyan-400">AI Intelligence Engine</button></li>
                <li><button onClick={() => scrollToSection('how-it-works')} className="hover:text-cyan-400">Smart Dispatcher</button></li>
              </ul>
            </div>

            <div>
              <h5 className="font-bold text-white uppercase text-[10px] tracking-widest mb-3">Solutions</h5>
              <ul className="space-y-2 text-slate-400">
                <li><button onClick={() => scrollToSection('solutions')} className="hover:text-cyan-400">Predictive Maintenance</button></li>
                <li><button onClick={() => scrollToSection('alerts')} className="hover:text-cyan-400">Compliance & Duty Hours</button></li>
                <li><button onClick={() => scrollToSection('solutions')} className="hover:text-cyan-400">Profitability Analytics</button></li>
              </ul>
            </div>

            <div>
              <h5 className="font-bold text-white uppercase text-[10px] tracking-widest mb-3">Legal</h5>
              <ul className="space-y-2 text-slate-400">
                <li><a href="#" className="hover:text-cyan-400">Privacy Policy</a></li>
                <li><a href="#" className="hover:text-cyan-400">Terms of Service</a></li>
                <li><a href="#" className="hover:text-cyan-400">Security & SLA</a></li>
              </ul>
            </div>

          </div>

          <div className="pt-8 border-t border-slate-900 flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] text-slate-600">
            <div>© 2026 CogniFleet Operating System. All rights reserved.</div>
            <div className="flex items-center gap-6">
              <span>Manage Smarter. Drive Safer. Predict Before Problems.</span>
            </div>
          </div>

        </div>
      </footer>

    </div>
  );
}
