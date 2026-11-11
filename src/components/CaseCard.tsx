import React from 'react';
import { CaseItem, CaseStatus } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { formatDateKE } from '../utils/formatters';
import {
  Calendar,
  MapPin,
  User,
  Star,
  ArrowRight,
  Clock,
  CheckCircle2,
  Sprout,
  Edit,
  Stethoscope,
  Sparkles,
  UserCheck,
  Camera,
} from 'lucide-react';

interface CaseCardProps {
  caseItem: CaseItem;
  onOpen: (item: CaseItem) => void;
  onClaim?: (item: CaseItem) => void;
  showClaimButton?: boolean;
}

export const CaseCard: React.FC<CaseCardProps> = ({
  caseItem,
  onOpen,
  onClaim,
  showClaimButton = false,
}) => {
  const { t, language } = useLanguage();

  const getStatusBadge = (status: CaseStatus) => {
    switch (status) {
      case 'Submitted':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-800 border border-blue-200">
            <Clock className="w-3 h-3" />
            {t('statusSubmitted')}
          </span>
        );
      case 'Assigned':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-900 border border-amber-200">
            <User className="w-3 h-3" />
            {t('statusAssigned')}
          </span>
        );
      case 'In Review':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-50 text-purple-900 border border-purple-200">
            {t('statusInReview')}
          </span>
        );
      case 'Advice Given':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#DCFCE7] text-[#166534] border border-[#86EFAC]">
            <Sparkles className="w-3 h-3 text-[#2BC55B]" />
            {t('statusAdviceGiven')}
          </span>
        );
      case 'Resolved':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-[#0F4A2F] border border-emerald-300">
            <CheckCircle2 className="w-3 h-3 text-[#2BC55B]" />
            {t('statusResolved')}
          </span>
        );
      default:
        return null;
    }
  };

  const locationText = `${caseItem.subCounty}${caseItem.ward ? ` • ${caseItem.ward}` : ''}${caseItem.village ? ` (${caseItem.village})` : ''}`;

  return (
    <div
      onClick={() => onOpen(caseItem)}
      className="bg-[#FBFAF5] rounded-3xl border border-[#E7E2D5] shadow-xs hover:shadow-md transition-all p-5 flex flex-col justify-between cursor-pointer group hover:border-[#2BC55B] select-none"
    >
      <div>
        {/* Top Header: Crop & Status */}
        <div className="flex items-start justify-between gap-2 mb-3">
          <div>
            <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-[#0F4A2F] bg-[#EAE5D9] px-2.5 py-0.5 rounded-full">
              <Sprout className="w-3 h-3 text-[#2BC55B]" />
              <span>{caseItem.crop}</span>
            </span>

            {caseItem.cropCorrectedBy && (
              <div className="mt-1">
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-900 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                  <Edit className="w-3 h-3 text-amber-700" />
                  <span>
                    {language === 'sw' ? 'Zao lilisahihishwa na' : 'Crop corrected by'}{' '}
                    {caseItem.cropCorrectedBy}
                  </span>
                </span>
              </div>
            )}

            <p className="text-[11px] text-[#687C73] mt-1">
              ID: <span className="font-mono font-medium text-[#2B3A33]">{caseItem.id.slice(0, 10)}</span>
            </p>
          </div>
          {getStatusBadge(caseItem.status)}
        </div>

        {/* Photos Preview + Symptoms */}
        <div className="flex gap-3 mb-3.5">
          {caseItem.photoUrls && caseItem.photoUrls.length > 0 ? (
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl overflow-hidden shrink-0 border border-[#E7E2D5] bg-stone-100">
              <img
                src={caseItem.photoUrls[0]}
                alt="Crop symptom thumbnail"
                className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                loading="lazy"
              />
            </div>
          ) : caseItem.photoCount && caseItem.photoCount > 0 ? (
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-[#DCFCE7]/70 text-[#0F4A2F] flex flex-col items-center justify-center font-bold text-[10px] shrink-0 border border-[#86EFAC]/70">
              <Camera className="w-5 h-5 mb-0.5 text-[#0F4A2F]" />
              <span>{caseItem.photoCount} {caseItem.photoCount === 1 ? 'Photo' : 'Photos'}</span>
            </div>
          ) : (
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-[#DCFCE7]/50 text-[#166534] flex flex-col items-center justify-center font-bold text-[10px] shrink-0 border border-[#86EFAC]/50">
              <Sprout className="w-5 h-5 mb-0.5" />
              <span>No Photo</span>
            </div>
          )}

          <div className="flex-1 min-w-0">
            <p className="text-xs sm:text-sm text-[#2B3A33] line-clamp-2 leading-relaxed">
              {caseItem.symptomsDescription}
            </p>
            {caseItem.diagnosis && (
              <div className="mt-1.5 text-xs font-bold text-[#166534] flex items-center gap-1 truncate">
                <Stethoscope className="w-3.5 h-3.5 text-[#2BC55B] shrink-0" />
                <span className="truncate">{caseItem.diagnosis.diseaseName}</span>
              </div>
            )}
          </div>
        </div>

        {/* Metadata Details (Wrapped/tooltip location instead of cut with ...) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-[#52665C] pt-2.5 border-t border-[#E7E2D5] mb-3">
          <div className="flex items-center gap-1.5" title={locationText}>
            <MapPin className="w-3.5 h-3.5 text-[#2BC55B] shrink-0" />
            <span className="break-words leading-tight">{locationText}</span>
          </div>

          <div className="flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-[#2BC55B] shrink-0" />
            <span>{formatDateKE(caseItem.createdAt)}</span>
          </div>
        </div>

        {/* Assigned Officer / Rating */}
        <div className="flex items-center justify-between text-xs text-[#687C73] mb-1">
          <div className="flex items-center gap-1 truncate">
            <UserCheck className="w-3.5 h-3.5 text-[#0F4A2F] shrink-0" />
            <span className="font-semibold text-[#0F4A2F] truncate">
              {caseItem.assignedOfficerName ? (
                caseItem.assignedOfficerName
              ) : (
                <span className="text-amber-800 italic font-normal">
                  {language === 'sw' ? 'Inasubiri afisa' : 'Unassigned queue'}
                </span>
              )}
            </span>
          </div>

          {caseItem.rating && (
            <div className="flex items-center gap-1 text-amber-700 font-bold">
              <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-500" />
              <span>{caseItem.rating}/5</span>
            </div>
          )}
        </div>
      </div>

      {/* Action Footer with Circle Arrow button */}
      <div className="pt-3 border-t border-[#E7E2D5] flex items-center justify-between gap-2">
        <span className="text-xs font-bold text-[#0F4A2F] group-hover:text-[#2BC55B] transition-colors flex items-center gap-1">
          {language === 'sw' ? 'Fungua Ushauri' : 'View Consultation'}
        </span>

        <div className="flex items-center gap-2">
          {showClaimButton && onClaim && caseItem.status === 'Submitted' && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onClaim(caseItem);
              }}
              className="min-h-[44px] px-3.5 py-1.5 rounded-full text-xs font-bold bg-[#0F4A2F] hover:bg-[#155e3c] text-white shadow-xs transition-colors"
            >
              {t('claimCaseBtn')}
            </button>
          )}

          <div className="w-8 h-8 rounded-full border border-[#2BC55B] flex items-center justify-center text-[#0F4A2F] group-hover:bg-[#2BC55B] group-hover:text-white transition-all">
            <ArrowRight className="w-3.5 h-3.5" />
          </div>
        </div>
      </div>
    </div>
  );
};
