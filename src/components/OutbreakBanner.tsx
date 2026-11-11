import React, { useState } from 'react';
import { OutbreakAlert } from '../types';
import { OutbreakAlertCard } from './OutbreakAlertCard';
import { useLanguage } from '../contexts/LanguageContext';
import { ShieldAlert, ChevronDown, ChevronUp, History } from 'lucide-react';

interface OutbreakBannerProps {
  alerts: OutbreakAlert[];
  userSubCounty?: string;
  userCrop?: string;
  onNavigateDisease?: (diseaseSlugOrName: string) => void;
  onOpenReport?: (crop: string, symptoms: string) => void;
  onNavigateLibrary?: () => void;
}

export const OutbreakBanner: React.FC<OutbreakBannerProps> = ({
  alerts,
  userSubCounty,
  userCrop,
  onNavigateDisease,
  onOpenReport,
  onNavigateLibrary,
}) => {
  const { t, language } = useLanguage();
  const [showPastAlerts, setShowPastAlerts] = useState<boolean>(false);

  // Filter alerts relevant to the farmer's sub-county or county-wide, excluding any legacy 'urgent' test alert
  const sanitizedAlerts = alerts.filter(
    (a) => !(a.title || '').toLowerCase().includes('urgent') || a.status === 'Resolved' || a.active === false
  );

  const activeAlerts = sanitizedAlerts
    .filter((a) => a.active && a.status !== 'Resolved' && a.status !== 'Expired')
    .sort((a, b) => {
      // Sort Critical first, then Warning, then Advisory, then newest
      const sevOrder: { [key: string]: number } = { Critical: 3, High: 3, Warning: 2, Moderate: 2, Advisory: 1 };
      const rankA = sevOrder[a.severity] || 1;
      const rankB = sevOrder[b.severity] || 1;
      if (rankA !== rankB) return rankB - rankA;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

  const pastAlerts = sanitizedAlerts
    .filter((a) => !a.active || a.status === 'Resolved' || a.status === 'Expired')
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  if (activeAlerts.length === 0 && pastAlerts.length === 0) return null;

  return (
    <aside aria-label="Agricultural Outbreak Advisories" className="space-y-4 mb-8">
      {/* Active Alerts List */}
      {activeAlerts.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-[#EA580C]" />
            <h2 className="font-heading font-black text-sm uppercase tracking-wider text-[#0F4A2F]">
              {t('outbreakAlertsTitle')} ({activeAlerts.length})
            </h2>
          </div>

          <div className="space-y-3">
            {activeAlerts.map((alert) => (
              <OutbreakAlertCard
                key={alert.id}
                alert={alert}
                onNavigateDisease={onNavigateDisease || onNavigateLibrary}
                onOpenReport={onOpenReport}
              />
            ))}
          </div>
        </div>
      )}

      {/* Collapsed Past Alerts List */}
      {pastAlerts.length > 0 && (
        <div className="pt-2">
          <button
            type="button"
            onClick={() => setShowPastAlerts(!showPastAlerts)}
            className="min-h-[44px] px-4 py-2 rounded-full border border-[#D5CFC0] bg-[#FBFAF5] hover:bg-[#EAE5D9] text-[#52665C] text-xs font-bold flex items-center justify-between w-full sm:w-auto gap-3 transition-all"
          >
            <div className="flex items-center gap-2">
              <History className="w-3.5 h-3.5 text-[#687C73]" />
              <span>
                {t('pastAlertsHeading')} ({pastAlerts.length})
              </span>
            </div>
            {showPastAlerts ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          {showPastAlerts && (
            <div className="mt-3 space-y-3 pl-0 sm:pl-2 border-l-2 border-[#E7E2D5]">
              {pastAlerts.map((alert) => (
                <OutbreakAlertCard
                  key={alert.id}
                  alert={alert}
                  onNavigateDisease={onNavigateDisease || onNavigateLibrary}
                  onOpenReport={onOpenReport}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </aside>
  );
};
