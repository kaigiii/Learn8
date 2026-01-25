import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { User, Settings, Award, Clock, BookOpen, Star, Shield, LogOut, Phone, Mail, Hash, Edit, Trash2, ChevronLeft, AlertTriangle } from 'lucide-react';
import { useAuthStore } from '@/stores/useAuthStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { authService } from '@/features/auth/api/authService';

interface ProfileViewProps {
    onClose: () => void;
}

type ViewMode = 'view' | 'edit' | 'delete_confirm' | 'top_up';

export function ProfileView({ onClose }: ProfileViewProps) {
    const { user, logout, refreshUser } = useAuthStore();
    const [viewMode, setViewMode] = useState<ViewMode>('view');
    const [deleteConfirmation, setDeleteConfirmation] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);

    // Form State
    const [editForm, setEditForm] = useState({
        full_name: '',
        phone_number: '',
        job_title: '',
        education_level: '',
    });

    // Mock Stats
    const stats = [
        { label: "Courses Completed", value: "12", icon: BookOpen, color: "text-blue-500", bg: "bg-blue-50" },
        { label: "Study Hours", value: "48h", icon: Clock, color: "text-green-500", bg: "bg-green-50" },
        { label: "Achievements", value: "5", icon: Award, color: "text-orange-500", bg: "bg-orange-50" },
        { label: "Avg. Score", value: "92%", icon: Star, color: "text-purple-500", bg: "bg-purple-50" },
    ];

    const handlePurchase = async (amount: number) => {
        setIsProcessing(true);
        try {
            // Mock API call to top up credits
            await authService.credits.topUp(amount);
            await refreshUser();

            // Wait a bit to show state
            setTimeout(() => {
                setIsProcessing(false);
                setViewMode('view');
                alert(`Top-up successful! Added ${amount} credits.`); // Simple feedback for now
            }, 500);
        } catch (e) {
            alert("Top-up failed");
            setIsProcessing(false);
        }
    };

    const handleDeleteAccount = async () => {
        if (deleteConfirmation !== 'DELETE') return;

        try {
            await authService.me.delete();
            logout();
            window.location.href = '/login';
        } catch (e: any) {
            alert("Failed to delete account: " + e.message);
        }
    };

    const handleStartEdit = () => {
        setEditForm({
            full_name: user?.full_name || '',
            phone_number: user?.phone_number || '',
            job_title: user?.job_title || '',
            education_level: user?.education_level || '',
        });
        setViewMode('edit');
    };

    const handleSaveEdit = async () => {
        try {
            await authService.me.update(editForm);
            await refreshUser();
            setViewMode('view');
        } catch (e: any) {
            alert("Failed to update profile: " + e.message);
        }
    };

    const creditPackages = [
        { credits: 100, price: "$9.99", label: "Starter", color: "bg-slate-50 border-slate-200" },
        { credits: 500, price: "$39.99", label: "Popular", color: "bg-blue-50 border-blue-200 ring-2 ring-blue-100", popular: true },
        { credits: 1200, price: "$89.99", label: "Best Value", color: "bg-purple-50 border-purple-200", badge: "20% OFF" },
    ];

    // --- Sub-Views ---

    const renderTopUpView = () => (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col gap-6"
        >
            <div className="flex items-center gap-2 mb-2">
                <Button variant="ghost" size="sm" onClick={() => setViewMode('view')} className="p-0 hover:bg-transparent text-slate-500 hover:text-slate-800">
                    <ChevronLeft className="w-5 h-5 mr-1" /> Back
                </Button>
                <h2 className="text-2xl font-bold text-slate-800">Top-Up Center</h2>
            </div>

            <div className="w-full bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col items-center justify-center gap-2">
                <span className="text-slate-500 text-sm font-medium uppercase tracking-wider">Current Balance</span>
                <div className="flex items-center gap-2 text-4xl font-black text-slate-800">
                    <span className="text-blue-500">💎</span> {user?.credits || 0}
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {creditPackages.map((pkg) => (
                    <div
                        key={pkg.credits}
                        className={`relative rounded-xl p-6 border-2 flex flex-col items-center gap-4 cursor-pointer transition-all hover:-translate-y-1 hover:shadow-lg ${pkg.color}`}
                        onClick={() => !isProcessing && handlePurchase(pkg.credits)}
                    >
                        {pkg.popular && (
                            <div className="absolute -top-3 bg-blue-500 text-white px-3 py-1 rounded-full text-xs font-bold shadow-sm">
                                MOST POPULAR
                            </div>
                        )}
                        {pkg.badge && (
                            <div className="absolute -top-3 bg-green-500 text-white px-3 py-1 rounded-full text-xs font-bold shadow-sm">
                                {pkg.badge}
                            </div>
                        )}

                        <div className="mt-2 text-center">
                            <h3 className="text-lg font-bold text-slate-700">{pkg.label}</h3>
                            <div className="text-3xl font-black text-slate-900 my-2">{pkg.credits} <span className="text-lg font-normal text-slate-500">Credits</span></div>
                            <div className="text-lg font-semibold text-slate-600">{pkg.price}</div>
                        </div>

                        <Button
                            className={`w-full ${pkg.popular ? "bg-blue-600 hover:bg-blue-700" : "bg-slate-900 hover:bg-slate-800"}`}
                            disabled={isProcessing}
                        >
                            {isProcessing ? "Processing..." : "Purchase"}
                        </Button>
                    </div>
                ))}
            </div>

            <div className="text-center text-xs text-slate-400 mt-4">
                Secure payment processing. Purchases are non-refundable. <br />
                Need help? Contact support@learna.ai
            </div>
        </motion.div>
    );

    const renderEditView = () => (
        <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex flex-col gap-6"
        >
            <div className="flex items-center gap-2 mb-4">
                <Button variant="ghost" size="sm" onClick={() => setViewMode('view')} className="p-0 hover:bg-transparent text-slate-500 hover:text-slate-800">
                    <ChevronLeft className="w-5 h-5 mr-1" /> Back
                </Button>
                <h2 className="text-2xl font-bold text-slate-800">Edit Profile</h2>
            </div>

            <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm space-y-6 max-w-2xl mx-auto w-full">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                        <Label className="text-slate-600">Full Name</Label>
                        <Input
                            value={editForm.full_name}
                            onChange={e => setEditForm(prev => ({ ...prev, full_name: e.target.value }))}
                            placeholder="John Doe"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label className="text-slate-600">Phone Number</Label>
                        <Input
                            value={editForm.phone_number}
                            onChange={e => setEditForm(prev => ({ ...prev, phone_number: e.target.value }))}
                            placeholder="+1 234 567 890"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label className="text-slate-600">Job Title / Role</Label>
                        <Input
                            value={editForm.job_title}
                            onChange={e => setEditForm(prev => ({ ...prev, job_title: e.target.value }))}
                            placeholder="Software Engineer"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label className="text-slate-600">Education Level</Label>
                        <Input
                            value={editForm.education_level}
                            onChange={e => setEditForm(prev => ({ ...prev, education_level: e.target.value }))}
                            placeholder="Bachelor's Degree"
                        />
                    </div>
                </div>

                <div className="pt-6 flex items-center justify-end gap-3 border-t border-slate-100">
                    <Button variant="ghost" onClick={() => setViewMode('view')}>Cancel</Button>
                    <Button onClick={handleSaveEdit} className="bg-blue-600 hover:bg-blue-700 min-w-[120px]">
                        Save Changes
                    </Button>
                </div>
            </div>
        </motion.div>
    );

    const renderDeleteView = () => (
        <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center justify-center h-full max-w-lg mx-auto text-center gap-6"
        >
            <div className="w-20 h-20 rounded-full bg-red-100 flex items-center justify-center text-red-500 mb-2">
                <AlertTriangle className="w-10 h-10" />
            </div>

            <div className="space-y-2">
                <h2 className="text-3xl font-bold text-slate-800">Delete Account?</h2>
                <p className="text-slate-500">
                    This action is <span className="font-bold text-red-500">permanent</span>.
                    All your courses, progress, and credits will be wiped immediately.
                </p>
            </div>

            <div className="w-full bg-white p-6 rounded-xl border border-red-100 shadow-sm space-y-4">
                <Label className="block text-left mb-1 text-slate-600">Type <span className="font-mono font-bold text-slate-800">DELETE</span> to confirm</Label>
                <Input
                    value={deleteConfirmation}
                    onChange={e => setDeleteConfirmation(e.target.value)}
                    placeholder="DELETE"
                    className="border-red-200 focus-visible:ring-red-500"
                />

                <div className="flex gap-3 pt-2">
                    <Button variant="outline" className="flex-1" onClick={() => {
                        setViewMode('view');
                        setDeleteConfirmation('');
                    }}>
                        Cancel
                    </Button>
                    <Button
                        disabled={deleteConfirmation !== 'DELETE'}
                        onClick={handleDeleteAccount}
                        className="flex-1 bg-red-600 hover:bg-red-700 text-white disabled:opacity-50"
                    >
                        Confirm Delete
                    </Button>
                </div>
            </div>
        </motion.div>
    );

    const renderMainView = () => (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col gap-8"
        >
            {/* Top Section: Personal Info Card */}
            <div className="w-full bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden relative">
                {/* Gradient Banner */}
                <div className="h-32 bg-gradient-to-r from-blue-600 to-indigo-700"></div>

                <div className="px-8 pb-8 flex flex-col md:flex-row items-center md:items-end -mt-12 gap-6">
                    {/* Avatar */}
                    <div className="w-32 h-32 rounded-full p-1.5 bg-white shadow-lg z-10">
                        <div className="w-full h-full rounded-full bg-slate-100 flex items-center justify-center text-slate-400 text-4xl font-bold text-indigo-500">
                            {user?.email ? user.email.charAt(0).toUpperCase() : <User className="w-12 h-12" />}
                        </div>
                    </div>

                    {/* Name & Basic Info */}
                    <div className="flex-1 text-center md:text-left mb-2 space-y-1">
                        <h2 className="text-3xl font-bold text-slate-900">{user?.full_name || user?.email?.split('@')[0] || "User"}</h2>
                        <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 text-slate-500 text-sm">
                            <span className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded font-medium border border-indigo-100">
                                {user?.job_title || "Learner"}
                            </span>
                            <div className="flex items-center gap-1">
                                <Hash className="w-3 h-3" /> ID: {user?.id || "-"}
                            </div>
                            <div className="flex items-center gap-1">
                                <Mail className="w-3 h-3" /> {user?.email || "No Email"}
                            </div>
                            <div className="flex items-center gap-1">
                                <Phone className="w-3 h-3" /> {user?.phone_number || "Not linked"}
                            </div>
                        </div>
                    </div>

                    {/* Actions (Logout / Credits) */}
                    <div className="flex flex-col gap-3 min-w-[200px] mb-2">
                        <div className="flex items-center justify-between bg-slate-50 p-3 rounded-lg border border-slate-100">
                            <div className="flex items-center gap-2">
                                <span className="text-xl">💎</span>
                                <span className="font-bold text-slate-800 text-lg">{user?.credits ?? 0}</span>
                            </div>
                            <Button size="sm" onClick={() => setViewMode('top_up')} className="h-8 bg-blue-600 hover:bg-blue-700 text-xs">
                                Top Up
                            </Button>
                        </div>
                        <Button variant="outline" size="sm" className="w-full text-slate-600 hover:text-red-600 border-slate-200" onClick={logout}>
                            <LogOut className="w-3 h-3 mr-2" /> Sign Out
                        </Button>
                    </div>
                </div>
            </div>

            {/* Bottom Section: Function Area (Stats + Settings) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Learning Stats */}
                <div className="space-y-4">
                    <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                        <Award className="w-5 h-5 text-indigo-500" /> Learning Overview
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                        {stats.map((stat) => (
                            <motion.div
                                whileHover={{ y: -2 }}
                                key={stat.label}
                                className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col items-center justify-center gap-2"
                            >
                                <div className={`p-3 rounded-full ${stat.bg}`}>
                                    <stat.icon className={`w-6 h-6 ${stat.color}`} />
                                </div>
                                <div className="text-2xl font-bold text-slate-800">{stat.value}</div>
                                <div className="text-xs text-slate-500 font-medium uppercase tracking-wide text-center">{stat.label}</div>
                            </motion.div>
                        ))}
                    </div>
                </div>

                {/* Settings */}
                <div className="space-y-4">
                    <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                        <Settings className="w-5 h-5 text-indigo-500" /> Account Settings
                    </h3>
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm divide-y divide-slate-100">
                        {/* Settings Items */}
                        <div className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors cursor-pointer group">
                            <div className="flex items-center gap-4">
                                <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 group-hover:bg-blue-50 group-hover:text-blue-500 transition-colors">
                                    <Shield className="w-5 h-5" />
                                </div>
                                <div>
                                    <h4 className="font-medium text-slate-800">Preferences</h4>
                                    <p className="text-sm text-slate-500">Language, Theme, Notifications</p>
                                </div>
                            </div>
                            <Button variant="ghost" size="sm" className="text-slate-400 group-hover:text-blue-600">Manage</Button>
                        </div>

                        <div className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors cursor-pointer group" onClick={handleStartEdit}>
                            <div className="flex items-center gap-4">
                                <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 group-hover:bg-blue-50 group-hover:text-blue-500 transition-colors">
                                    <Edit className="w-5 h-5" />
                                </div>
                                <div>
                                    <h4 className="font-medium text-slate-800">Edit Personal Info</h4>
                                    <p className="text-sm text-slate-500">Name, Phone, Bio</p>
                                </div>
                            </div>
                            <Button variant="ghost" size="sm" className="text-slate-400 group-hover:text-blue-600">Edit</Button>
                        </div>

                        {/* Delete Account */}
                        <div
                            className="p-4 flex items-center justify-between hover:bg-red-50/50 transition-colors cursor-pointer group"
                            onClick={() => setViewMode('delete_confirm')}
                        >
                            <div className="flex items-center gap-4">
                                <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center text-red-500 group-hover:bg-red-100 transition-colors">
                                    <Trash2 className="w-5 h-5" />
                                </div>
                                <div>
                                    <h4 className="font-medium text-red-600">Delete Account</h4>
                                    <p className="text-sm text-red-400">Permanently delete data</p>
                                </div>
                            </div>
                            <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700 hover:bg-red-100">Delete</Button>
                        </div>
                    </div>
                </div>
            </div>
        </motion.div>
    );

    return (
        <div className="flex flex-col h-full bg-slate-50 overflow-y-auto w-full">
            <div className="max-w-5xl mx-auto w-full p-8 h-full">
                <AnimatePresence mode="wait">
                    {viewMode === 'view' && (
                        <motion.div key="view" exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }}>
                            {renderMainView()}
                        </motion.div>
                    )}
                    {viewMode === 'top_up' && (
                        <motion.div key="top_up" exit={{ opacity: 0, y: 20 }} transition={{ duration: 0.2 }}>
                            {renderTopUpView()}
                        </motion.div>
                    )}
                    {viewMode === 'edit' && (
                        <motion.div key="edit" exit={{ opacity: 0, x: 20 }} transition={{ duration: 0.2 }}>
                            {renderEditView()}
                        </motion.div>
                    )}
                    {viewMode === 'delete_confirm' && (
                        <motion.div key="delete" exit={{ opacity: 0, scale: 0.9 }} transition={{ duration: 0.2 }} className="h-full">
                            {renderDeleteView()}
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}
