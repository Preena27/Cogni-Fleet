import React, { useState } from 'react';
import { useAppContext } from '../App';
import { Truck, Shield, User, Lock, ArrowRight, Mail, Phone, Building } from 'lucide-react';

export default function LoginPage() {
  const { setIsLoggedIn, setCurrentUser, setRole, addToast } = useAppContext();
  const [selectedRole, setSelectedRole] = useState<'manager' | 'driver'>('manager');
  const [isSignUp, setIsSignUp] = useState(false);
  
  // Sign In Form States
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('admin');
  
  // Manager Sign Up Form States
  const [signupName, setSignupName] = useState('');
  const [signupCompany, setSignupCompany] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPhone, setSignupPhone] = useState('');
  const [signupUsername, setSignupUsername] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupConfirmPassword, setSignupConfirmPassword] = useState('');
  
  const [loading, setLoading] = useState(false);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('http://localhost:8000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, role: selectedRole })
      });
      if (res.ok) {
        const data = await res.json();
        
        // Save token to localStorage
        localStorage.setItem("token", data.access_token);
        localStorage.setItem("role", data.role);
        localStorage.setItem("username", data.username);
        localStorage.setItem("userId", String(data.id));
        
        addToast("Authentication Successful", `Welcome back, ${data.username}!`, "success");
        setRole(data.role);
        
        setCurrentUser({
          username: data.username,
          role: data.role,
          id: data.id
        });
        
        setIsLoggedIn(true);
      } else {
        const errData = await res.json();
        addToast("Authentication Failed", errData.detail || "Incorrect credentials.", "error");
      }
    } catch (err) {
      console.error(err);
      addToast("Server Connection Failed", "Make sure python backend server is running.", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleSignUpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (signupPassword !== signupConfirmPassword) {
      addToast("Validation Error", "Passwords do not match.", "warning");
      return;
    }
    
    setLoading(true);
    try {
      const payload = {
        username: signupUsername,
        password: signupPassword,
        role: 'manager',
        email: signupEmail,
        full_name: signupName,
        company_name: signupCompany,
        phone: signupPhone
      };
      
      const res = await fetch('http://localhost:8000/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      if (res.ok) {
        // Automatically perform login
        const loginRes = await fetch('http://localhost:8000/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: signupUsername, password: signupPassword, role: 'manager' })
        });
        
        if (loginRes.ok) {
          const loginData = await loginRes.json();
          localStorage.setItem("token", loginData.access_token);
          localStorage.setItem("role", loginData.role);
          localStorage.setItem("username", loginData.username);
          localStorage.setItem("userId", String(loginData.id));
          
          addToast("Manager Registered & Authenticated", `Welcome, ${loginData.username}! Directing to dashboard...`, "success");
          setRole(loginData.role);
          setCurrentUser({
            username: loginData.username,
            role: loginData.role,
            id: loginData.id
          });
          setIsLoggedIn(true);
        } else {
          addToast("Registration Successful", "Manager account created. Please sign in.", "success");
          setUsername(signupUsername);
          setPassword('');
          setIsSignUp(false);
        }
      } else {
        const errData = await res.json();
        addToast("Registration Failed", errData.detail || "Could not register user.", "error");
      }
    } catch (err) {
      console.error(err);
      addToast("Connection Error", "Server could not be reached.", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleQuickSelect = (role: 'manager' | 'driver', user: string, pass: string) => {
    setSelectedRole(role);
    setIsSignUp(false);
    setUsername(user);
    setPassword(pass);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-4 font-sans selection:bg-primary-100">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-soft-lg overflow-hidden flex flex-col gap-5 p-6 md:p-8 animate-scale-in">
        
        {/* Brand Header */}
        <div className="text-center flex flex-col items-center gap-2">
          <div className="w-12 h-12 rounded-xl bg-primary-600 flex items-center justify-center text-white font-extrabold text-lg shadow-md">
            CF
          </div>
          <h2 className="text-xl font-extrabold text-slate-800 dark:text-slate-100 tracking-tight">
            {isSignUp ? "Create Manager Account" : "CogniFleet Portal Login"}
          </h2>
          <p className="text-xs text-slate-400">Production AI Fleet Operations Operating System</p>
        </div>

        {/* Form selection tabs (hidden in Sign Up mode) */}
        {!isSignUp && (
          <div className="grid grid-cols-2 gap-2 bg-slate-100 dark:bg-slate-850 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => handleQuickSelect('manager', 'admin', 'admin')}
              className={`py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                selectedRole === 'manager' 
                  ? 'bg-white dark:bg-slate-900 text-primary-600 dark:text-primary-400 shadow-soft-sm' 
                  : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              <Shield className="w-3.5 h-3.5" />
              Manager Portal
            </button>
            <button
              type="button"
              onClick={() => handleQuickSelect('driver', 'driver1', 'driver')}
              className={`py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                selectedRole === 'driver' 
                  ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-450 shadow-soft-sm' 
                  : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              <Truck className="w-3.5 h-3.5" />
              Driver Mobile App
            </button>
          </div>
        )}

        {/* Credentials / Signup Form */}
        {isSignUp ? (
          <form onSubmit={handleSignUpSubmit} className="flex flex-col gap-3 text-xs">
            <div className="flex flex-col gap-1.5">
              <label className="font-semibold text-slate-500">Full Name</label>
              <div className="relative flex items-center">
                <User className="w-4 h-4 text-slate-400 absolute left-3" />
                <input
                  type="text" required placeholder="e.g., Sarah Collins"
                  value={signupName} onChange={e => setSignupName(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-transparent focus:outline-none focus:border-primary-500 font-sans"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="font-semibold text-slate-500">Company Name</label>
              <div className="relative flex items-center">
                <Building className="w-4 h-4 text-slate-400 absolute left-3" />
                <input
                  type="text" required placeholder="e.g., Collins Transport"
                  value={signupCompany} onChange={e => setSignupCompany(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-transparent focus:outline-none focus:border-primary-500 font-sans"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="flex flex-col gap-1.5">
                <label className="font-semibold text-slate-500">Email Address</label>
                <div className="relative flex items-center">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3" />
                  <input
                    type="email" required placeholder="name@company.com"
                    value={signupEmail} onChange={e => setSignupEmail(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-transparent focus:outline-none focus:border-primary-500 font-sans"
                  />
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="font-semibold text-slate-500">Phone Number</label>
                <div className="relative flex items-center">
                  <Phone className="w-4 h-4 text-slate-400 absolute left-3" />
                  <input
                    type="tel" required placeholder="+1 (555) 123-4567"
                    value={signupPhone} onChange={e => setSignupPhone(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-transparent focus:outline-none focus:border-primary-500 font-sans"
                  />
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="font-semibold text-slate-500">Username</label>
              <div className="relative flex items-center">
                <User className="w-4 h-4 text-slate-400 absolute left-3" />
                <input
                  type="text" required placeholder="Desired username"
                  value={signupUsername} onChange={e => setSignupUsername(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-transparent focus:outline-none focus:border-primary-500 font-sans"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="flex flex-col gap-1.5">
                <label className="font-semibold text-slate-500">Password</label>
                <div className="relative flex items-center">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3" />
                  <input
                    type="password" required placeholder="••••••••"
                    value={signupPassword} onChange={e => setSignupPassword(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-transparent focus:outline-none focus:border-primary-500 font-sans"
                  />
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="font-semibold text-slate-500">Confirm Password</label>
                <div className="relative flex items-center">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3" />
                  <input
                    type="password" required placeholder="••••••••"
                    value={signupConfirmPassword} onChange={e => setSignupConfirmPassword(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-transparent focus:outline-none focus:border-primary-500 font-sans"
                  />
                </div>
              </div>
            </div>

            <button
              type="submit" disabled={loading}
              className="w-full py-2.5 mt-2 rounded-lg font-bold text-white shadow-soft-sm flex items-center justify-center gap-1.5 transition-all text-xs bg-primary-600 hover:bg-primary-700 cursor-pointer"
            >
              {loading ? "Registering..." : "Create Manager Account"}
              <ArrowRight className="w-4 h-4" />
            </button>
            
            <button
              type="button"
              onClick={() => setIsSignUp(false)}
              className="text-center text-primary-600 dark:text-primary-400 hover:underline mt-2 cursor-pointer font-semibold"
            >
              Already have an account? Sign In
            </button>
          </form>
        ) : (
          <form onSubmit={handleLoginSubmit} className="flex flex-col gap-4 text-xs">
            <div className="flex flex-col gap-1.5">
              <label className="font-semibold text-slate-500">Username / ID</label>
              <div className="relative flex items-center">
                <User className="w-4 h-4 text-slate-400 absolute left-3" />
                <input
                  type="text"
                  required
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  placeholder={selectedRole === 'manager' ? "e.g., admin or sarah.c" : "e.g., driver1"}
                  className="w-full pl-9 pr-4 py-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-transparent focus:outline-none focus:border-primary-500 font-sans"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="font-semibold text-slate-500">Password</label>
              <div className="relative flex items-center">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-9 pr-4 py-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-transparent focus:outline-none focus:border-primary-500 font-sans"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className={`w-full py-2.5 rounded-lg font-bold text-white shadow-soft-sm flex items-center justify-center gap-1.5 transition-all text-xs cursor-pointer ${
                loading 
                  ? 'bg-slate-400 cursor-not-allowed' 
                  : selectedRole === 'manager' 
                    ? 'bg-primary-600 hover:bg-primary-700' 
                    : 'bg-emerald-600 hover:bg-emerald-700'
              }`}
            >
              {loading ? "Verifying..." : "Authenticate Session"}
              <ArrowRight className="w-4 h-4" />
            </button>
            
            {selectedRole === 'manager' && (
              <button
                type="button"
                onClick={() => setIsSignUp(true)}
                className="text-center text-primary-600 dark:text-primary-400 hover:underline cursor-pointer font-semibold"
              >
                Don't have a manager account? Sign Up
              </button>
            )}
          </form>
        )}

        {/* Quick Credentials Sandbox Helpers (hidden in Sign Up mode) */}
        {!isSignUp && (
          <div className="border-t border-slate-100 dark:border-slate-800 pt-4 flex flex-col gap-2.5">
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Sandbox Quick Credentials</span>
            <div className="flex flex-col gap-1.5">
              <button
                type="button"
                onClick={() => handleQuickSelect('manager', 'admin', 'admin')}
                className="w-full p-2.5 rounded-lg border text-left flex justify-between hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-all cursor-pointer border-slate-100 dark:border-slate-800"
              >
                <div>
                  <p className="font-bold text-[10px] text-slate-700 dark:text-slate-350">Manager Default</p>
                  <p className="text-[9px] text-slate-400 mt-0.5">Admin Operations Control Room</p>
                </div>
                <span className="font-mono text-[9px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 font-bold self-center">admin / admin</span>
              </button>
              <button
                type="button"
                onClick={() => handleQuickSelect('driver', 'driver1', 'driver')}
                className="w-full p-2.5 rounded-lg border text-left flex justify-between hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-all cursor-pointer border-slate-100 dark:border-slate-800"
              >
                <div>
                  <p className="font-bold text-[10px] text-slate-700 dark:text-slate-350">Driver 1: John Davis</p>
                  <p className="text-[9px] text-slate-400 mt-0.5">Assigned Semi-Truck TRK-101</p>
                </div>
                <span className="font-mono text-[9px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 font-bold self-center">driver1 / driver</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
