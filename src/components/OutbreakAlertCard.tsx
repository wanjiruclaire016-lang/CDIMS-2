import React, { useState, useEffect } from 'react';
import { OutbreakAlert, AlertAcknowledgement } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { db } from '../firebase';
import { doc, setDoc, getDoc, collection, query, where, getDocs, updateDoc, increment } from 'firebase/firestore';
import { formatDateKE, formatRelativeTime } from '../utils/formatters';
import {
  ShieldAlert,
  MapPin,
  Sprout,
  Calendar,
  Phone,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  ArrowRight,
  PlusCircle,
  BookOpen,
  Users,
  Check,
  Ban,
  Clock,
} from 'lucide-react';

interface OutbreakAlertCardProps {
  alert: OutbreakAlert;
  onNavigateDisease?: (diseaseSlugOrName: string) => void;
  onOpenReport?: (crop: string, symptoms: string) => void;
}

export const OutbreakAlertCard: React.FC<OutbreakAlertCardProps> = ({
  alert,
  onNavigateDisease,
  onOpenReport,
}) => {
  const { currentUser, profile } = useAuth();
  const { t, language } = useLanguage();

  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [hasAcknowledged, setHasAcknowledged] = useState<boolean>(false);
  const [acknowledging, setAcknowledging] = useState<boolean>(false);
  const [ackCount, setAckCount] = useState<number>(alert.acknowledgementCount || 0);

  const isOfficerOrAdmin =
    profile?.role === 'officer' || profile?.role === 'admin' || profile?.role === 'superadmin';

  // Normalize severity
  const severityNorm = (alert.severity || '').toLowerCase();
  const isCritical = severityNorm === 'critical' || severityNorm === 'high';
  const isWarning = severityNorm === 'warning' || severityNorm === 'moderate';

  const severityLabel = isCritical
    ? t('severityCritical')
    : isWarning
    ? t('severityWarning')
    : t('severityAdvisory');

  const severityBarClass = isCritical
    ? 'border-l-4 border-l-[#DC2626]'
    : isWarning
    ? 'border-l-4 border-l-[#EA580C]'
    : 'border-l-4 border-l-[#D97706]';

  const severityTagClass = isCritical
    ? 'bg-[#FEE2E2] text-[#991B1B] border border-[#FCA5A5]'
    : isWarning
    ? 'bg-[#FFEDD5] text-[#9A3412] border border-[#FDBA74]'
    : 'bg-[#FEF3C7] text-[#92400E] border border-[#FDE68A]';

  const status = alert.status || (alert.active ? 'Active' : 'Resolved');

  const statusTagClass =
    status === 'Active'
      ? 'bg-[#DCFCE7] text-[#166534] border border-[#86EFAC]'
      : status === 'Resolved'
      ? 'bg-neutral-100 text-neutral-700 border border-neutral-300'
      : 'bg-stone-100 text-stone-600 border border-stone-200';

  // Check if current farmer has already acknowledged
  useEffect(() => {
    if (!currentUser) return;
    const ackId = `${alert.id}_${currentUser.uid}`;
    getDoc(doc(db, 'alertAcknowledgements', ackId)).then((snap) => {
      if (snap.exists()) {
        setHasAcknowledged(true);
      }
    }).catch(() => {});
  }, [alert.id, currentUser]);

  const handleAcknowledge = async () => {
    if (!currentUser || hasAcknowledged || acknowledging) return;
    setAcknowledging(true);
    try {
      const ackId = `${alert.id}_${currentUser.uid}`;
      const payload: AlertAcknowledgement = {
        id: ackId,
        alertId: alert.id,
        farmerId: currentUser.uid,
        farmerName: profile?.fullName || currentUser.email || 'Farmer',
        farmerPhone: profile?.phone || '',
        subCounty: profile?.subCounty || alert.subCounty,
        acknowledgedAt: new Date().toISOString(),
      };
      await setDoc(doc(db, 'alertAcknowledgements', ackId), payload);

      // Increment count on alert
      try {
        await updateDoc(doc(db, 'alerts', alert.id), {
          acknowledgementCount: increment(1),
        });
      } catch {}

      setHasAcknowledged(true);
      setAckCount((prev) => prev + 1);
    } catch (err) {
      console.error('Failed to acknowledge alert:', err);
    } finally {
      setAcknowledging(false);
    }
  };

  const actionItems = alert.actionItems && alert.actionItems.length > 0 ? alert.actionItems : [];
  const avoidItems = alert.avoidItems && alert.avoidItems.length > 0 ? alert.avoidItems : [];
  const contactPhone = alert.officerPhone || '0700000000';

  return (
    <div
      className={`bg-[#FBFAF5] rounded-3xl border border-[#E7E2D5] shadow-xs overflow-hidden transition-all ${severityBarClass}`}
    >
      <div className="p-4 sm:p-5">
        {/* Top Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-white border border-[#E7E2D5] shadow-2xs flex items-center justify-center shrink-0 mt-0.5">
              <ShieldAlert
                className={`w-5 h-5 ${
                  isCritical ? 'text-[#DC2626]' : isWarning ? 'text-[#EA580C]' : 'text-[#D97706]'
                }`}
              />
            </div>

            <div className="min-w-0">
              {/* Chips (Severity, Crop, Affected Area - Lucide line icons, NO emojis) */}
              <div className="flex flex-wrap items-center gap-1.5 mb-2">
                <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${severityTagClass}`}>
                  {severityLabel}
                </span>

                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#EAE5D9] text-[#0F4A2F]">
                  <Sprout className="w-3.5 h-3.5 text-[#2BC55B]" />
                  <span>{alert.crop}</span>
                </span>

                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#EAE5D9] text-[#0F4A2F]">
                  <MapPin className="w-3.5 h-3.5 text-[#2BC55B]" />
                  <span className="truncate max-w-[180px]">
                    {alert.allMachakos
                      ? 'All Machakos County'
                      : alert.subCounties && alert.subCounties.length > 0
                      ? alert.subCounties.join(', ')
                      : alert.subCounty}
                  </span>
                </span>
              </div>

              {/* Title (sentence case, bold) */}
              <h3 className="font-heading font-black text-base sm:text-lg text-[#0F4A2F] leading-snug">
                {alert.title}
              </h3>

              {/* Disease Name Link */}
              <div className="mt-1">
                <button
                  type="button"
                  onClick={() => onNavigateDisease && onNavigateDisease(alert.diseaseSlug || alert.diseaseName)}
                  className="text-xs font-bold text-[#166534] hover:text-[#0F4A2F] hover:underline inline-flex items-center gap-1"
                >
                  <span>{alert.diseaseName}</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>

              {/* Meta line: Issued by Officer [Name], [DD/MM/YYYY], [relative time], Status tag */}
              <div className="flex flex-wrap items-center gap-2 text-xs text-[#52665C] mt-2">
                <span>
                  {t('issuedByOfficer')} {alert.officerName} • {formatDateKE(alert.createdAt)} (
                  {formatRelativeTime(alert.createdAt, language)})
                </span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${statusTagClass}`}>
                  {status}
                </span>
              </div>
            </div>
          </div>

          {/* Expand / Collapse Button */}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="min-h-[44px] min-w-[44px] p-2 rounded-full hover:bg-[#EAE5D9] text-[#0F4A2F] flex items-center justify-center shrink-0 transition-all"
            aria-label={isExpanded ? 'Collapse' : 'Expand'}
          >
            {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
          </button>
        </div>

        {/* Expandable Body */}
        {isExpanded && (
          <div className="mt-4 pt-4 border-t border-[#E7E2D5] space-y-4 animate-in fade-in duration-150 text-xs sm:text-sm">
            {/* Summary */}
            <div className="p-3.5 rounded-2xl bg-white border border-[#E7E2D5] space-y-1">
              <h4 className="font-heading font-black text-xs uppercase tracking-wider text-[#0F4A2F]">
                {t('alertSummaryHeading')}
              </h4>
              <p className="text-xs text-[#2B3A33] leading-relaxed whitespace-pre-line">
                {alert.summary || alert.message}
              </p>
            </div>

            {/* Affected Area & Crops */}
            <div className="p-3.5 rounded-2xl bg-white border border-[#E7E2D5] space-y-1">
              <h4 className="font-heading font-black text-xs uppercase tracking-wider text-[#0F4A2F]">
                {t('affectedAreasCropsHeading')}
              </h4>
              <p className="text-xs text-[#2B3A33] leading-relaxed">
                <span className="font-semibold text-[#0F4A2F]">Crops:</span> {alert.crop}
                <br />
                <span className="font-semibold text-[#0F4A2F]">Areas:</span>{' '}
                {alert.allMachakos
                  ? 'All Machakos County'
                  : alert.subCounties && alert.subCounties.length > 0
                  ? alert.subCounties.join(', ')
                  : alert.subCounty}
                {alert.wards && alert.wards.length > 0 && ` (Wards: ${alert.wards.join(', ')})`}
              </p>
            </div>

            {/* What to do now (numbered checklist) */}
            {actionItems.length > 0 && (
              <div className="p-3.5 rounded-2xl bg-[#DCFCE7]/50 border border-[#86EFAC]/70 space-y-2">
                <h4 className="font-heading font-black text-xs uppercase tracking-wider text-[#166534]">
                  {t('whatToDoHeading')}
                </h4>
                <ol className="space-y-1.5 pl-1 text-xs text-[#2B3A33]">
                  {actionItems.map((item, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="w-5 h-5 rounded-full bg-[#2BC55B] text-[#0F4A2F] font-bold text-[11px] flex items-center justify-center shrink-0">
                        {idx + 1}
                      </span>
                      <span className="leading-relaxed mt-0.5">{item}</span>
                    </li>
                  ))}
                </ol>
              </div>
            )}

            {/* What to avoid */}
            {avoidItems.length > 0 && (
              <div className="p-3.5 rounded-2xl bg-[#FEE2E2]/50 border border-[#FCA5A5]/70 space-y-2">
                <div className="flex items-center gap-1.5 font-heading font-black text-xs uppercase tracking-wider text-[#991B1B]">
                  <Ban className="w-4 h-4 text-[#DC2626]" />
                  <span>{t('whatToAvoidHeading')}</span>
                </div>
                <ul className="space-y-1 pl-1 text-xs text-[#2B3A33]">
                  {avoidItems.map((item, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#DC2626] shrink-0 mt-2" />
                      <span className="leading-relaxed">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Officer Contact & Valid Until */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-3.5 rounded-2xl bg-white border border-[#E7E2D5] flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-bold text-[#687C73] uppercase tracking-wider block">
                    {t('whoToContactHeading')}
                  </span>
                  <span className="text-xs font-bold text-[#0F4A2F] block">
                    {alert.officerName}
                  </span>
                  <span className="text-xs text-[#52665C]">{contactPhone}</span>
                </div>

                <a
                  href={`tel:${contactPhone.replace(/\s+/g, '')}`}
                  className="min-h-[44px] px-3.5 py-2 rounded-full bg-[#0F4A2F] hover:bg-[#155e3c] text-white text-xs font-bold flex items-center gap-1.5 shadow-xs transition-all"
                >
                  <Phone className="w-3.5 h-3.5 text-[#2BC55B]" />
                  <span>{t('callOfficerBtn')}</span>
                </a>
              </div>

              <div className="p-3.5 rounded-2xl bg-white border border-[#E7E2D5] flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-bold text-[#687C73] uppercase tracking-wider block">
                    {t('validUntilLabel')}
                  </span>
                  <span className="text-xs font-bold text-[#0F4A2F]">
                    {alert.validUntil ? formatDateKE(alert.validUntil) : 'Until further notice'}
                  </span>
                </div>
                <Calendar className="w-5 h-5 text-[#2BC55B]" />
              </div>
            </div>
          </div>
        )}

        {/* Footer Actions */}
        <div className="pt-3.5 mt-3.5 border-t border-[#E7E2D5] flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
          {/* Officer Acknowledgement count */}
          <div className="flex items-center gap-1.5 text-xs text-[#52665C]">
            <Users className="w-4 h-4 text-[#2BC55B]" />
            <span>
              {ackCount} {t('farmersAcknowledged')}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Acknowledge Button */}
            {currentUser && !isOfficerOrAdmin && (
              <button
                type="button"
                onClick={handleAcknowledge}
                disabled={hasAcknowledged || acknowledging}
                className={`min-h-[44px] px-4 py-2 rounded-full text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-xs ${
                  hasAcknowledged
                    ? 'bg-[#DCFCE7] text-[#166534] border border-[#86EFAC]'
                    : 'bg-[#0F4A2F] hover:bg-[#155e3c] text-white'
                }`}
              >
                {hasAcknowledged ? <Check className="w-3.5 h-3.5" /> : <ShieldAlert className="w-3.5 h-3.5 text-[#2BC55B]" />}
                <span>{hasAcknowledged ? t('acknowledgedLabel') : t('acknowledgeBtn')}</span>
              </button>
            )}

            {/* View Disease Guide */}
            {onNavigateDisease && (
              <button
                type="button"
                onClick={() => onNavigateDisease(alert.diseaseSlug || alert.diseaseName)}
                className="min-h-[44px] px-3.5 py-2 rounded-full text-xs font-semibold text-[#0F4A2F] bg-[#EAE5D9] hover:bg-[#DDD7C8] flex items-center justify-center gap-1.5 transition-all"
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>{t('viewDiseaseGuideBtn')}</span>
              </button>
            )}

            {/* Report a Case */}
            {onOpenReport && (
              <button
                type="button"
                onClick={() => onOpenReport(alert.crop, `Responding to Outbreak Alert: ${alert.title}`)}
                className="min-h-[44px] px-3.5 py-2 rounded-full text-xs font-bold text-[#0F4A2F] bg-[#2BC55B] hover:bg-[#25ad50] flex items-center justify-center gap-1.5 transition-all shadow-xs"
              >
                <PlusCircle className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>{t('heroReportBtn')}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
