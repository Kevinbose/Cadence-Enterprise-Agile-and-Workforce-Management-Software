import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { Lock, Eye, EyeOff } from 'lucide-react';
import {
  loginUser,
  clearAuthError,
} from '../features/auth/authSlice';

const roleRedirectMap = {
  Employee: '/employee',
  'Admin/Manager': '/manager',
};

const Login = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { isLoading, error, isAuthenticated, user } = useSelector(
    (state) => state.auth
  );

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    return () => {
      dispatch(clearAuthError());
    };
  }, [dispatch]);

  useEffect(() => {
    if (isAuthenticated && user) {
      if (user.systemRole === 'SuperAdmin') {
        navigate('/create-team', { replace: true });
        return;
      }
      const destination = roleRedirectMap[user.systemRole] || '/employee';
      navigate(destination, { replace: true });
    }
  }, [isAuthenticated, user, navigate]);

  const handleSubmit = (event) => {
    event.preventDefault();
    dispatch(loginUser({ email: email.trim(), password }));
  };

  return (
    <div className="dot-grid-bg flex min-h-screen items-center justify-center bg-[#F4F5F7] px-4 py-12">
      <div className="w-full max-w-md animate-fadeInUp">
        {/* ── Yakkay Blue Top Accent Bar ── */}
        <div className="h-1 rounded-t-xl bg-[#0B89C9]" />

        {/* ── Card Body ── */}
        <div className="rounded-b-xl border border-t-0 border-[#DFE1E6] bg-white px-8 pb-8 pt-8 shadow-xl shadow-slate-200/50">
          {/* ── Header ── */}
          <header className="mb-8 text-center">
            <img
              src="/Yakkay-logo.png"
              alt="Yakkay Tech"
              className="mx-auto mb-4 h-14 object-contain drop-shadow-sm"
            />
            <h1 className="text-2xl font-bold text-[#172B4D]">
              Log in to your account
            </h1>
            <p className="mt-1.5 text-sm text-[#6B778C]">
              Enter your corporate credentials to access the Agile workspace
            </p>
          </header>

          {/* ── Error Banner ── */}
          {error && (
            <div
              className="mb-5 flex items-start gap-2.5 rounded-lg border border-[#FFBDAD] bg-[#FFEBE6] p-3.5 text-sm text-[#DE350B]"
              role="alert"
            >
              <svg
                className="mt-0.5 h-4 w-4 flex-shrink-0"
                viewBox="0 0 16 16"
                fill="currentColor"
                aria-hidden="true"
              >
                <path
                  fillRule="evenodd"
                  d="M8 1.5a6.5 6.5 0 100 13 6.5 6.5 0 000-13zM0 8a8 8 0 1116 0A8 8 0 010 8zm9-3a1 1 0 00-2 0v3.5a1 1 0 002 0V5zm-1 7a1 1 0 100-2 1 1 0 000 2z"
                  clipRule="evenodd"
                />
              </svg>
              <span>{error}</span>
            </div>
          )}

          {/* ── Form ── */}
          <form onSubmit={handleSubmit} className="space-y-5" autoComplete="off" noValidate>
            {/* Email Field */}
            <div>
              <label
                htmlFor="email"
                className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[#172B4D]"
              >
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="off"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="block w-full rounded-lg border border-[#DFE1E6] bg-[#FAFBFC] p-3 text-sm text-[#172B4D] placeholder:text-[#A5ADBA] outline-none transition-all duration-200 focus:border-[#35A062] focus:bg-white focus:ring-2 focus:ring-[#35A062]/20"
                placeholder="you@yakkaytech.com"
              />
            </div>

            {/* Password Field */}
            <div>
              <label
                htmlFor="password"
                className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[#172B4D]"
              >
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="block w-full rounded-lg border border-[#DFE1E6] bg-[#FAFBFC] p-3 pr-10 text-sm text-[#172B4D] placeholder:text-[#A5ADBA] outline-none transition-all duration-200 focus:border-[#35A062] focus:bg-white focus:ring-2 focus:ring-[#35A062]/20"
                  placeholder="Enter your password"
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

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#35A062] to-[#0B89C9] px-5 py-4 text-base font-bold text-white shadow-lg shadow-[#35A062]/20 transition-all duration-300 hover:from-[#2E8B55] hover:to-[#0A75A8] hover:shadow-xl hover:shadow-[#0B89C9]/25 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isLoading ? (
                <>
                  <svg
                    className="h-5 w-5 animate-spin"
                    viewBox="0 0 24 24"
                    fill="none"
                    aria-hidden="true"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="3"
                    />
                    <path
                      className="opacity-100"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                  Authenticating...
                </>
              ) : (
                'Log in'
              )}
            </button>
          </form>

          {/* ── Footer ── */}
          <div className="mt-8 flex items-center justify-center gap-1.5 text-xs text-[#6B778C]">
            <Lock className="h-3.5 w-3.5 text-[#35A062]" aria-hidden="true" />
            <span>
              Enterprise Grade Security Gate&nbsp;•&nbsp;Yakkay Tech internal
              use only
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
