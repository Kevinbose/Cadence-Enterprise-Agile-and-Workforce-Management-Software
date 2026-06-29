import React, { useState } from 'react';
import { useSelector } from 'react-redux';
import { Shield, Key, Mail, User as UserIcon, BadgeCheck, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';
import Layout from '../components/Layout/Layout';
import { changePasswordRequest } from '../features/auth/authService';

const Profile = () => {
  const { user } = useSelector((state) => state.auth);

  // Form States
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Modal State
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);

  const handleOpenConfirm = (e) => {
    e.preventDefault();
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast.error('All password fields are required.');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('New passwords do not match.');
      return;
    }
    if (newPassword.length < 6) {
      toast.error('New password must be at least 6 characters.');
      return;
    }
    setIsConfirmOpen(true);
  };

  const handlePasswordSubmit = async () => {
    setIsConfirmOpen(false);
    setIsSubmitting(true);
    try {
      const res = await changePasswordRequest(currentPassword, newPassword);
      if (res.success) {
        toast.success('Password updated successfully!');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        toast.error(res.message || 'Failed to update password.');
      }
    } catch (error) {
      toast.error(
        error.response?.data?.message || error.message || 'An error occurred. Please try again.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Layout pageTitle="User Profile">
      <div className="mx-auto max-w-4xl space-y-6">
        {/* Profile Card Header */}
        <div className="relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
          <div className="absolute right-0 top-0 -mr-6 -mt-6 h-36 w-36 rounded-full bg-blue-50/50" />
          <div className="flex flex-col sm:flex-row items-center gap-5 relative z-10">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-tr from-[#0052CC] to-[#0747A6] text-2xl font-bold text-white shadow-md">
              {user?.name ? user.name.split(' ').map(n => n[0]).join('') : 'U'}
            </div>
            <div className="text-center sm:text-left min-w-0 flex-1">
              <h1 className="text-xl font-bold text-[#172B4D] tracking-tight">{user?.name}</h1>
              <p className="text-sm font-medium text-[#6B778C]">{user?.jobTitle || 'Team Contributor'}</p>
              
              <div className="mt-3.5 flex flex-wrap justify-center sm:justify-start gap-2.5">
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-[#E3FCEF] px-3 py-1 text-xs font-bold uppercase tracking-wider text-[#006644] border border-[#ABF5D1]">
                  <BadgeCheck className="h-3.5 w-3.5" />
                  {user?.employeeId}
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-[#DEEBFF] px-3 py-1 text-xs font-bold uppercase tracking-wider text-[#0747A6] border border-[#B3D4FF]">
                  <Shield className="h-3.5 w-3.5" />
                  {user?.systemRole}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Info Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Account Details Card */}
          <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm space-y-4">
            <h2 className="text-base font-bold text-[#172B4D] flex items-center gap-2 pb-2 border-b border-slate-100">
              <UserIcon className="h-4 w-4 text-[#0052CC]" />
              Account Details
            </h2>

            <div className="space-y-4 pt-1">
              <div>
                <label className="text-xs font-extrabold uppercase tracking-widest text-[#6B778C]">Corporate Email</label>
                <div className="mt-1 flex items-center gap-2 text-sm text-[#172B4D] bg-[#FAFBFC] p-3 rounded-xl border border-slate-100 font-medium">
                  <Mail className="h-4 w-4 text-[#8993A4]" />
                  {user?.email}
                </div>
              </div>

              <div>
                <label className="text-xs font-extrabold uppercase tracking-widest text-[#6B778C]">Organization Scope</label>
                <div className="mt-1 flex flex-col gap-2.5 text-sm text-[#172B4D] bg-[#FAFBFC] p-3 rounded-xl border border-slate-100 font-medium">
                  <div className="flex justify-between">
                    <span className="text-[#6B778C] text-xs">Team Identity</span>
                    <span className="font-semibold text-xs">Team #{user?.teamId || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between border-t border-slate-200/60 pt-2">
                    <span className="text-[#6B778C] text-xs">Reports To ID</span>
                    <span className="font-semibold text-xs">{user?.managerId ? `User #${user.managerId}` : 'None (Executive)'}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Change Password Card */}
          <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
            <h2 className="text-base font-bold text-[#172B4D] flex items-center gap-2 pb-2 border-b border-slate-100 mb-4">
              <Key className="h-4 w-4 text-[#DE350B]" />
              Authentication Credentials
            </h2>

            <form onSubmit={handleOpenConfirm} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-[#172B4D] block mb-1">Current Password</label>
                <input
                  type="password"
                  placeholder="Enter current password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm outline-none transition focus:border-[#0052CC] focus:ring-2 focus:ring-[#0052CC]/10"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-[#172B4D] block mb-1">New Password</label>
                <input
                  type="password"
                  placeholder="At least 6 characters"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm outline-none transition focus:border-[#0052CC] focus:ring-2 focus:ring-[#0052CC]/10"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-[#172B4D] block mb-1">Confirm New Password</label>
                <input
                  type="password"
                  placeholder="Re-enter new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm outline-none transition focus:border-[#0052CC] focus:ring-2 focus:ring-[#0052CC]/10"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full flex justify-center items-center gap-2 rounded-xl bg-[#0052CC] text-white py-2.5 text-sm font-semibold hover:bg-[#0747A6] active:bg-[#0052CC] transition-all disabled:opacity-50 cursor-pointer shadow-sm mt-5"
              >
                Update Password
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* Confirmation Dialog Box */}
      {isConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-[2.5px] animate-fade-in">
          <div className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xl animate-scale-up">
            <div className="flex items-center gap-3 text-[#DE350B] mb-3">
              <div className="p-2 rounded-xl bg-rose-50 text-rose-600">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <h3 className="text-base font-bold text-[#172B4D]">Confirm Credentials Update</h3>
            </div>
            
            <p className="text-xs font-medium text-[#6B778C] leading-relaxed mb-6">
              Are you sure you want to update your corporate authentication password? You will be prompted to use this new credential next time you authenticate.
            </p>

            <div className="flex justify-end gap-3.5">
              <button
                onClick={() => setIsConfirmOpen(false)}
                className="px-4 py-2 text-xs font-bold text-[#42526E] rounded-xl hover:bg-slate-100 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handlePasswordSubmit}
                className="px-4 py-2 text-xs font-bold text-white bg-[#0052CC] rounded-xl hover:bg-[#0747A6] transition cursor-pointer"
              >
                Confirm Update
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
};

export default Profile;
