import React, { useState } from 'react';
import { CaseItem, CaseStatus } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { doc, updateDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { CROP_DISEASES_PRESETS } from '../utils/machakosData';
import { Stethoscope, X, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';

interface DiagnosisModalProps {
  caseItem: CaseItem;
  onClose: () => void;
  onSuccess: () => void;
}

export const DiagnosisModal: React.FC<DiagnosisModalProps> = ({
  caseItem,
  onClose,
  onSuccess,
}) => {
  const { profile } = useAuth();
  const { t, language } = useLanguage();

  const presets = CROP_DISEASES_PRESETS[caseItem.crop] || CROP_DISEASES_PRESETS['Cassava (Mihogo)'] || [];

  const [diseaseName, setDiseaseName] = useState(caseItem.diagnosis?.diseaseName || '');
  const [customDisease, setCustomDisease] = useState('');
  const [treatmentAdvice, setTreatmentAdvice] = useState(caseItem.diagnosis?.treatmentAdvice || '');
  const [preventionTips, setPreventionTips] = useState(caseItem.diagnosis?.preventionTips || '');
  const [status, setStatus] = useState<CaseStatus>('Advice Given');
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalDisease = (customDisease.trim() || diseaseName.trim());
    if (!finalDisease) {
      setErrorMsg(language === 'sw' ? 'Tafadhali chagua au uandike jina la ugonjwa.' : 'Please enter or select a disease name.');
      return;
    }
    if (!treatmentAdvice.trim()) {
      setErrorMsg(language === 'sw' ? 'Tafadhali weka ushauri wa matibabu.' : 'Please provide treatment advice.');
      return;
    }

    setSaving(true);
    setErrorMsg(null);

    const nowIso = new Date().toISOString();
    const diagnosisPayload = {
      diseaseName: finalDisease,
      treatmentAdvice: treatmentAdvice.trim(),
      preventionTips: preventionTips.trim(),
      diagnosedAt: nowIso,
      officerName: profile?.fullName || 'Extension Officer',
    };

    try {
      const caseRef = doc(db, 'cases', caseItem.id);
      await updateDoc(caseRef, {
        diagnosis: diagnosisPayload,
        status,
        updatedAt: nowIso,
      });
      onSuccess();
      onClose();
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `cases/${caseItem.id}`);
      setErrorMsg(language === 'sw' ? 'Hitilafu wakati wa kuhifadhi.' : 'Failed to save diagnosis.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-[#FBFAF5] rounded-3xl max-w-xl w-full p-6 sm:p-8 shadow-2xl border border-[#E7E2D5] my-8 animate-in fade-in duration-150">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[#E7E2D5] mb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#0F4A2F] text-white flex items-center justify-center font-bold">
              <Stethoscope className="w-5 h-5 text-[#2BC55B]" />
            </div>
            <div>
              <h3 className="font-heading font-black text-lg text-[#0F4A2F]">{t('giveDiagnosisBtn')}</h3>
              <p className="text-xs text-[#52665C]">
                {caseItem.crop} • {caseItem.farmerName} ({caseItem.subCounty})
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-full flex items-center justify-center text-[#52665C] hover:bg-[#EAE5D9] hover:text-[#0F4A2F]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {errorMsg && (
          <div className="p-3 mb-4 rounded-2xl bg-[#FEE2E2] border border-[#FCA5A5] text-[#991B1B] text-xs font-medium flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Disease selection */}
          <div>
            <label className="block text-xs font-bold text-[#0F4A2F] uppercase tracking-wider mb-1.5">
              {t('identifiedDisease')} *
            </label>
            <select
              value={diseaseName}
              onChange={(e) => {
                setDiseaseName(e.target.value);
                if (e.target.value !== '__custom__') setCustomDisease('');
              }}
              className="w-full min-h-[48px] bg-white border border-[#D5CFC0] rounded-2xl px-3.5 py-2.5 text-xs sm:text-sm text-[#2B3A33] focus:outline-none focus:ring-2 focus:ring-[#2BC55B] mb-2"
            >
              <option value="">-- {t('selectOrTypeDisease')} --</option>
              {presets.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
              <option value="__custom__">
                {language === 'sw' ? 'Andika ugonjwa mwingine...' : 'Type custom disease name...'}
              </option>
            </select>

            {(diseaseName === '__custom__' || !presets.includes(diseaseName)) && (
              <input
                type="text"
                value={customDisease || (diseaseName !== '__custom__' ? diseaseName : '')}
                onChange={(e) => setCustomDisease(e.target.value)}
                placeholder={language === 'sw' ? 'Andika jina kamili la ugonjwa...' : 'Enter disease name...'}
                className="w-full min-h-[48px] bg-white border border-[#D5CFC0] rounded-2xl px-3.5 py-2.5 text-xs sm:text-sm text-[#2B3A33] focus:outline-none focus:ring-2 focus:ring-[#2BC55B]"
              />
            )}
          </div>

          {/* Treatment Advice */}
          <div>
            <label className="block text-xs font-bold text-[#0F4A2F] uppercase tracking-wider mb-1.5">
              {t('treatmentAdvice')} *
            </label>
            <textarea
              rows={3}
              value={treatmentAdvice}
              onChange={(e) => setTreatmentAdvice(e.target.value)}
              placeholder={t('treatmentPlaceholder')}
              required
              className="w-full bg-white border border-[#D5CFC0] rounded-2xl p-3 text-xs sm:text-sm text-[#2B3A33] focus:outline-none focus:ring-2 focus:ring-[#2BC55B] resize-none"
            />
          </div>

          {/* Prevention Guidance */}
          <div>
            <label className="block text-xs font-bold text-[#0F4A2F] uppercase tracking-wider mb-1.5">
              {t('preventionTips')}
            </label>
            <textarea
              rows={3}
              value={preventionTips}
              onChange={(e) => setPreventionTips(e.target.value)}
              placeholder={t('preventionPlaceholder')}
              className="w-full bg-white border border-[#D5CFC0] rounded-2xl p-3 text-xs sm:text-sm text-[#2B3A33] focus:outline-none focus:ring-2 focus:ring-[#2BC55B] resize-none"
            />
          </div>

          {/* Set Status */}
          <div>
            <label className="block text-xs font-bold text-[#0F4A2F] uppercase tracking-wider mb-1.5">
              {language === 'sw' ? 'Hali ya Kesi' : 'Case Status'}
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(['In Review', 'Advice Given', 'Resolved'] as CaseStatus[]).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setStatus(st)}
                  className={`min-h-[44px] py-2 px-3 rounded-2xl text-xs font-bold border transition-all text-center ${
                    status === st
                      ? 'bg-[#0F4A2F] text-white border-[#0F4A2F] shadow-xs'
                      : 'bg-white text-[#2B3A33] border-[#E7E2D5] hover:bg-[#EAE5D9]'
                  }`}
                >
                  {st === 'In Review'
                    ? t('statusInReview')
                    : st === 'Advice Given'
                    ? t('statusAdviceGiven')
                    : t('statusResolved')}
                </button>
              ))}
            </div>
          </div>

          {/* Submit Buttons */}
          <div className="pt-4 border-t border-[#E7E2D5] flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="min-h-[48px] px-5 py-2.5 rounded-full border border-[#D5CFC0] text-[#2B3A33] text-xs font-semibold hover:bg-[#EAE5D9]"
            >
              {t('cancelBtn')}
            </button>
            <button
              type="submit"
              disabled={saving}
              className="min-h-[48px] px-6 py-2.5 rounded-full bg-[#0F4A2F] hover:bg-[#155e3c] text-white text-xs font-bold shadow-sm flex items-center gap-2"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4 text-[#2BC55B]" />}
              <span>{saving ? t('savingDiagnosis') : t('submitDiagnosisBtn')}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
