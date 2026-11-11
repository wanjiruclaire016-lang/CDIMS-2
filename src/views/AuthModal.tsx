import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { UserRole } from '../types';
import { MACHAKOS_SUB_COUNTIES } from '../utils/machakosData';
import { X, Sprout, ShieldCheck, Mail, Lock, Phone, User, Loader2, AlertCircle, UserCheck } from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose }) => {
  const { signInWithGoogle, signInWithEmail, signUpWithEmail, sendPasswordReset } = useAuth();
  const { t, language } = useLanguage();

  const [mode, setMode] = useState<'signin' | 'signup_farmer' | 'signup_officer'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [subCounty, setSubCounty] = useState('Machakos Town');
  const [ward, setWard] = useState('Machakos Central');
  const [officerIdNumber, setOfficerIdNumber] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const currentWards = MACHAKOS_SUB_COUNTIES.find((s) => s.name === subCounty)?.wards || [];

  const handleSubCountyChange = (sc: string) => {
    setSubCounty(sc);
    const wards = MACHAKOS_SUB_COUNTIES.find((s) => s.name === sc)?.wards || [];
    if (wards.length > 0) setWard(wards[0]);
  };

  const handleGoogleAuth = async () => {
    setSubmitting(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const targetRole: UserRole = mode === 'signup_officer' ? 'officer' : 'farmer';
      await signInWithGoogle(targetRole, officerIdNumber, subCounty);
      onClose();
    } catch (err: unknown) {
      console.error('Google auth error:', err);
      const code = (err as { code?: string })?.code || '';
      const rawMsg = err instanceof Error ? err.message : String(err);

      if (code === 'auth/popup-blocked' || rawMsg.includes('popup-blocked')) {
        setErrorMsg(
          language === 'sw'
            ? 'Dirisha ibukizi limezuiwa na kivinjari chako. Tafadhali ruhusu madirisha ibukizi, au ingia kwa barua pepe na nenosiri hapa chini.'
            : 'Pop-up blocked by browser. Please allow pop-ups or sign in with Email & Password below.'
        );
      } else if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
        setErrorMsg(
          language === 'sw'
            ? 'Kuingia kwa Google kumesitishwa kabla ya kukamilika.'
            : 'Google sign-in pop-up was closed before completion.'
        );
      } else {
        setErrorMsg(rawMsg || 'Authentication failed');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email.trim()) {
      setErrorMsg(
        language === 'sw'
          ? 'Tafadhali andika barua pepe yako kwanza ili upate kiungo cha kubadilisha nenosiri.'
          : 'Please enter your email address first to receive a password reset link.'
      );
      return;
    }
    setSubmitting(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      await sendPasswordReset(email.trim());
      setSuccessMsg(
        language === 'sw'
          ? `Kiungo cha kubadilisha nenosiri kimetumwa kwa ${email.trim()}.`
          : `Password reset link sent to ${email.trim()}. Please check your email inbox.`
      );
    } catch (err: unknown) {
      console.error('Password reset error:', err);
      setErrorMsg(err instanceof Error ? err.message : 'Could not send reset email.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setErrorMsg(null);

    try {
      if (mode === 'signin') {
        await signInWithEmail(email, password);
        onClose();
      } else {
        const isOfficer = mode === 'signup_officer';
        if (isOfficer && !officerIdNumber.trim()) {
          setErrorMsg(
            language === 'sw'
              ? 'Tafadhali ingiza nambari yako ya kitambulisho cha afisa kilimo.'
              : 'Please enter your National ID or Extension Staff Number.'
          );
          setSubmitting(false);
          return;
        }

        await signUpWithEmail(
          email,
          password,
          fullName.trim(),
          phone.trim(),
          isOfficer ? 'officer' : 'farmer',
          subCounty,
          ward,
          isOfficer ? officerIdNumber.trim() : undefined,
          language
        );
        onClose();
      }
    } catch (err: unknown) {
      console.error('Auth error:', err);
      const msg = err instanceof Error ? err.message : 'Authentication failed';
      if (msg.includes('user-not-found') || msg.includes('wrong-password') || msg.includes('invalid-credential')) {
        setErrorMsg(language === 'sw' ? 'Barua pepe au nenosiri sio sahihi.' : 'Invalid email or password.');
      } else if (msg.includes('email-already-in-use')) {
        setErrorMsg(language === 'sw' ? 'Barua pepe hii tayari inatumika. Tafadhali ingia.' : 'Email is already in use. Please sign in instead.');
      } else if (msg.includes('weak-password')) {
        setErrorMsg(language === 'sw' ? 'Nenosiri linapaswa kuwa na herufi angalau 6.' : 'Password must be at least 6 characters.');
      } else {
        setErrorMsg(msg);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs overflow-y-auto">
      <div className="bg-[#FBFAF5] rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl border border-[#E7E2D5] my-8 animate-in fade-in zoom-in-95 duration-150">
        {/* Top Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[#E7E2D5] mb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#0F4A2F] text-white flex items-center justify-center shrink-0 shadow-sm">
              <Sprout className="w-5 h-5 text-[#2BC55B]" />
            </div>
            <div>
              <h3 className="font-heading font-black text-lg text-[#0F4A2F] leading-tight">
                CDIMS
              </h3>
              <p className="text-xs text-[#52665C]">CropCare Centre, Machakos</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-full flex items-center justify-center text-[#52665C] hover:bg-[#EAE5D9] hover:text-[#0F4A2F] transition-all"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab switchers */}
        <div className="grid grid-cols-3 gap-1 p-1 bg-[#EAE5D9] rounded-2xl mb-5 text-xs font-bold text-[#2B3A33]">
          <button
            type="button"
            onClick={() => {
              setMode('signin');
              setErrorMsg(null);
            }}
            className={`min-h-[44px] py-2 rounded-xl transition-all ${
              mode === 'signin' ? 'bg-[#FBFAF5] text-[#0F4A2F] shadow-sm font-extrabold' : 'hover:text-[#0F4A2F]'
            }`}
          >
            {language === 'sw' ? 'Ingia' : 'Sign In'}
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('signup_farmer');
              setErrorMsg(null);
            }}
            className={`min-h-[44px] py-2 rounded-xl transition-all flex items-center justify-center gap-1.5 ${
              mode === 'signup_farmer' ? 'bg-[#FBFAF5] text-[#0F4A2F] shadow-sm font-extrabold' : 'hover:text-[#0F4A2F]'
            }`}
          >
            <Sprout className="w-3.5 h-3.5 text-[#2BC55B]" />
            <span>{language === 'sw' ? 'Mkulima' : 'Farmer'}</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('signup_officer');
              setErrorMsg(null);
            }}
            className={`min-h-[44px] py-2 rounded-xl transition-all flex items-center justify-center gap-1.5 ${
              mode === 'signup_officer' ? 'bg-[#FBFAF5] text-[#0F4A2F] shadow-sm font-extrabold' : 'hover:text-[#0F4A2F]'
            }`}
          >
            <UserCheck className="w-3.5 h-3.5 text-[#2BC55B]" />
            <span>{language === 'sw' ? 'Afisa' : 'Officer'}</span>
          </button>
        </div>

        {/* Officer Notice */}
        {mode === 'signup_officer' && (
          <div className="mb-4 p-3 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs leading-relaxed flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold block mb-0.5">{t('statusPending')}</span>
              {language === 'sw'
                ? 'Akaunti za maafisa kilimo huhitaji uthibitisho kutoka kwa wasimamizi wa CropCare kabla ya kuhudumia wakulima.'
                : 'Officer registrations require administrative verification before you can claim or diagnose cases.'}
            </div>
          </div>
        )}

        {/* Error message */}
        {errorMsg && (
          <div className="mb-4 p-3 rounded-2xl bg-[#FEE2E2] border border-[#FCA5A5] text-[#991B1B] text-xs font-medium flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-[#991B1B] shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Success message */}
        {successMsg && (
          <div className="mb-4 p-3 rounded-2xl bg-[#DCFCE7] border border-[#86EFAC] text-[#166534] text-xs font-medium flex items-start gap-2">
            <ShieldCheck className="w-4 h-4 text-[#166534] shrink-0 mt-0.5" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Google Sign-in button */}
        <button
          type="button"
          onClick={handleGoogleAuth}
          disabled={submitting}
          className="w-full min-h-[48px] mb-4 py-2.5 px-4 rounded-full border border-[#D5CFC0] bg-white hover:bg-[#F2ECE0] text-[#2B3A33] text-sm font-semibold flex items-center justify-center gap-3 transition-all shadow-xs"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
            />
          </svg>
          <span>
            {mode === 'signin'
              ? (language === 'sw' ? 'Ingia na Google' : 'Continue with Google')
              : (language === 'sw' ? 'Jisajili na Google' : 'Sign up with Google')}
          </span>
        </button>

        <div className="relative flex items-center justify-center my-4">
          <div className="border-t border-[#E7E2D5] w-full" />
          <span className="bg-[#FBFAF5] px-3 text-[11px] font-bold uppercase tracking-wider text-[#687C73] absolute">
            {language === 'sw' ? 'au kwa Barua Pepe' : 'or with email'}
          </span>
        </div>

        {/* Email Form */}
        <form onSubmit={handleSubmit} className="space-y-3.5">
          {mode !== 'signin' && (
            <>
              <div>
                <label className="block text-xs font-bold text-[#0F4A2F] uppercase tracking-wider mb-1">
                  {language === 'sw' ? 'Jina Kamili' : 'Full Name'} *
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-[#687C73] absolute left-3.5 top-3.5" />
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g. Boniface Mutua"
                    required
                    className="w-full min-h-[48px] bg-white border border-[#D5CFC0] rounded-2xl pl-10 pr-3.5 py-2.5 text-sm text-[#2B3A33] focus:outline-none focus:ring-2 focus:ring-[#2BC55B]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#0F4A2F] uppercase tracking-wider mb-1">
                  {language === 'sw' ? 'Nambari ya Simu' : 'Phone Number'} *
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-[#687C73] absolute left-3.5 top-3.5" />
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="0712 345 678"
                    required
                    className="w-full min-h-[48px] bg-white border border-[#D5CFC0] rounded-2xl pl-10 pr-3.5 py-2.5 text-sm text-[#2B3A33] focus:outline-none focus:ring-2 focus:ring-[#2BC55B]"
                  />
                </div>
              </div>

              {mode === 'signup_officer' && (
                <div>
                  <label className="block text-xs font-bold text-[#0F4A2F] uppercase tracking-wider mb-1">
                    {t('officerIdLabel')} *
                  </label>
                  <input
                    type="text"
                    value={officerIdNumber}
                    onChange={(e) => setOfficerIdNumber(e.target.value)}
                    placeholder="e.g. MOA/MKS/2024/089"
                    required
                    className="w-full min-h-[48px] bg-white border border-[#D5CFC0] rounded-2xl px-4 py-2.5 text-sm text-[#2B3A33] focus:outline-none focus:ring-2 focus:ring-[#2BC55B]"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-[#0F4A2F] uppercase tracking-wider mb-1">
                    {t('subCountyLabel')}
                  </label>
                  <select
                    value={subCounty}
                    onChange={(e) => handleSubCountyChange(e.target.value)}
                    className="w-full min-h-[48px] bg-white border border-[#D5CFC0] rounded-2xl px-3 py-2 text-xs text-[#2B3A33] focus:outline-none focus:ring-2 focus:ring-[#2BC55B]"
                  >
                    {MACHAKOS_SUB_COUNTIES.map((sc) => (
                      <option key={sc.name} value={sc.name}>
                        {sc.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#0F4A2F] uppercase tracking-wider mb-1">
                    {t('wardLabel')}
                  </label>
                  <select
                    value={ward}
                    onChange={(e) => setWard(e.target.value)}
                    className="w-full min-h-[48px] bg-white border border-[#D5CFC0] rounded-2xl px-3 py-2 text-xs text-[#2B3A33] focus:outline-none focus:ring-2 focus:ring-[#2BC55B]"
                  >
                    {currentWards.map((w) => (
                      <option key={w} value={w}>
                        {w}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </>
          )}

          <div>
            <label className="block text-xs font-bold text-[#0F4A2F] uppercase tracking-wider mb-1">
              {language === 'sw' ? 'Barua Pepe' : 'Email Address'} *
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-[#687C73] absolute left-3.5 top-3.5" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                required
                className="w-full min-h-[48px] bg-white border border-[#D5CFC0] rounded-2xl pl-10 pr-3.5 py-2.5 text-sm text-[#2B3A33] focus:outline-none focus:ring-2 focus:ring-[#2BC55B]"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-bold text-[#0F4A2F] uppercase tracking-wider">
                {language === 'sw' ? 'Nenosiri' : 'Password'} *
              </label>
              {mode === 'signin' && (
                <button
                  type="button"
                  onClick={handleForgotPassword}
                  className="text-xs text-[#0F4A2F] hover:underline font-semibold"
                >
                  {language === 'sw' ? 'Umesahau nenosiri?' : 'Forgot password?'}
                </button>
              )}
            </div>
            <div className="relative">
              <Lock className="w-4 h-4 text-[#687C73] absolute left-3.5 top-3.5" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={6}
                className="w-full min-h-[48px] bg-white border border-[#D5CFC0] rounded-2xl pl-10 pr-3.5 py-2.5 text-sm text-[#2B3A33] focus:outline-none focus:ring-2 focus:ring-[#2BC55B]"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full min-h-[48px] py-3 rounded-full bg-[#0F4A2F] hover:bg-[#155e3c] text-white font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2 mt-4"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            <span>
              {mode === 'signin'
                ? (language === 'sw' ? 'Ingia Kwenye Akaunti' : 'Sign In')
                : mode === 'signup_farmer'
                ? (language === 'sw' ? 'Kamilisha Usajili wa Mkulima' : 'Register as Farmer')
                : (language === 'sw' ? 'Wasilisha Usajili wa Afisa' : 'Submit Officer Registration')}
            </span>
          </button>
        </form>
      </div>
    </div>
  );
};
