import React, { useState, useEffect } from 'react';
import { CaseItem, UserProfile } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { doc, updateDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { Users, AlertTriangle, X, Loader2, RefreshCw } from 'lucide-react';

interface ReassignModalProps {
  caseItem: CaseItem;
  mode: 'toQueue' | 'toOfficer';
  onClose: () => void;
  onSuccess: () => void;
}

export const ReassignModal: React.FC<ReassignModalProps> = ({
  caseItem,
  mode,
  onClose,
  onSuccess,
}) => {
  const { profile, recordAuditLog } = useAuth();
  const { t, language } = useLanguage();

  const [officers, setOfficers] = useState<UserProfile[]>([]);
  const [selectedOfficerId, setSelectedOfficerId] = useState('');
  const [loadingOfficers, setLoadingOfficers] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // If assigning to specific officer (admin mode), fetch list of verified officers
  useEffect(() => {
    if (mode === 'toOfficer') {
      const fetchOfficers = async () => {
        setLoadingOfficers(true);
        try {
          const q = query(
            collection(db, 'users'),
            where('role', '==', 'officer'),
            where('officerStatus', '==', 'verified')
          );
          const snap = await getDocs(q);
          const list: UserProfile[] = [];
          snap.forEach((d) => list.push(d.data() as UserProfile));
          setOfficers(list);
          if (list.length > 0) setSelectedOfficerId(list[0].id);
        } catch (e) {
          console.error('Error loading officers:', e);
        } finally {
          setLoadingOfficers(false);
        }
      };
      fetchOfficers();
    }
  }, [mode]);

  const handleConfirm = async () => {
    setSubmitting(true);
    const nowIso = new Date().toISOString();
    const caseRef = doc(db, 'cases', caseItem.id);

    try {
      if (mode === 'toQueue') {
        // Return back to unassigned queue
        await updateDoc(caseRef, {
          assignedOfficerId: null,
          assignedOfficerName: null,
          status: 'Submitted',
          updatedAt: nowIso,
        });

        await recordAuditLog(
          'CASE_RELEASED_TO_QUEUE',
          caseItem.id,
          `Case returned to queue by ${profile?.fullName || 'Officer'}`
        );
      } else {
        // Admin manually reassigns to specific officer
        const targetOfficer = officers.find((o) => o.id === selectedOfficerId);
        await updateDoc(caseRef, {
          assignedOfficerId: selectedOfficerId,
          assignedOfficerName: targetOfficer?.fullName || 'Extension Officer',
          status: 'Assigned',
          updatedAt: nowIso,
        });

        await recordAuditLog(
          'CASE_REASSIGNED',
          caseItem.id,
          `Case reassigned to officer ${targetOfficer?.fullName} (${selectedOfficerId}) by Admin`
        );
      }

      onSuccess();
      onClose();
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `cases/${caseItem.id}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl border border-stone-200">
        <div className="flex items-center justify-between pb-3 border-b border-stone-100 mb-5">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center">
              <RefreshCw className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-base text-stone-900">
              {mode === 'toQueue' ? t('reassignToQueueBtn') : t('manualReassignBtn')}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-stone-100 text-stone-400 hover:text-stone-700"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          <p className="text-sm text-stone-600 leading-relaxed">
            {mode === 'toQueue'
              ? t('reassignPrompt')
              : language === 'sw'
              ? 'Chagua afisa kilimo aliyethibitishwa atakayekabidhiwa kesi hii:'
              : 'Select a verified extension officer to handle this case:'}
          </p>

          <div className="p-3 rounded-xl bg-stone-50 border border-stone-200 text-xs space-y-1">
            <p>
              <strong className="text-stone-700">Crop:</strong> {caseItem.crop}
            </p>
            <p>
              <strong className="text-stone-700">Farmer:</strong> {caseItem.farmerName} (
              {caseItem.subCounty})
            </p>
          </div>

          {mode === 'toOfficer' && (
            <div>
              <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
                {t('selectOfficer')}
              </label>
              {loadingOfficers ? (
                <div className="p-3 text-center text-xs text-stone-500">
                  <Loader2 className="w-4 h-4 animate-spin mx-auto mb-1 text-emerald-600" />
                  {t('loading')}
                </div>
              ) : officers.length === 0 ? (
                <p className="text-xs text-amber-800 bg-amber-50 p-2.5 rounded-xl border border-amber-200">
                  {language === 'sw'
                    ? 'Hakuna maafisa kilimo walioidhinishwa kwa sasa.'
                    : 'No verified extension officers currently available.'}
                </p>
              ) : (
                <select
                  value={selectedOfficerId}
                  onChange={(e) => setSelectedOfficerId(e.target.value)}
                  className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3.5 py-2.5 text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                >
                  {officers.map((off) => (
                    <option key={off.id} value={off.id}>
                      {off.fullName} • {off.subCounty} ({off.email})
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          <div className="pt-3 border-t border-stone-100 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2.5 rounded-xl border border-stone-200 text-stone-600 text-sm font-semibold hover:bg-stone-50"
            >
              {t('cancelBtn')}
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={submitting || (mode === 'toOfficer' && !selectedOfficerId)}
              className="px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-sm font-bold shadow-sm flex items-center gap-2"
            >
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              {mode === 'toQueue' ? t('confirmBtn') : t('confirmReassign')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
