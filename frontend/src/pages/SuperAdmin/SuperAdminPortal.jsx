import React, { useState, useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import axios from 'axios';
import { Eye, EyeOff } from 'lucide-react';
import { logoutUser } from '../../features/auth/authSlice';
import API_BASE_URL from '../../config/api';

const SuperAdminPortal = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  // Active tab: 'manager' or 'employee'
  const [activeTab, setActiveTab] = useState('manager');

  // Form states
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('Manager@123'); // pre-fill placeholder
  const [showPassword, setShowPassword] = useState(false);
  const [teamId, setTeamId] = useState('');
  const [jobTitle, setJobTitle] = useState('');

  // Dropdown list for employee assign department
  const [teams, setTeams] = useState([]);
  const [loadingTeams, setLoadingTeams] = useState(false);

  // Whenever tab changes, update default password and clear fields
  useEffect(() => {
    setFullName('');
    setEmail('');
    setJobTitle('');
    setTeamId('');
    if (activeTab === 'manager') {
      setPassword('Manager@123');
    } else {
      setPassword('Employee@123');
    }
  }, [activeTab]);

  // Fetch teams on mount
  useEffect(() => {
    const fetchTeams = async () => {
      setLoadingTeams(true);
      try {
        const token = localStorage.getItem('token');
        const response = await axios.get(`${API_BASE_URL}/provision/teams`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        setTeams(response.data);
      } catch (error) {
        console.error('Failed to fetch teams', error);
        toast.error('Failed to load existing teams');
      } finally {
        setLoadingTeams(false);
      }
    };

    fetchTeams();
  }, []);

  const handleSignOut = () => {
    dispatch(logoutUser());
    navigate('/login');
    toast.success('Logged out successfully.');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!fullName || !email || !password || !jobTitle) {
      toast.error('Please fill in all required fields.');
      return;
    }

    if (activeTab === 'manager' && !teamId) {
      toast.error('Please assign a Team ID for the Manager.');
      return;
    }

    if (activeTab === 'employee' && !teamId) {
      toast.error('Please assign a department for the Employee.');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const payload = {
        fullName,
        email,
        password,
        systemRole: activeTab === 'manager' ? 'Admin/Manager' : 'Employee',
        teamId: parseInt(teamId, 10),
        jobTitle,
      };

      await axios.post(`${API_BASE_URL}/provision/identity`, payload, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      toast.success('Account provisioned successfully.');

      // Clear inputs
      setFullName('');
      setEmail('');
      setJobTitle('');
      setTeamId('');
      setPassword(activeTab === 'manager' ? 'Manager@123' : 'Employee@123');

      // Refresh teams list
      const response = await axios.get(`${API_BASE_URL}/provision/teams`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      setTeams(response.data);
    } catch (error) {
      const errorMsg = error.response?.data?.message || 'Provisioning failed.';
      toast.error(errorMsg);
    }
  };

  return (
    <div className="dot-grid-bg flex min-h-screen flex-col bg-[#F4F5F7]">
      {/* ── Navbar ── */}
      <nav className="flex items-center justify-between border-b border-[#DFE1E6] bg-white px-6 py-4 shadow-sm">
        <div className="flex items-center gap-3">
          <img src="/Yakkay-logo.png" alt="Yakkay Logo" className="h-9 object-contain" />
          <div className="h-6 w-[1px] bg-[#DFE1E6]" />
          <span className="text-xs font-bold uppercase tracking-widest text-[#6B778C]">
            [ IT Infrastructure Console ]
          </span>
        </div>
        <button
          onClick={handleSignOut}
          className="rounded-lg border border-[#DE350B]/30 px-4 py-2 text-sm font-semibold text-[#DE350B] transition-colors duration-200 hover:bg-[#FFEBE6] hover:border-[#DE350B]"
        >
          Sign Out
        </button>
      </nav>

      {/* ── Main Container ── */}
      <div className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-xl animate-fadeInUp">
          {/* Blue Top Accent Bar */}
          <div className="h-1 rounded-t-xl bg-[#0B89C9]" />

          {/* Card Body */}
          <div className="rounded-b-xl border border-t-0 border-[#DFE1E6] bg-white p-8 shadow-xl shadow-slate-200/50">
            <h2 className="mb-2 text-2xl font-bold text-[#172B4D]">
              Identity & Access Provisioning
            </h2>
            <p className="mb-6 text-sm text-[#6B778C]">
              Create new user identities in the air-gapped environment.
            </p>

            {/* Tab Switcher */}
            <div className="mb-8 grid grid-cols-2 gap-2 rounded-lg bg-[#F4F5F7] p-1">
              <button
                type="button"
                onClick={() => setActiveTab('manager')}
                className={`rounded-md py-2.5 text-sm font-semibold transition-all duration-200 ${
                  activeTab === 'manager'
                    ? 'bg-white text-[#0B89C9] shadow-sm'
                    : 'text-[#6B778C] hover:text-[#172B4D]'
                }`}
              >
                Provision Manager
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('employee')}
                className={`rounded-md py-2.5 text-sm font-semibold transition-all duration-200 ${
                  activeTab === 'employee'
                    ? 'bg-white text-[#0B89C9] shadow-sm'
                    : 'text-[#6B778C] hover:text-[#172B4D]'
                }`}
              >
                Provision Employee
              </button>
            </div>

            {/* Provisioning Form */}
            <form onSubmit={handleSubmit} className="space-y-5" autoComplete="off" noValidate>
              {/* Full Name */}
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[#172B4D]">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="block w-full rounded-lg border border-[#DFE1E6] bg-[#FAFBFC] p-3 text-sm text-[#172B4D] placeholder:text-[#A5ADBA] outline-none transition-all duration-200 focus:border-[#0B89C9] focus:bg-white focus:ring-2 focus:ring-[#0B89C9]/20"
                  placeholder="e.g. John Doe"
                />
              </div>

              {/* Corporate Email */}
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[#172B4D]">
                  Corporate Email
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="block w-full rounded-lg border border-[#DFE1E6] bg-[#FAFBFC] p-3 text-sm text-[#172B4D] placeholder:text-[#A5ADBA] outline-none transition-all duration-200 focus:border-[#0B89C9] focus:bg-white focus:ring-2 focus:ring-[#0B89C9]/20"
                  placeholder="e.g. jdoe@yakkaytech.com"
                />
              </div>

              {/* Temporary Password */}
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[#172B4D]">
                  Temporary Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="block w-full rounded-lg border border-[#DFE1E6] bg-[#FAFBFC] p-3 pr-10 text-sm text-[#172B4D] outline-none transition-all duration-200 focus:border-[#0B89C9] focus:bg-white focus:ring-2 focus:ring-[#0B89C9]/20"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6B778C] hover:text-[#172B4D] focus:outline-none"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>

              {/* Tab Specific Fields */}
              {activeTab === 'manager' ? (
                <>
                  {/* Assign New Team ID */}
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[#172B4D]">
                      Assign New Team ID
                    </label>
                    <input
                      type="number"
                      required
                      min="1"
                      value={teamId}
                      onChange={(e) => setTeamId(e.target.value)}
                      className="block w-full rounded-lg border border-[#DFE1E6] bg-[#FAFBFC] p-3 text-sm text-[#172B4D] placeholder:text-[#A5ADBA] outline-none transition-all duration-200 focus:border-[#0B89C9] focus:bg-white focus:ring-2 focus:ring-[#0B89C9]/20"
                      placeholder="e.g. 3"
                    />
                  </div>

                  {/* Executive Job Title */}
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[#172B4D]">
                      Executive Job Title
                    </label>
                    <input
                      type="text"
                      required
                      value={jobTitle}
                      onChange={(e) => setJobTitle(e.target.value)}
                      className="block w-full rounded-lg border border-[#DFE1E6] bg-[#FAFBFC] p-3 text-sm text-[#172B4D] placeholder:text-[#A5ADBA] outline-none transition-all duration-200 focus:border-[#0B89C9] focus:bg-white focus:ring-2 focus:ring-[#0B89C9]/20"
                      placeholder="e.g. Engineering Director"
                    />
                  </div>
                </>
              ) : (
                <>
                  {/* Assign to Department (Select Dropdown) */}
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[#172B4D]">
                      Assign to Department
                    </label>
                    <select
                      value={teamId}
                      required
                      onChange={(e) => setTeamId(e.target.value)}
                      className="block w-full rounded-lg border border-[#DFE1E6] bg-[#FAFBFC] p-3 text-sm text-[#172B4D] outline-none transition-all duration-200 focus:border-[#0B89C9] focus:bg-white focus:ring-2 focus:ring-[#0B89C9]/20"
                    >
                      <option value="">-- Select Team --</option>
                      {teams.map((t) => (
                        <option key={t.teamId} value={t.teamId}>
                          Team {t.teamId} ({t.managerName})
                        </option>
                      ))}
                    </select>
                    {loadingTeams && (
                      <span className="mt-1 block text-xs text-[#6B778C]">
                        Loading teams...
                      </span>
                    )}
                  </div>

                  {/* Staff Designation */}
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[#172B4D]">
                      Staff Designation
                    </label>
                    <input
                      type="text"
                      required
                      value={jobTitle}
                      onChange={(e) => setJobTitle(e.target.value)}
                      className="block w-full rounded-lg border border-[#DFE1E6] bg-[#FAFBFC] p-3 text-sm text-[#172B4D] placeholder:text-[#A5ADBA] outline-none transition-all duration-200 focus:border-[#0B89C9] focus:bg-white focus:ring-2 focus:ring-[#0B89C9]/20"
                      placeholder="e.g. Senior Frontend Engineer"
                    />
                  </div>
                </>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                className="mt-6 flex w-full items-center justify-center rounded-xl bg-gradient-to-r from-[#0B89C9] to-[#0A89CD] px-5 py-4 text-base font-bold text-white shadow-lg shadow-[#0B89C9]/20 transition-all duration-300 hover:from-[#0A75A8] hover:to-[#096CA0] active:scale-[0.98]"
              >
                Authorize Identity
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SuperAdminPortal;
