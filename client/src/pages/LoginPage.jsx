import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Lock, Mail, Eye, EyeOff } from 'lucide-react';

const LoginPage = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const { login } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const userData = await login(email, password);
            // Redirect based on user role
            if (userData.role === 'Director') navigate('/dashboard/businesshead');
            else if (userData.role === 'Sales Manager') navigate('/dashboard/manager');
            else if (userData.role === 'Sales Executive') navigate('/dashboard/executive');
            else if (userData.role === 'Delivery Team') navigate('/dashboard/delivery');
            else if (userData.role === 'Finance') navigate('/finance/dashboard');
            else navigate('/');
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to login');
        }
    };

    return (
        <>
            <style>
                {`
                    input:-webkit-autofill,
                    input:-webkit-autofill:hover,
                    input:-webkit-autofill:focus,
                    input:-webkit-autofill:active {
                        -webkit-background-clip: text;
                        -webkit-text-fill-color: white;
                        transition: background-color 5000s ease-in-out 0s;
                        box-shadow: inset 0 25px 20px -10px rgba(255, 255, 255, 0.15), inset 0 -25px 20px -10px rgba(0, 0, 0, 0.6), inset 0 0 0 1000px rgba(0, 0, 0, 0.1);
                        border: 1px solid rgba(255, 255, 255, 0.2);
                    }
                    /* Hide default password reveal button in Edge/IE */
                    input::-ms-reveal,
                    input::-ms-clear {
                        display: none;
                    }
                `}
            </style>
            <div className="min-h-screen flex items-center justify-end pr-8 relative overflow-hidden" style={{ backgroundColor: '#e3e3e3' }}>
                {/* Background Video */}
                <video
                    autoPlay
                    loop
                    muted
                    playsInline
                    className="absolute top-0 left-0 w-full h-full object-cover z-0"
                    style={{ transform: 'translateX(-15%)' }}
                >
                    <source src="/login-bg.mp4" type="video/mp4" />
                </video>

                {/* Overlay for better readability */}
                <div className="absolute top-0 left-0 w-full h-full bg-black/5 z-10"></div>

                {/* Login Card - Glassmorphism Container */}
                <div className="p-8 pb-24 w-full max-w-md relative z-20 bg-gray-600/30 backdrop-blur-md rounded-3xl shadow-2xl border border-white/20">
                    <div className="text-center mb-8">
                        <div className="flex flex-col items-center justify-center mb-4">
                            <img src="/login-logo.png" alt="Global Knowledge" className="h-20 w-auto object-contain mb-4" />
                            <h2 className="text-2xl font-bold text-white tracking-wide whitespace-nowrap">Global Knowledge Technologies</h2>
                        </div>
                    </div>

                    {error && (
                        <div className="bg-red-500/20 border border-red-400/50 text-red-100 px-4 py-3 rounded-lg mb-4 text-sm backdrop-blur-sm">
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit}>
                        <div className="mb-8">
                            <label className="block text-sm font-medium text-white mb-1">Email</label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/70 z-10 pointer-events-none">
                                    <Mail size={18} />
                                </span>
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="w-full pl-10 pr-4 py-3 bg-gradient-to-b from-white/10 to-black/60 rounded-full focus:ring-2 focus:ring-white/20 focus:border-white/30 outline-none transition text-white placeholder-white/40 backdrop-blur-sm relative shadow-lg"
                                    placeholder="name@company.com"
                                    required
                                />
                            </div>
                        </div>

                        <div className="mb-14">
                            <label className="block text-sm font-medium text-white mb-1">Password</label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/70 z-10 pointer-events-none">
                                    <Lock size={18} />
                                </span>
                                <input
                                    type={showPassword ? "text" : "password"}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full pl-10 pr-12 py-3 bg-gradient-to-b from-white/10 to-black/60 rounded-full focus:ring-2 focus:ring-white/20 focus:border-white/30 outline-none transition text-white placeholder-white/40 backdrop-blur-sm relative shadow-lg"
                                    placeholder="••••••••"
                                    required
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/70 hover:text-white/90 transition z-10 focus:outline-none"
                                >
                                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                            </div>
                        </div>

                        <button
                            type="submit"
                            className="w-2/3 mx-auto block bg-gradient-to-b from-white/10 to-black/60 hover:from-white/20 hover:to-black/50 text-white font-bold py-3 rounded-full transition-all duration-300 transform hover:scale-[1.02] hover:shadow-[0_0_20px_rgba(255,255,255,0.2)] backdrop-blur-sm shadow-lg active:scale-95"
                        >
                            sign in

                        </button >
                    </form >
                </div >
            </div >
        </>
    );
};

export default LoginPage;


