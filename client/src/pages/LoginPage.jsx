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
                        -webkit-text-fill-color: #1f2937 !important; /* text-gray-800 */
                        transition: background-color 5000s ease-in-out 0s;
                        box-shadow: inset 0 0 0 1000px rgba(255, 255, 255, 0.5) !important;
                        -webkit-box-shadow: inset 0 0 0 1000px rgba(255, 255, 255, 0.5) !important;
                        border-radius: 9999px !important;
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
                <div
                    className="p-8 pb-24 w-full max-w-md relative z-20 backdrop-blur-xl border border-white/40"
                    style={{
                        borderRadius: '30px',
                        background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.1), rgba(255, 255, 255, 0))',
                        boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.37), inset 0 0 30px rgba(255, 255, 255, 0.3), inset 0 0 10px rgba(255, 255, 255, 0.5)',
                        borderTop: '1px solid rgba(255, 255, 255, 0.8)',
                        borderLeft: '1px solid rgba(255, 255, 255, 0.8)',
                        overflow: 'hidden' // For the shine effect
                    }}
                >
                    {/* Shine Effect */}
                    <div className="absolute top-0 left-0 w-full h-full pointer-events-none"
                        style={{
                            background: 'linear-gradient(45deg, transparent 40%, rgba(255, 255, 255, 0.3) 50%, transparent 60%)',
                            transform: 'translateX(-100%)',
                            animation: 'shine 4s infinite'
                        }}
                    />
                    <style>
                        {`
                          @keyframes shine {
                            0% { transform: translateX(-150%) skewX(-15deg); }
                            20% { transform: translateX(150%) skewX(-15deg); }
                            100% { transform: translateX(150%) skewX(-15deg); }
                          }
                        `}
                    </style>
                    <div className="text-center mb-8">
                        <div className="flex flex-col items-center justify-center mb-4">
                            <img src="/login-logo.png" alt="Global Knowledge" className="h-20 w-auto object-contain mb-4" />
                            <h2 className="text-2xl font-bold text-gray-800 tracking-wide whitespace-nowrap">Global Knowledge Technologies</h2>
                        </div>
                    </div>

                    {error && (
                        <div className="bg-red-500/20 border border-red-400/50 text-red-100 px-4 py-3 rounded-lg mb-4 text-sm backdrop-blur-sm">
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit}>
                        <div className="mb-8">
                            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 z-10 pointer-events-none">
                                    <Mail size={18} />
                                </span>
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="w-full pl-10 pr-4 py-3 bg-white/50 border border-gray-200 rounded-full focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50 outline-none transition text-gray-800 placeholder-gray-500/70 backdrop-blur-sm relative shadow-inner"
                                    placeholder="name@company.com"
                                    required
                                />
                            </div>
                        </div>

                        <div className="mb-14">
                            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 z-10 pointer-events-none">
                                    <Lock size={18} />
                                </span>
                                <input
                                    type={showPassword ? "text" : "password"}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full pl-10 pr-12 py-3 bg-white/50 border border-gray-200 rounded-full focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50 outline-none transition text-gray-800 placeholder-gray-500/70 backdrop-blur-sm relative shadow-inner"
                                    placeholder="••••••••"
                                    required
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 transition z-10 focus:outline-none"
                                >
                                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                            </div>
                        </div>

                        <button
                            type="submit"
                            className="w-2/3 mx-auto block bg-gradient-to-b from-gray-700 to-gray-900 hover:from-gray-600 hover:to-gray-800 text-white font-bold py-3 rounded-full transition-all duration-300 transform hover:scale-[1.02] hover:shadow-[0_0_20px_rgba(0,0,0,0.2)] shadow-lg active:scale-95"
                        >
                            Login
                        </button >
                    </form >
                </div >
            </div >
        </>
    );
};

export default LoginPage;


