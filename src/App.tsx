/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { LanguageProvider, useLanguage } from './contexts/LanguageContext';
import { Navbar } from './components/Navbar';
import { OutbreakBanner } from './components/OutbreakBanner';
import { FarmerHome } from './views/FarmerHome';
import { OfficerHome } from './views/OfficerHome';
import { AdminDashboard } from './views/AdminDashboard';
import { DiseaseLibraryView } from './views/DiseaseLibraryView';
import { ProfileView } from './views/ProfileView';
import { OversightDashboard } from './views/OversightDashboard';
import { AuthModal } from './views/AuthModal';
import { OutbreakAlert } from './types';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from './firebase';
import {
  Sprout,
  BookOpen,
  PlusCircle,
  ArrowRight,
  ShieldCheck,
  MapPin,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';

function AppContent() {
  const { currentUser, profile, loading } = useAuth();
  const { t, language } = useLanguage();

  const [currentTab, setCurrentTab] = useState<string>('home');
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [alerts, setAlerts] = useState<OutbreakAlert[]>([]);
  const [prefillCaseData, setPrefillCaseData] = useState<{ crop: string; symptoms: string } | null>(null);

  const handleReportDisease = (crop: string, symptoms: string) => {
    setPrefillCaseData({ crop, symptoms });
    if (!currentUser) {
      setAuthModalOpen(true);
    } else {
      setCurrentTab('new-case');
    }
  };

  // Real-time listener for active outbreak alerts
  useEffect(() => {
    const alertsCol = collection(db, 'alerts');
    const q = query(alertsCol, where('active', '==', true));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list: OutbreakAlert[] = [];
        snapshot.forEach((docSnap) => {
          list.push(docSnap.data() as OutbreakAlert);
        });
        setAlerts(list);
      },
      (error) => {
        console.warn('Could not load alerts:', error);
      }
    );

    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F6F1E4] flex flex-col items-center justify-center p-4">
        <div className="w-16 h-16 rounded-full bg-[#0F4A2F] text-white flex items-center justify-center mb-4 shadow-lg animate-pulse">
          <Sprout className="w-8 h-8 text-[#2BC55B]" />
        </div>
        <p className="font-heading font-black text-[#0F4A2F] text-lg tracking-tight">CDIMS</p>
        <p className="text-xs text-[#2B3A33] mt-1">CropCare Centre, Machakos County</p>
      </div>
    );
  }

  const role = profile?.role || (currentUser ? 'farmer' : 'guest');

  return (
    <div className="min-h-screen bg-[#F6F1E4] text-[#2B3A33] flex flex-col font-sans selection:bg-[#2BC55B]/30">
      {/* Top Navbar */}
      <Navbar
        currentTab={currentTab}
        setCurrentTab={setCurrentTab}
        openAuthModal={() => setAuthModalOpen(true)}
        activeAlertCount={alerts.length}
      />

      {/* Main Body Content */}
      <main className="flex-1 w-full">
        {/* Guest View: Landing Hero if not logged in and on 'home' */}
        {!currentUser && currentTab === 'home' && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10">
            <OutbreakBanner alerts={alerts} onOpenReport={() => setAuthModalOpen(true)} onNavigateLibrary={() => setCurrentTab('diseases')} />

            {/* Cream Hero Section with Green Headline and Right Illustration */}
            <div className="relative rounded-3xl overflow-hidden bg-[#FBFAF5] border border-[#E7E2D5] p-6 sm:p-10 lg:p-14 shadow-[0_4px_30px_rgba(15,74,47,0.06)] mb-10">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
                {/* Left Text */}
                <div className="lg:col-span-7 space-y-4">
                  <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#EAE5D9] text-[#0F4A2F] text-xs font-semibold">
                    <Sprout className="w-4 h-4 text-[#2BC55B]" />
                    <span>CropCare Centre, Machakos County</span>
                  </div>

                  <h1 className="font-heading font-black text-3xl sm:text-4xl lg:text-5xl tracking-tight text-[#0F4A2F] leading-tight">
                    {language === 'sw'
                      ? 'Kinga Mazao Yako, Linda Mavuno Yako'
                      : 'Protect Your Crops, Secure Your Harvest'}
                  </h1>

                  <p className="text-base sm:text-lg text-[#2B3A33]/90 leading-relaxed font-normal max-w-xl">
                    {language === 'sw'
                      ? 'Piga picha mmea wenye dalili za ugonjwa, wasilisha ripoti yako, na uunganishwe mara moja na afisa kilimo aliyethibitishwa wa Machakos kwa uchunguzi na ushauri wa matibabu.'
                      : 'Photograph affected crops, submit symptoms, and connect directly with verified Machakos County agricultural extension officers for timely diagnosis and certified treatment protocols.'}
                  </p>

                  <div className="pt-3 flex flex-wrap items-center gap-3">
                    <button
                      onClick={() => setAuthModalOpen(true)}
                      className="min-h-[48px] px-6 py-3 rounded-full bg-[#2BC55B] hover:bg-[#25ad50] text-[#0F4A2F] font-bold text-sm shadow-sm transition-all hover:scale-[1.02] flex items-center gap-2"
                    >
                      <PlusCircle className="w-5 h-5 stroke-[2.5]" />
                      <span>{t('heroReportBtn')}</span>
                    </button>

                    <button
                      onClick={() => setCurrentTab('diseases')}
                      className="min-h-[48px] px-6 py-3 rounded-full bg-[#EAE5D9] hover:bg-[#DDD7C8] text-[#0F4A2F] font-semibold text-sm transition-all flex items-center gap-2"
                    >
                      <BookOpen className="w-5 h-5 text-[#0F4A2F]" />
                      <span>{t('heroLibraryBtn')}</span>
                    </button>
                  </div>
                </div>

                {/* Right Illustration / Badge Container */}
                <div className="lg:col-span-5 flex justify-center">
                  <div className="relative w-full max-w-sm aspect-[4/3] rounded-3xl bg-gradient-to-br from-[#E2F5E9] via-[#FBFAF5] to-[#EAE5D9] border border-[#CDE7D5] p-6 flex flex-col justify-between shadow-inner overflow-hidden">
                    {/* Decorative leaf motifs */}
                    <div className="absolute -top-10 -right-10 w-36 h-36 rounded-full bg-[#2BC55B]/15 blur-2xl" />
                    <div className="absolute -bottom-10 -left-10 w-36 h-36 rounded-full bg-[#0F4A2F]/10 blur-2xl" />

                    <div className="flex items-center justify-between relative z-10">
                      <div className="w-12 h-12 rounded-2xl bg-[#0F4A2F] text-white flex items-center justify-center shadow-sm">
                        <Sprout className="w-6 h-6 text-[#2BC55B]" />
                      </div>
                      <span className="px-3 py-1 rounded-full text-xs font-bold bg-[#DCFCE7] text-[#166534] border border-[#86EFAC]/60 flex items-center gap-1.5">
                        <ShieldCheck className="w-3.5 h-3.5" />
                        KALRO & KePHIS Aligned
                      </span>
                    </div>

                    <div className="relative z-10 space-y-2 my-2">
                      <h3 className="font-heading font-black text-xl text-[#0F4A2F] leading-snug">
                        Machakos Agronomic Network
                      </h3>
                      <p className="text-xs text-[#40544B] leading-relaxed">
                        8 Sub-Counties covered with real-time vector monitoring, rapid case dispatch, and certified local advisories.
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[#CDE7D5]/70 relative z-10">
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-[#0F4A2F]">
                        <CheckCircle2 className="w-4 h-4 text-[#2BC55B]" />
                        <span>Verified Officers</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-[#0F4A2F]">
                        <Sparkles className="w-4 h-4 text-[#2BC55B]" />
                        <span>Organic & Chemical</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* How It Works 3-Step Process (Single Numbering Fix: Badge OR Title, not both) */}
            <div className="mb-6">
              <h2 className="font-heading font-black text-2xl text-[#0F4A2F] mb-6">
                {t('heroHowItWorksTitle')}
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Step 1 */}
                <div className="group bg-[#FBFAF5] p-6 rounded-3xl border border-[#E7E2D5] shadow-xs flex flex-col justify-between transition-all hover:border-[#2BC55B] hover:shadow-md">
                  <div>
                    <div className="w-12 h-12 rounded-full bg-[#EAE5D9] text-[#0F4A2F] font-heading font-black text-base flex items-center justify-center mb-4 group-hover:bg-[#2BC55B] group-hover:text-[#0F4A2F] transition-colors">
                      1
                    </div>
                    <h3 className="font-heading font-bold text-lg text-[#0F4A2F] group-hover:text-[#2BC55B] transition-colors mb-2">
                      {t('howStep1Title')}
                    </h3>
                    <p className="text-xs sm:text-sm text-[#40544B] leading-relaxed">
                      {t('howStep1Desc')}
                    </p>
                  </div>
                  <div className="pt-6 flex justify-end">
                    <div className="w-10 h-10 rounded-full border border-[#2BC55B] flex items-center justify-center text-[#0F4A2F] group-hover:bg-[#2BC55B] group-hover:text-white transition-all">
                      <ArrowRight className="w-4 h-4" />
                    </div>
                  </div>
                </div>

                {/* Step 2 */}
                <div className="group bg-[#FBFAF5] p-6 rounded-3xl border border-[#E7E2D5] shadow-xs flex flex-col justify-between transition-all hover:border-[#2BC55B] hover:shadow-md">
                  <div>
                    <div className="w-12 h-12 rounded-full bg-[#EAE5D9] text-[#0F4A2F] font-heading font-black text-base flex items-center justify-center mb-4 group-hover:bg-[#2BC55B] group-hover:text-[#0F4A2F] transition-colors">
                      2
                    </div>
                    <h3 className="font-heading font-bold text-lg text-[#0F4A2F] group-hover:text-[#2BC55B] transition-colors mb-2">
                      {t('howStep2Title')}
                    </h3>
                    <p className="text-xs sm:text-sm text-[#40544B] leading-relaxed">
                      {t('howStep2Desc')}
                    </p>
                  </div>
                  <div className="pt-6 flex justify-end">
                    <div className="w-10 h-10 rounded-full border border-[#2BC55B] flex items-center justify-center text-[#0F4A2F] group-hover:bg-[#2BC55B] group-hover:text-white transition-all">
                      <ArrowRight className="w-4 h-4" />
                    </div>
                  </div>
                </div>

                {/* Step 3 */}
                <div className="group bg-[#FBFAF5] p-6 rounded-3xl border border-[#E7E2D5] shadow-xs flex flex-col justify-between transition-all hover:border-[#2BC55B] hover:shadow-md">
                  <div>
                    <div className="w-12 h-12 rounded-full bg-[#EAE5D9] text-[#0F4A2F] font-heading font-black text-base flex items-center justify-center mb-4 group-hover:bg-[#2BC55B] group-hover:text-[#0F4A2F] transition-colors">
                      3
                    </div>
                    <h3 className="font-heading font-bold text-lg text-[#0F4A2F] group-hover:text-[#2BC55B] transition-colors mb-2">
                      {t('howStep3Title')}
                    </h3>
                    <p className="text-xs sm:text-sm text-[#40544B] leading-relaxed">
                      {t('howStep3Desc')}
                    </p>
                  </div>
                  <div className="pt-6 flex justify-end">
                    <div className="w-10 h-10 rounded-full border border-[#2BC55B] flex items-center justify-center text-[#0F4A2F] group-hover:bg-[#2BC55B] group-hover:text-white transition-all">
                      <ArrowRight className="w-4 h-4" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 1: Home (Role-dependent) */}
        {currentTab === 'home' && currentUser && (
          <>
            {role === 'farmer' && <FarmerHome alerts={alerts} onOpenReport={() => setCurrentTab('new-case')} onNavigateLibrary={() => setCurrentTab('diseases')} />}
            {role === 'officer' && <OfficerHome initialTab="assigned" />}
            {(role === 'admin' || role === 'superadmin') && <AdminDashboard />}
          </>
        )}

        {/* Tab: Oversight Dashboard (Admins & Super Admin) */}
        {currentTab === 'oversight' && currentUser && (role === 'admin' || role === 'superadmin') && (
          <OversightDashboard />
        )}

        {/* Tab 2: New Case (Farmer flow) */}
        {currentTab === 'new-case' && (
          <FarmerHome
            alerts={alerts}
            isCreatingNewCase={true}
            initialCrop={prefillCaseData?.crop}
            initialSymptoms={prefillCaseData?.symptoms}
            onDoneCreatingCase={() => {
              setPrefillCaseData(null);
              setCurrentTab('home');
            }}
            onNavigateLibrary={() => setCurrentTab('diseases')}
          />
        )}

        {/* Tab 3: Officer Queue */}
        {currentTab === 'officer-queue' && role === 'officer' && (
          <OfficerHome initialTab="queue" />
        )}

        {/* Tab 4: Public Disease Library */}
        {currentTab === 'diseases' && (
          <DiseaseLibraryView onReportDisease={handleReportDisease} />
        )}

        {/* Tab 5: Profile */}
        {currentTab === 'profile' && currentUser && <ProfileView />}
      </main>

      {/* Auth Modal */}
      <AuthModal isOpen={authModalOpen} onClose={() => setAuthModalOpen(false)} />

      {/* Footer */}
      <footer className="bg-[#FBFAF5] text-[#2B3A33] py-8 border-t border-[#E7E2D5] text-xs mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-[#0F4A2F] text-white flex items-center justify-center font-bold">
              <Sprout className="w-5 h-5 text-[#2BC55B]" />
            </div>
            <div>
              <p className="font-heading font-black text-[#0F4A2F] text-sm leading-tight">
                Crop Disease Information Management System (CDIMS)
              </p>
              <p className="text-[11px] text-[#52665C]">
                CropCare Centre, Machakos County
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-[11px] text-[#52665C] flex-wrap justify-center">
            <MapPin className="w-3.5 h-3.5 text-[#2BC55B] inline shrink-0" />
            <span>Machakos • Kangundo • Kathiani • Matungulu • Masinga • Yatta • Mwala • Mavoko</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <LanguageProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </LanguageProvider>
  );
}
