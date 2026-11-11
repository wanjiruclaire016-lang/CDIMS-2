import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { MACHAKOS_SUB_COUNTIES } from '../utils/machakosData';
import { UserRole, Language } from '../types';
import {
  User,
  Phone,
  Mail,
  MapPin,
  Languages,
  ShieldCheck,
  Save,
  Loader2,
  LogOut,
  CheckCircle,
} from 'lucide-react';

export const ProfileView: React.FC = () => {
  const { currentUser, profile, updateUserProfile, signOutUser } = useAuth();
  const { language, setLanguage, t } = useLanguage();

  const [fullName, setFullName] = useState(profile?.fullName || '');
  const [phone, setPhone] = useState(profile?.phone || '');
  const [subCounty, setSubCounty] = useState(profile?.subCounty || 'Machakos Town');
  const [ward, setWard] = useState(profile?.ward || 'Machakos Central');
  const [prefLang, setPrefLang] = useState<Language>(profile?.preferredLanguage || language);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState(false);

  const currentWards = MACHAKOS_SUB_COUNTIES.find((s) => s.name === subCounty)?.wards || [];

  const handleSubCountyChange = (sc: string) => {
    setSubCounty(sc);
    const wards = MACHAKOS_SUB_COUNTIES.find((s) => s.name === sc)?.wards || [];
    if (wards.length > 0) setWard(wards[0]);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSuccessMsg(false);

    try {
      await updateUserProfile({
        fullName: fullName.trim(),
        phone: phone.trim(),
        subCounty,
        ward,
        preferredLanguage: prefLang,
      });
      setLanguage(prefLang);
      setSuccessMsg(true);
      setTimeout(() => setSuccessMsg(false), 3000);
    } catch (err) {
      console.error('Failed to update profile:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="bg-white rounded-3xl border border-stone-200 p-6 sm:p-8 shadow-xs">
        {/* Header */}
        <div className="flex items-center justify-between pb-6 border-b border-stone-100 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-800 text-amber-200 flex items-center justify-center font-bold text-lg">
              {profile?.fullName?.slice(0, 2).toUpperCase() || 'CD'}
            </div>
            <div>
              <h1 className="text-xl font-bold text-stone-900">{t('navProfile')}</h1>
              <p className="text-xs text-stone-500">{currentUser?.email}</p>
            </div>
          </div>

          <div className="text-right">
            <span
              className={`inline-block px-2.5 py-1 rounded-full text-xs font-bold ${
                profile?.role === 'admin'
                  ? 'bg-amber-100 text-amber-900 border border-amber-300'
                  : profile?.role === 'officer'
                  ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                  : 'bg-stone-100 text-stone-800'
              }`}
            >
              {profile?.role === 'admin'
                ? t('roleAdmin')
                : profile?.role === 'officer'
                ? profile?.officerStatus === 'verified'
                  ? t('statusVerified')
                  : t('statusPending')
                : t('roleFarmer')}
            </span>
          </div>
        </div>

        {successMsg && (
          <div className="p-3 mb-5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-600" />
            <span>
              {language === 'sw' ? 'Wasifu wako umehifadhiwa vyema!' : 'Profile updated successfully!'}
            </span>
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
              {language === 'sw' ? 'Jina Kamili' : 'Full Name'}
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-stone-400 absolute left-3 top-3" />
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                className="w-full bg-stone-50 border border-stone-200 rounded-xl pl-9 pr-3.5 py-2.5 text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
              {language === 'sw' ? 'Nambari ya Simu' : 'Phone Number'}
            </label>
            <div className="relative">
              <Phone className="w-4 h-4 text-stone-400 absolute left-3 top-3" />
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
                className="w-full bg-stone-50 border border-stone-200 rounded-xl pl-9 pr-3.5 py-2.5 text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </div>
          </div>

          {profile?.role === 'officer' && (
            <div>
              <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
                {t('officerIdLabel')}
              </label>
              <input
                type="text"
                value={profile.officerIdNumber || ''}
                disabled
                className="w-full bg-stone-100 border border-stone-200 rounded-xl px-3.5 py-2 text-sm text-stone-600 font-mono"
              />
              <span className="text-[11px] text-stone-400 mt-0.5 block">
                Official staff ID verified by CropCare Machakos
              </span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
                {t('subCountyLabel')}
              </label>
              <select
                value={subCounty}
                onChange={(e) => handleSubCountyChange(e.target.value)}
                className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2.5 text-sm text-stone-900"
              >
                {MACHAKOS_SUB_COUNTIES.map((sc) => (
                  <option key={sc.name} value={sc.name}>
                    {sc.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
                {t('wardLabel')}
              </label>
              <select
                value={ward}
                onChange={(e) => setWard(e.target.value)}
                className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2.5 text-sm text-stone-900"
              >
                {currentWards.map((w) => (
                  <option key={w} value={w}>
                    {w}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
              {language === 'sw' ? 'Lugha Unayopendelea' : 'Preferred Language'}
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setPrefLang('en')}
                className={`py-2 px-3 rounded-xl text-xs font-bold border transition-colors ${
                  prefLang === 'en'
                    ? 'bg-[#1e4620] text-amber-300 border-[#1e4620]'
                    : 'bg-stone-50 text-stone-700 border-stone-200'
                }`}
              >
                English (EN)
              </button>
              <button
                type="button"
                onClick={() => setPrefLang('sw')}
                className={`py-2 px-3 rounded-xl text-xs font-bold border transition-colors ${
                  prefLang === 'sw'
                    ? 'bg-[#1e4620] text-amber-300 border-[#1e4620]'
                    : 'bg-stone-50 text-stone-700 border-stone-200'
                }`}
              >
                Kiswahili (SW)
              </button>
            </div>
          </div>

          <div className="pt-6 border-t border-stone-100 flex items-center justify-between">
            <button
              type="button"
              onClick={signOutUser}
              className="px-4 py-2.5 rounded-xl border border-red-200 text-red-700 hover:bg-red-50 text-xs font-bold flex items-center gap-1.5 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span>{t('navSignOut')}</span>
            </button>

            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2.5 rounded-xl bg-[#1e4620] hover:bg-[#285d2b] text-white text-xs font-bold shadow-sm flex items-center gap-2"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              <span>{t('saveBtn')}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
