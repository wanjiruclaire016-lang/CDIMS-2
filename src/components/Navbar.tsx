import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import {
  Sprout,
  Menu,
  X,
  Languages,
  User as UserIcon,
  ShieldCheck,
  ClipboardList,
  PlusCircle,
  BookOpen,
  Inbox,
  LogOut,
  Activity,
  Award,
} from 'lucide-react';

interface NavbarProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  openAuthModal: () => void;
  activeAlertCount?: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  setCurrentTab,
  openAuthModal,
}) => {
  const { currentUser, profile, signOutUser } = useAuth();
  const { language, toggleLanguage, t } = useLanguage();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const role = profile?.role || (currentUser ? 'farmer' : 'guest');
  const isOfficerPending = role === 'officer' && profile?.officerStatus !== 'verified';

  const handleNav = (tab: string) => {
    setCurrentTab(tab);
    setMobileMenuOpen(false);
  };

  const getRoleBadge = () => {
    if (!currentUser) return null;
    if (role === 'superadmin') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-900 border border-purple-200">
          <Award className="w-3.5 h-3.5 text-purple-700" />
          {t('roleSuperAdmin')}
        </span>
      );
    }
    if (role === 'admin') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-[#0F4A2F] border border-emerald-200">
          <ShieldCheck className="w-3.5 h-3.5 text-[#0F4A2F]" />
          {t('roleAdmin')}
        </span>
      );
    }
    if (role === 'officer') {
      if (profile?.officerStatus === 'verified') {
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-[#0F4A2F] border border-emerald-200">
            <ShieldCheck className="w-3.5 h-3.5 text-[#2BC55B]" />
            {t('statusVerified')}
          </span>
        );
      }
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-900 border border-amber-200">
          {t('statusPending')}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#EAE5D9] text-[#2B3A33]">
        <Sprout className="w-3.5 h-3.5 text-[#0F4A2F]" />
        {t('roleFarmer')}
      </span>
    );
  };

  return (
    <header className="sticky top-3 z-40 px-3 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full transition-all">
      {/* Floating Rounded Pill Bar */}
      <div className="bg-[#FBFAF5] border border-[#E7E2D5] text-[#2B3A33] shadow-[0_4px_20px_rgba(15,74,47,0.08)] rounded-full px-3 sm:px-5 py-2">
        <div className="flex items-center justify-between min-h-[48px] gap-2">
          {/* Brand Logo & County Info */}
          <div
            className="flex items-center gap-2.5 cursor-pointer select-none min-w-0"
            onClick={() => handleNav('home')}
          >
            <div className="w-10 h-10 rounded-full bg-[#0F4A2F] text-white flex items-center justify-center shrink-0 shadow-sm">
              <Sprout className="w-5 h-5 text-[#2BC55B]" />
            </div>
            <div className="min-w-0 flex flex-col justify-center">
              <div className="flex items-center gap-2">
                <span className="font-heading font-black text-xl sm:text-2xl tracking-tight text-[#0F4A2F] leading-none">
                  CDIMS
                </span>
                <span className="hidden md:inline-flex">{getRoleBadge()}</span>
              </div>
              <p className="text-[11px] sm:text-xs text-[#40544B] font-medium leading-tight truncate">
                CropCare Centre, Machakos County
              </p>
            </div>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden lg:flex items-center gap-1 xl:gap-2">
            <button
              onClick={() => handleNav('diseases')}
              className={`min-h-[44px] px-3.5 py-2 rounded-full text-xs font-semibold tracking-wide transition-all flex items-center gap-1.5 ${
                currentTab === 'diseases'
                  ? 'bg-[#0F4A2F] text-white shadow-sm'
                  : 'text-[#2B3A33] hover:bg-[#EAE5D9]/70'
              }`}
            >
              <BookOpen className="w-4 h-4 text-[#2BC55B]" />
              {t('navDiseaseLibrary')}
            </button>

            {/* Farmer Navigation */}
            {currentUser && role === 'farmer' && (
              <>
                <button
                  onClick={() => handleNav('home')}
                  className={`min-h-[44px] px-3.5 py-2 rounded-full text-xs font-semibold tracking-wide transition-all flex items-center gap-1.5 ${
                    currentTab === 'home'
                      ? 'bg-[#0F4A2F] text-white shadow-sm'
                      : 'text-[#2B3A33] hover:bg-[#EAE5D9]/70'
                  }`}
                >
                  <ClipboardList className="w-4 h-4" />
                  {t('navMyCases')}
                </button>
                <button
                  onClick={() => handleNav('new-case')}
                  className="min-h-[44px] px-4 py-2 rounded-full text-xs font-bold tracking-wide bg-[#2BC55B] hover:bg-[#25ad50] text-[#0F4A2F] shadow-sm flex items-center gap-1.5 transition-all"
                >
                  <PlusCircle className="w-4 h-4 stroke-[2.5]" />
                  {t('navNewCase')}
                </button>
              </>
            )}

            {/* Extension Officer Navigation */}
            {currentUser && role === 'officer' && !isOfficerPending && (
              <>
                <button
                  onClick={() => handleNav('officer-queue')}
                  className={`min-h-[44px] px-3.5 py-2 rounded-full text-xs font-semibold tracking-wide transition-all flex items-center gap-1.5 ${
                    currentTab === 'officer-queue'
                      ? 'bg-[#0F4A2F] text-white shadow-sm'
                      : 'text-[#2B3A33] hover:bg-[#EAE5D9]/70'
                  }`}
                >
                  <Inbox className="w-4 h-4" />
                  {t('navOfficerQueue')}
                </button>
                <button
                  onClick={() => handleNav('home')}
                  className={`min-h-[44px] px-3.5 py-2 rounded-full text-xs font-semibold tracking-wide transition-all flex items-center gap-1.5 ${
                    currentTab === 'home'
                      ? 'bg-[#0F4A2F] text-white shadow-sm'
                      : 'text-[#2B3A33] hover:bg-[#EAE5D9]/70'
                  }`}
                >
                  <ClipboardList className="w-4 h-4" />
                  {t('navAssignedCases')}
                </button>
              </>
            )}

            {/* Admin and Super Admin */}
            {currentUser && (role === 'admin' || role === 'superadmin') && (
              <>
                <button
                  onClick={() => handleNav('home')}
                  className={`min-h-[44px] px-3.5 py-2 rounded-full text-xs font-semibold tracking-wide transition-all flex items-center gap-1.5 ${
                    currentTab === 'home'
                      ? 'bg-[#0F4A2F] text-white shadow-sm'
                      : 'text-[#2B3A33] hover:bg-[#EAE5D9]/70'
                  }`}
                >
                  <ShieldCheck className="w-4 h-4 text-[#2BC55B]" />
                  {t('navAdminPanel')}
                </button>
                <button
                  onClick={() => handleNav('oversight')}
                  className={`min-h-[44px] px-3.5 py-2 rounded-full text-xs font-semibold tracking-wide transition-all flex items-center gap-1.5 ${
                    currentTab === 'oversight'
                      ? 'bg-[#0F4A2F] text-white shadow-sm'
                      : 'text-[#2B3A33] hover:bg-[#EAE5D9]/70'
                  }`}
                >
                  <Activity className="w-4 h-4 text-[#2BC55B]" />
                  {t('navOversight')}
                </button>
              </>
            )}
          </nav>

          {/* Right Action Bar */}
          <div className="flex items-center gap-2">
            {/* Language Switch */}
            <button
              onClick={toggleLanguage}
              title={language === 'en' ? 'Badilisha lugha kuwa Kiswahili' : 'Switch language to English'}
              className="min-h-[44px] px-3 py-1.5 rounded-full text-xs font-bold text-[#0F4A2F] bg-[#EAE5D9] hover:bg-[#DDD7C8] border border-[#D5CFC0] flex items-center gap-1.5 transition-all"
            >
              <Languages className="w-3.5 h-3.5 text-[#0F4A2F]" />
              <span>{language === 'en' ? 'SW' : 'EN'}</span>
            </button>

            {/* Profile / Auth */}
            {currentUser ? (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => handleNav('profile')}
                  className={`min-h-[44px] min-w-[44px] p-1 rounded-full transition-all flex items-center justify-center ${
                    currentTab === 'profile'
                      ? 'ring-2 ring-[#0F4A2F]'
                      : 'hover:opacity-90'
                  }`}
                  title={profile?.fullName || currentUser.email || 'Profile'}
                >
                  <div className="w-9 h-9 rounded-full bg-[#0F4A2F] text-white flex items-center justify-center font-bold text-xs">
                    {profile?.fullName?.slice(0, 2).toUpperCase() || 'CD'}
                  </div>
                </button>

                <button
                  onClick={signOutUser}
                  title={t('navSignOut')}
                  className="min-h-[44px] min-w-[44px] p-2 rounded-full text-[#40544B] hover:text-[#0F4A2F] hover:bg-[#EAE5D9] flex items-center justify-center transition-all"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={openAuthModal}
                className="min-h-[44px] px-4 py-2 rounded-full text-xs font-bold bg-[#0F4A2F] hover:bg-[#155e3c] text-white shadow-sm transition-all"
              >
                {t('navSignIn')}
              </button>
            )}

            {/* Mobile Hamburger Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden min-h-[44px] min-w-[44px] p-2 rounded-full text-[#0F4A2F] hover:bg-[#EAE5D9] flex items-center justify-center transition-all"
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer Menu (Rounded card) */}
      {mobileMenuOpen && (
        <div className="lg:hidden mt-2 bg-[#FBFAF5] border border-[#E7E2D5] rounded-3xl p-4 shadow-xl space-y-2 animate-in fade-in slide-in-from-top-2 duration-200">
          {currentUser && (
            <div className="pb-3 mb-2 border-b border-[#E7E2D5] flex items-center justify-between">
              <div>
                <p className="font-heading font-bold text-sm text-[#0F4A2F]">{profile?.fullName}</p>
                <p className="text-xs text-[#52665C]">{currentUser.email}</p>
              </div>
              {getRoleBadge()}
            </div>
          )}

          {/* Navigation Links */}
          <button
            onClick={() => handleNav('home')}
            className={`min-h-[48px] w-full text-left px-4 py-2.5 rounded-2xl text-sm font-semibold flex items-center gap-3 ${
              currentTab === 'home' ? 'bg-[#0F4A2F] text-white' : 'text-[#2B3A33] hover:bg-[#EAE5D9]'
            }`}
          >
            <ClipboardList className="w-4 h-4 text-[#2BC55B]" />
            {role === 'admin' || role === 'superadmin'
              ? t('navAdminPanel')
              : role === 'officer'
              ? t('navAssignedCases')
              : t('navMyCases')}
          </button>

          {currentUser && (role === 'admin' || role === 'superadmin') && (
            <button
              onClick={() => handleNav('oversight')}
              className={`min-h-[48px] w-full text-left px-4 py-2.5 rounded-2xl text-sm font-semibold flex items-center gap-3 ${
                currentTab === 'oversight' ? 'bg-[#0F4A2F] text-white' : 'text-[#2B3A33] hover:bg-[#EAE5D9]'
              }`}
            >
              <Activity className="w-4 h-4 text-[#2BC55B]" />
              {t('navOversight')}
            </button>
          )}

          {currentUser && role === 'farmer' && (
            <button
              onClick={() => handleNav('new-case')}
              className="min-h-[48px] w-full text-left px-4 py-2.5 rounded-2xl text-sm font-bold bg-[#2BC55B] text-[#0F4A2F] flex items-center gap-3"
            >
              <PlusCircle className="w-4 h-4" />
              {t('navNewCase')}
            </button>
          )}

          {currentUser && role === 'officer' && !isOfficerPending && (
            <button
              onClick={() => handleNav('officer-queue')}
              className={`min-h-[48px] w-full text-left px-4 py-2.5 rounded-2xl text-sm font-semibold flex items-center gap-3 ${
                currentTab === 'officer-queue' ? 'bg-[#0F4A2F] text-white' : 'text-[#2B3A33] hover:bg-[#EAE5D9]'
              }`}
            >
              <Inbox className="w-4 h-4 text-[#2BC55B]" />
              {t('navOfficerQueue')}
            </button>
          )}

          <button
            onClick={() => handleNav('diseases')}
            className={`min-h-[48px] w-full text-left px-4 py-2.5 rounded-2xl text-sm font-semibold flex items-center gap-3 ${
              currentTab === 'diseases' ? 'bg-[#0F4A2F] text-white' : 'text-[#2B3A33] hover:bg-[#EAE5D9]'
            }`}
          >
            <BookOpen className="w-4 h-4 text-[#2BC55B]" />
            {t('navDiseaseLibrary')}
          </button>

          {currentUser && (
            <button
              onClick={() => handleNav('profile')}
              className={`min-h-[48px] w-full text-left px-4 py-2.5 rounded-2xl text-sm font-semibold flex items-center gap-3 ${
                currentTab === 'profile' ? 'bg-[#0F4A2F] text-white' : 'text-[#2B3A33] hover:bg-[#EAE5D9]'
              }`}
            >
              <UserIcon className="w-4 h-4 text-[#2BC55B]" />
              {t('navProfile')}
            </button>
          )}

          {!currentUser && (
            <div className="pt-2">
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  openAuthModal();
                }}
                className="min-h-[48px] w-full py-2.5 rounded-full bg-[#0F4A2F] text-white font-bold text-center text-sm shadow-sm"
              >
                {t('navSignIn')}
              </button>
            </div>
          )}
        </div>
      )}
    </header>
  );
};
