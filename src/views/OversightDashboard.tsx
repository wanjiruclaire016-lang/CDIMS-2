import React, { useState, useEffect } from 'react';
import {
  CaseItem,
  UserProfile,
  OutbreakAlert,
  AuditLogItem,
  UserRole,
} from '../types';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import {
  collection,
  onSnapshot,
  doc,
  updateDoc,
  setDoc,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { isCaseOverdue24h } from '../utils/caseFilters';
import { CaseChat } from '../components/CaseChat';
import { EditCropModal } from '../components/EditCropModal';
import {
  Activity,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Users,
  Eye,
  Flag,
  ArrowRight,
  ShieldCheck,
  ShieldAlert,
  Search,
  Filter,
  RefreshCw,
  X,
  MessageSquare,
  Calendar,
  MapPin,
  Loader2,
  Sparkles,
  Pencil,
  Crown,
  Sprout,
  Phone,
  UserCheck,
  FileText,
  Star,
} from 'lucide-react';
import { formatDateKE, formatDateTimeKE } from '../utils/formatters';

interface ActivityFeedItem {
  id: string;
  type: 'new_case' | 'claim' | 'status_change' | 'new_user' | 'alert' | 'audit';
  title: string;
  description: string;
  timestamp: string;
  badge?: string;
  badgeColor?: string;
}

export const OversightDashboard: React.FC = () => {
  const { profile, currentUser, isSuperAdminUser, recordAuditLog } = useAuth();
  const { t, language } = useLanguage();

  const [cases, setCases] = useState<CaseItem[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [alerts, setAlerts] = useState<OutbreakAlert[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Active view tab inside oversight
  const [oversightTab, setOversightTab] = useState<'feed' | 'unassigned' | 'workload' | 'monitoring'>('unassigned');

  // Manual Assignment modal
  const [assigningCase, setAssigningCase] = useState<CaseItem | null>(null);
  const [selectedOfficerId, setSelectedOfficerId] = useState<string>('');
  const [submittingAssign, setSubmittingAssign] = useState(false);
  const [assignFeedback, setAssignFeedback] = useState<string | null>(null);

  // Case Monitoring & Escalation modal
  const [monitoringCase, setMonitoringCase] = useState<CaseItem | null>(null);
  const [showEscalateModal, setShowEscalateModal] = useState(false);
  const [showEditCropModal, setShowEditCropModal] = useState(false);
  const [escalationReason, setEscalationReason] = useState('');
  const [submittingEscalation, setSubmittingEscalation] = useState(false);

  // Search in case monitoring
  const [monitorSearchQuery, setMonitorSearchQuery] = useState('');
  const [monitorFilter, setMonitorFilter] = useState<'all' | 'flagged' | 'low_rating'>('all');

  // Real-time synchronization
  useEffect(() => {
    const unsubCases = onSnapshot(collection(db, 'cases'), (snap) => {
      const list: CaseItem[] = [];
      snap.forEach((d) => {
        const data = d.data() as CaseItem;
        if (!data.deleted) list.push(data);
      });
      list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setCases(list);

      // Keep monitoring case in sync
      if (monitoringCase) {
        const updated = list.find((c) => c.id === monitoringCase.id);
        if (updated) setMonitoringCase(updated);
      }
    });

    const unsubUsers = onSnapshot(collection(db, 'users'), (snap) => {
      const list: UserProfile[] = [];
      snap.forEach((d) => list.push(d.data() as UserProfile));
      setUsers(list);
    });

    const unsubAlerts = onSnapshot(collection(db, 'alerts'), (snap) => {
      const list: OutbreakAlert[] = [];
      snap.forEach((d) => list.push(d.data() as OutbreakAlert));
      setAlerts(list);
    });

    const unsubAudit = onSnapshot(collection(db, 'auditLogs'), (snap) => {
      const list: AuditLogItem[] = [];
      snap.forEach((d) => list.push(d.data() as AuditLogItem));
      list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setAuditLogs(list);
      setLoading(false);
    });

    return () => {
      unsubCases();
      unsubUsers();
      unsubAlerts();
      unsubAudit();
    };
  }, [monitoringCase?.id]);

  // Verified officers list
  const verifiedOfficers = users.filter(
    (u) => u.role === 'officer' && u.officerStatus === 'verified'
  );

  // Build live activity feed from cases, users, alerts, and audit logs
  const buildActivityFeed = (): ActivityFeedItem[] => {
    const feed: ActivityFeedItem[] = [];

    // Cases submissions & status changes
    cases.forEach((c) => {
      feed.push({
        id: `c_sub_${c.id}`,
        type: 'new_case',
        title: `${language === 'sw' ? 'Kesi Mpya Imeripotiwa' : 'New Case Submitted'}: ${c.crop}`,
        description: `${c.farmerName} (${c.subCounty}) • ${c.symptomsDescription.slice(0, 90)}...`,
        timestamp: c.createdAt,
        badge: c.crop,
        badgeColor: 'bg-emerald-100 text-emerald-900',
      });

      if (c.status !== 'Submitted' && c.updatedAt) {
        feed.push({
          id: `c_st_${c.id}_${c.status}`,
          type: 'status_change',
          title: `${language === 'sw' ? 'Hali Imebadilishwa' : 'Status Updated'}: ${c.status}`,
          description: `Case ${c.id.slice(0, 8)} (${c.crop}) ${c.assignedOfficerName ? `by ${c.assignedOfficerName}` : ''}`,
          timestamp: c.updatedAt,
          badge: c.status,
          badgeColor: 'bg-amber-100 text-amber-900',
        });
      }

      if (c.escalated && c.escalatedAt) {
        feed.push({
          id: `c_esc_${c.id}`,
          type: 'audit',
          title: language === 'sw' ? 'Kesi Imepandishwa / Kutiliwa Shaka' : 'Case Flagged / Escalated',
          description: `Reason: ${c.escalationReason || 'Questionable diagnosis'} (By ${c.escalatedBy || 'Admin'})`,
          timestamp: c.escalatedAt,
          badge: 'ESCALATED',
          badgeColor: 'bg-red-100 text-red-900',
        });
      }

      if (c.cropCorrectedBy && c.cropCorrectedAt) {
        feed.push({
          id: `c_crop_${c.id}_${c.cropCorrectedAt}`,
          type: 'status_change',
          title: `${language === 'sw' ? 'Zao Limesahihishwa' : 'Crop Corrected'}: ${c.crop}`,
          description: `Case #${c.id.slice(0, 8)} corrected by ${c.cropCorrectedBy}${c.previousCrop ? ` (was ${c.previousCrop})` : ''}`,
          timestamp: c.cropCorrectedAt,
          badge: 'Crop Corrected',
          badgeColor: 'bg-amber-100 text-amber-900 border border-amber-300',
        });
      }
    });

    // Outbreak Alerts
    alerts.forEach((a) => {
      feed.push({
        id: `alt_${a.id}`,
        type: 'alert',
        title: `${language === 'sw' ? 'Tahadhari ya Mlipuko' : 'Outbreak Alert'}: ${a.title}`,
        description: `${a.subCounty} • ${a.crop} • Issued by ${a.officerName}`,
        timestamp: a.createdAt,
        badge: `${a.severity} Alert`,
        badgeColor: a.severity === 'High' ? 'bg-red-600 text-white' : 'bg-amber-600 text-white',
      });
    });

    // New registrations from users
    users.forEach((u) => {
      if (u.role === 'officer' && u.officerStatus === 'pending') {
        feed.push({
          id: `usr_${u.id}`,
          type: 'new_user',
          title: language === 'sw' ? 'Usajili Mpya wa Afisa' : 'New Officer Registration',
          description: `${u.fullName} (${u.subCounty}) awaiting admin credentials verification`,
          timestamp: u.createdAt,
          badge: 'Pending',
          badgeColor: 'bg-amber-100 text-amber-900',
        });
      }
    });

    // Sort feed newest first
    feed.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    return feed.slice(0, 40);
  };

  // Unassigned cases with >24h overdue calculation
  const unassignedCases = cases.filter(
    (c) => c.status === 'Submitted' && !c.assignedOfficerId
  );
  const overdueCases = unassignedCases.filter((c) => isCaseOverdue24h(c));

  // Compute officer workload map
  const officerWorkloadStats = verifiedOfficers.map((officer) => {
    const activeOpenCases = cases.filter(
      (c) =>
        c.assignedOfficerId === officer.id &&
        c.status !== 'Resolved'
    );
    const resolvedCases = cases.filter(
      (c) =>
        c.assignedOfficerId === officer.id &&
        c.status === 'Resolved'
    );

    let workloadLevel: 'Light' | 'Balanced' | 'Heavy' = 'Light';
    if (activeOpenCases.length >= 6) workloadLevel = 'Heavy';
    else if (activeOpenCases.length >= 3) workloadLevel = 'Balanced';

    return {
      officer,
      openCount: activeOpenCases.length,
      resolvedCount: resolvedCases.length,
      workloadLevel,
    };
  });

  // Handle Manual Assignment with notification to both farmer & officer
  const handleConfirmAssignment = async () => {
    if (!assigningCase || !selectedOfficerId) return;

    setSubmittingAssign(true);
    setAssignFeedback(null);

    const targetOfficer = users.find((u) => u.id === selectedOfficerId);
    if (!targetOfficer) return;

    const nowIso = new Date().toISOString();
    const caseRef = doc(db, 'cases', assigningCase.id);

    try {
      // 1. Update case assignment & status
      await updateDoc(caseRef, {
        assignedOfficerId: targetOfficer.id,
        assignedOfficerName: targetOfficer.fullName,
        status: 'Assigned',
        updatedAt: nowIso,
      });

      // 2. Insert notification message in case chat so farmer and officer see it
      const msgId = `sys_assign_${Date.now()}`;
      await setDoc(doc(db, 'cases', assigningCase.id, 'messages', msgId), {
        id: msgId,
        caseId: assigningCase.id,
        senderId: currentUser?.uid || 'admin',
        senderName: profile?.fullName || 'Oversight Administrator',
        senderRole: 'system',
        text: `${language === 'sw' ? 'Msimamizi amemkabidhi kesi hii afisa kilimo' : 'Admin assigned this case to extension officer'} ${targetOfficer.fullName} (${targetOfficer.subCounty}).`,
        createdAt: nowIso,
      });

      // 3. Record in audit log
      await recordAuditLog(
        'MANUAL_ASSIGNMENT',
        assigningCase.id,
        `Case ${assigningCase.id} (${assigningCase.crop}) assigned to ${targetOfficer.fullName} (${targetOfficer.id}) by Admin ${profile?.fullName}`
      );

      setAssignFeedback(t('manualAssignSuccess'));
      setTimeout(() => {
        setAssigningCase(null);
        setAssignFeedback(null);
      }, 1500);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `cases/${assigningCase.id}`);
    } finally {
      setSubmittingAssign(false);
    }
  };

  // Handle Flag / Escalate Case
  const handleSaveEscalation = async () => {
    if (!monitoringCase) return;
    setSubmittingEscalation(true);

    const nowIso = new Date().toISOString();
    const caseRef = doc(db, 'cases', monitoringCase.id);

    try {
      const isCurrentlyEscalated = monitoringCase.escalated;
      if (isCurrentlyEscalated) {
        // De-escalate / Resolve flag
        await updateDoc(caseRef, {
          escalated: false,
          flaggedForReview: false,
          escalationReason: '',
          updatedAt: nowIso,
        });

        await recordAuditLog(
          'CASE_DEESCALATED',
          monitoringCase.id,
          `Escalation flag resolved for case ${monitoringCase.id} by Admin ${profile?.fullName}`
        );
      } else {
        // Escalate case
        await updateDoc(caseRef, {
          escalated: true,
          flaggedForReview: true,
          escalationReason: escalationReason.trim() || 'Escalated by administrator for review',
          escalatedBy: profile?.fullName || 'Administrator',
          escalatedAt: nowIso,
          updatedAt: nowIso,
        });

        // Add system message
        const msgId = `sys_esc_${Date.now()}`;
        await setDoc(doc(db, 'cases', monitoringCase.id, 'messages', msgId), {
          id: msgId,
          caseId: monitoringCase.id,
          senderId: currentUser?.uid || 'admin',
          senderName: profile?.fullName || 'Oversight Administrator',
          senderRole: 'system',
          text: `Case flagged for quality review: "${escalationReason.trim()}"`,
          createdAt: nowIso,
        });

        await recordAuditLog(
          'CASE_ESCALATED',
          monitoringCase.id,
          `Case ${monitoringCase.id} flagged: ${escalationReason.trim()} by Admin ${profile?.fullName}`
        );
      }

      setShowEscalateModal(false);
      setEscalationReason('');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `cases/${monitoringCase.id}`);
    } finally {
      setSubmittingEscalation(false);
    }
  };

  // Filter cases for Monitoring view
  const filteredMonitoringCases = cases.filter((c) => {
    if (monitorFilter === 'flagged' && !c.escalated) return false;
    if (monitorFilter === 'low_rating' && (!c.rating || c.rating > 2)) return false;

    if (monitorSearchQuery.trim()) {
      const q = monitorSearchQuery.toLowerCase().trim();
      const match =
        c.farmerName?.toLowerCase().includes(q) ||
        c.crop?.toLowerCase().includes(q) ||
        c.subCounty?.toLowerCase().includes(q) ||
        c.assignedOfficerName?.toLowerCase().includes(q) ||
        c.diagnosis?.diseaseName?.toLowerCase().includes(q);
      if (!match) return false;
    }
    return true;
  });

  const activityFeed = buildActivityFeed();

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Top Banner with Role Pill */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-1.5 rounded-xl bg-purple-100 text-purple-900 flex items-center gap-1 font-bold text-xs">
              <Activity className="w-4 h-4 text-purple-700" />
              <span>{t('navOversight')}</span>
            </span>
            {isSuperAdminUser ? (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-950 border border-amber-300 inline-flex items-center gap-1">
                <Crown className="w-3.5 h-3.5 text-amber-800" />
                <span>Super Admin</span>
              </span>
            ) : (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-950 border border-emerald-300 inline-flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-800" />
                <span>Admin</span>
              </span>
            )}
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-stone-900 tracking-tight">
            {language === 'sw' ? 'Kituo cha Ukaguzi na Usimamizi' : 'Agricultural Oversight & Quality Control'}
          </h1>
          <p className="text-xs sm:text-sm text-stone-600 mt-0.5">
            CropCare Centre Machakos County • Real-time SLA monitoring, workload balancing & case quality review
          </p>
        </div>

        {/* Quick SLA Counter */}
        <div className="flex items-center gap-3">
          <div className="bg-white px-4 py-2 rounded-2xl border border-stone-200 shadow-2xs text-center">
            <span className="text-[10px] font-bold uppercase tracking-wider text-stone-500 block">
              {language === 'sw' ? 'Kesi Wazi' : 'Unassigned'}
            </span>
            <span className="text-xl font-black text-amber-700 block">{unassignedCases.length}</span>
          </div>

          <div className={`px-4 py-2 rounded-2xl border shadow-2xs text-center ${
            overdueCases.length > 0
              ? 'bg-red-50 border-red-300 text-red-950 animate-pulse'
              : 'bg-emerald-50 border-emerald-300 text-emerald-950'
          }`}>
            <span className="text-[10px] font-bold uppercase tracking-wider block opacity-80">
              {t('overdueBadge')}
            </span>
            <span className="text-xl font-black block">{overdueCases.length}</span>
          </div>
        </div>
      </div>

      {/* Oversight Tabs */}
      <div className="flex items-center gap-2 border-b border-stone-200 pb-3 mb-6 overflow-x-auto scrollbar-none">
        <button
          onClick={() => setOversightTab('unassigned')}
          className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 whitespace-nowrap transition-colors ${
            oversightTab === 'unassigned'
              ? 'bg-[#1e4620] text-amber-300 shadow-sm'
              : 'bg-white text-stone-600 border border-stone-200 hover:bg-stone-50'
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>{t('unassignedOverdueTitle')}</span>
          {overdueCases.length > 0 && (
            <span className="px-1.5 py-0.5 rounded-full bg-red-600 text-white text-[10px] font-black">
              {overdueCases.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setOversightTab('workload')}
          className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 whitespace-nowrap transition-colors ${
            oversightTab === 'workload'
              ? 'bg-[#1e4620] text-amber-300 shadow-sm'
              : 'bg-white text-stone-600 border border-stone-200 hover:bg-stone-50'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>{t('officerWorkloadTitle')}</span>
          <span className="px-1.5 py-0.5 rounded-full bg-stone-100 text-stone-700 text-[10px]">
            {verifiedOfficers.length}
          </span>
        </button>

        <button
          onClick={() => setOversightTab('monitoring')}
          className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 whitespace-nowrap transition-colors ${
            oversightTab === 'monitoring'
              ? 'bg-[#1e4620] text-amber-300 shadow-sm'
              : 'bg-white text-stone-600 border border-stone-200 hover:bg-stone-50'
          }`}
        >
          <Eye className="w-4 h-4" />
          <span>{t('caseMonitoringTitle')}</span>
        </button>

        <button
          onClick={() => setOversightTab('feed')}
          className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 whitespace-nowrap transition-colors ${
            oversightTab === 'feed'
              ? 'bg-[#1e4620] text-amber-300 shadow-sm'
              : 'bg-white text-stone-600 border border-stone-200 hover:bg-stone-50'
          }`}
        >
          <Activity className="w-4 h-4" />
          <span>{t('liveActivityTitle')}</span>
        </button>
      </div>

      {/* TAB 1: UNASSIGNED CASES & OVERDUE SLA */}
      {oversightTab === 'unassigned' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-stone-900">{t('unassignedOverdueTitle')}</h2>
              <p className="text-xs text-stone-500">
                {language === 'sw'
                  ? 'Kesi zilizowasilishwa ambazo bado hazijachukuliwa na afisa. Kesi iliyozidi saa 24 huwekwa alama ya dharura.'
                  : 'Farmer reports awaiting assignment. Cases pending for over 24 hours are highlighted as SLA overdue.'}
              </p>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-stone-100 text-stone-700">
              {unassignedCases.length} total unassigned
            </span>
          </div>

          {unassignedCases.length === 0 ? (
            <div className="bg-white rounded-3xl border border-stone-200 p-8 sm:p-12 text-center max-w-md mx-auto shadow-xs">
              <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center mx-auto mb-3">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h3 className="font-bold text-stone-900 text-sm mb-1">
                {language === 'sw' ? 'Hakuna Kesi Zisizokabidhiwa' : 'All cases assigned!'}
              </h3>
              <p className="text-xs text-stone-600 leading-relaxed">
                {language === 'sw'
                  ? 'Kesi zote za wakulima zimekabidhiwa kwa maafisa kilimo.'
                  : 'Great job! Every submitted farmer report has been assigned or claimed.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {unassignedCases.map((c) => {
                const isOverdue = isCaseOverdue24h(c);
                const elapsedHours = Math.round(
                  (Date.now() - new Date(c.createdAt).getTime()) / (3600 * 1000)
                );

                return (
                  <div
                    key={c.id}
                    className={`bg-white rounded-2xl border p-5 shadow-xs flex flex-col justify-between space-y-3 transition-all ${
                      isOverdue
                        ? 'border-red-400 bg-red-50/30 ring-1 ring-red-300'
                        : 'border-stone-200'
                    }`}
                  >
                    <div>
                      {/* Top status */}
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200 inline-flex items-center gap-1">
                          <Sprout className="w-3 h-3 text-emerald-700" />
                          <span>{c.crop}</span>
                        </span>

                        {isOverdue ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-red-600 text-white shadow-2xs animate-pulse">
                            <AlertTriangle className="w-3 h-3" />
                            {t('overdueBadge')} ({elapsedHours}h)
                          </span>
                        ) : (
                          <span className="text-[11px] text-stone-500 font-medium flex items-center gap-1">
                            <Clock className="w-3 h-3 text-stone-400" />
                            Waiting {elapsedHours}h
                          </span>
                        )}
                      </div>

                      <h4 className="font-bold text-base text-stone-900">{c.farmerName}</h4>
                      <p className="text-xs text-stone-600 flex items-center gap-2 flex-wrap">
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-stone-400" />
                          <span>{c.subCounty} {c.ward ? `• ${c.ward}` : ''}</span>
                        </span>
                        <span>•</span>
                        <span className="inline-flex items-center gap-1">
                          <Phone className="w-3 h-3 text-stone-400" />
                          <span>{c.farmerPhone}</span>
                        </span>
                      </p>

                      <p className="text-xs text-stone-700 bg-stone-50 p-2.5 rounded-xl border border-stone-200 mt-2.5 line-clamp-3 leading-relaxed">
                        {c.symptomsDescription}
                      </p>
                    </div>

                    <div className="pt-2 border-t border-stone-100 flex items-center justify-between gap-2">
                      <button
                        onClick={() => setMonitoringCase(c)}
                        className="px-3 py-1.5 rounded-xl border border-stone-200 text-stone-700 hover:bg-stone-50 text-xs font-semibold flex items-center gap-1"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>{language === 'sw' ? 'Kagua Kesi' : 'Inspect'}</span>
                      </button>

                      <button
                        onClick={() => {
                          setAssigningCase(c);
                          if (verifiedOfficers.length > 0) {
                            setSelectedOfficerId(verifiedOfficers[0].id);
                          }
                        }}
                        className="px-3.5 py-1.5 rounded-xl bg-[#1e4620] hover:bg-[#285d2b] text-white text-xs font-bold shadow-xs flex items-center gap-1"
                      >
                        <Users className="w-3.5 h-3.5" />
                        <span>{language === 'sw' ? 'Mkabidhi Afisa' : 'Assign Officer'}</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: OFFICER WORKLOAD BALANCE */}
      {oversightTab === 'workload' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-stone-900">{t('officerWorkloadTitle')}</h2>
              <p className="text-xs text-stone-500">
                {language === 'sw'
                  ? 'Kagua mzigo wa kazi wa kila afisa kilimo aliyethibitishwa ili kuhakikisha huduma zinasambazwa kwa usawa.'
                  : 'Monitor active case distribution across verified extension officers to balance response times.'}
              </p>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-stone-100 text-stone-700">
              {verifiedOfficers.length} verified officers
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {officerWorkloadStats.map(({ officer, openCount, resolvedCount, workloadLevel }) => {
              const badgeBg =
                workloadLevel === 'Light'
                  ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                  : workloadLevel === 'Balanced'
                  ? 'bg-amber-100 text-amber-900 border-amber-300'
                  : 'bg-red-100 text-red-900 border-red-300';

              return (
                <div
                  key={officer.id}
                  className="bg-white rounded-2xl border border-stone-200 p-5 shadow-xs flex flex-col justify-between space-y-4"
                >
                  <div>
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h4 className="font-bold text-base text-stone-900">{officer.fullName}</h4>
                        <p className="text-xs text-stone-500">{officer.email}</p>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${badgeBg}`}>
                        {workloadLevel} Load
                      </span>
                    </div>

                    <div className="p-3 rounded-xl bg-stone-50 border border-stone-200 text-xs space-y-1 mb-3">
                      <p>
                        <strong className="text-stone-700">Phone:</strong> {officer.phone}
                      </p>
                      <p>
                        <strong className="text-stone-700">Sub-County:</strong> {officer.subCounty}
                      </p>
                      <p>
                        <strong className="text-stone-700">Staff ID:</strong>{' '}
                        <span className="font-mono">{officer.officerIdNumber || '—'}</span>
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-center">
                      <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200">
                        <span className="text-lg font-black text-amber-900 block">{openCount}</span>
                        <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wider">
                          Active Cases
                        </span>
                      </div>
                      <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200">
                        <span className="text-lg font-black text-emerald-900 block">{resolvedCount}</span>
                        <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider">
                          Resolved
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-stone-100">
                    <span className="text-[11px] text-stone-500 flex items-center justify-center gap-1.5 text-center">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${
                        workloadLevel === 'Light'
                          ? 'bg-emerald-500'
                          : workloadLevel === 'Balanced'
                          ? 'bg-amber-500'
                          : 'bg-red-500'
                      }`} />
                      <span>
                        {workloadLevel === 'Light'
                          ? 'High capacity to take new cases'
                          : workloadLevel === 'Balanced'
                          ? 'Normal capacity'
                          : 'Near capacity - prioritize lighter officers'}
                      </span>
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 3: CASE MONITORING & ESCALATION */}
      {oversightTab === 'monitoring' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-stone-900">{t('caseMonitoringTitle')}</h2>
              <p className="text-xs text-stone-500">
                {language === 'sw'
                  ? 'Kagua mazungumzo ya kesi zote katika hali ya kusoma tu kwa ukaguzi wa ubora na utatuzi wa migogoro.'
                  : 'Audit case consultation discussions in read-only mode to maintain advice quality and handle complaints.'}
              </p>
            </div>

            {/* Search & filter pills */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="w-4 h-4 text-stone-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={monitorSearchQuery}
                  onChange={(e) => setMonitorSearchQuery(e.target.value)}
                  placeholder="Search farmer, crop, officer..."
                  className="bg-white border border-stone-200 rounded-xl pl-8 pr-3 py-1.5 text-xs text-stone-900"
                />
              </div>

              <div className="flex items-center gap-1 text-xs">
                <button
                  onClick={() => setMonitorFilter('all')}
                  className={`px-2.5 py-1.5 rounded-lg font-bold ${
                    monitorFilter === 'all' ? 'bg-[#1e4620] text-amber-300' : 'bg-white border text-stone-600'
                  }`}
                >
                  All
                </button>
                <button
                  onClick={() => setMonitorFilter('flagged')}
                  className={`px-2.5 py-1.5 rounded-lg font-bold flex items-center gap-1 ${
                    monitorFilter === 'flagged' ? 'bg-red-600 text-white' : 'bg-white border text-red-700'
                  }`}
                >
                  <AlertTriangle className="w-3 h-3" />
                  <span>Flagged</span>
                </button>
                <button
                  onClick={() => setMonitorFilter('low_rating')}
                  className={`px-2.5 py-1.5 rounded-lg font-bold flex items-center gap-1 ${
                    monitorFilter === 'low_rating' ? 'bg-amber-600 text-white' : 'bg-white border text-amber-800'
                  }`}
                >
                  <Star className="w-3 h-3" />
                  <span>Low Rating</span>
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredMonitoringCases.map((c) => (
              <div
                key={c.id}
                className={`bg-white rounded-2xl border p-5 shadow-xs flex flex-col justify-between space-y-3 cursor-pointer hover:border-emerald-600/60 transition-all ${
                  c.escalated ? 'border-red-400 bg-red-50/20' : 'border-stone-200'
                }`}
                onClick={() => setMonitoringCase(c)}
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200 inline-flex items-center gap-1">
                      <Sprout className="w-3 h-3 text-emerald-700" />
                      <span>{c.crop}</span>
                    </span>

                    {c.escalated && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-red-600 text-white flex items-center gap-1 shadow-2xs">
                        <Flag className="w-3 h-3" />
                        {t('escalatedBadge')}
                      </span>
                    )}

                    {!c.escalated && c.rating && c.rating <= 2 && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300 inline-flex items-center gap-1">
                        <Star className="w-3 h-3 text-amber-700 fill-amber-500" />
                        <span>Rating: {c.rating}/5</span>
                      </span>
                    )}
                  </div>

                  <h4 className="font-bold text-base text-stone-900">{c.farmerName}</h4>
                  <p className="text-xs text-stone-500 flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-stone-400" />
                    <span>{c.subCounty} • Officer: {c.assignedOfficerName || 'Unassigned'}</span>
                  </p>

                  {c.escalated && c.escalationReason && (
                    <div className="p-2.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-900 mt-2">
                      <strong className="block text-[11px] text-red-800 uppercase font-black">
                        Escalation Note:
                      </strong>
                      {c.escalationReason}
                    </div>
                  )}

                  <p className="text-xs text-stone-700 bg-stone-50 p-2.5 rounded-xl border border-stone-200 mt-2 line-clamp-2">
                    {c.symptomsDescription}
                  </p>
                </div>

                <div className="pt-2 border-t border-stone-100 flex items-center justify-between text-xs font-semibold text-emerald-800">
                  <span className="flex items-center gap-1">
                    <Eye className="w-3.5 h-3.5" />
                    <span>{language === 'sw' ? 'Kagua Mazungumzo (Kusoma Tu)' : 'Audit Thread (Read-Only)'}</span>
                  </span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 4: LIVE ACTIVITY FEED */}
      {oversightTab === 'feed' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-stone-900">{t('liveActivityTitle')}</h2>
              <p className="text-xs text-stone-500">
                {language === 'sw'
                  ? 'Matukio ya hivi punde ya kesi, madai ya maafisa, mabadiliko ya hali, na tahadhari.'
                  : 'Real-time chronological activity across cases, officer claims, outbreak alerts, and registrations.'}
              </p>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-stone-100 text-stone-700">
              {activityFeed.length} recent events
            </span>
          </div>

          <div className="bg-white rounded-3xl border border-stone-200 overflow-hidden shadow-xs divide-y divide-stone-100">
            {activityFeed.length === 0 ? (
              <div className="p-12 text-center text-stone-400 text-sm">
                No activity recorded yet.
              </div>
            ) : (
              activityFeed.map((item) => (
                <div key={item.id} className="p-4 hover:bg-stone-50/70 transition-colors flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl bg-stone-100 text-stone-600 flex items-center justify-center shrink-0 mt-0.5">
                    {item.type === 'new_case' ? (
                      <Sprout className="w-4 h-4 text-emerald-700" />
                    ) : item.type === 'alert' ? (
                      <ShieldAlert className="w-4 h-4 text-red-600" />
                    ) : item.type === 'claim' ? (
                      <UserCheck className="w-4 h-4 text-blue-600" />
                    ) : (
                      <FileText className="w-4 h-4 text-stone-600" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <h4 className="font-bold text-sm text-stone-900 truncate">{item.title}</h4>
                      {item.badge && (
                        <span className={`px-2 py-0.2 rounded-full text-[10px] font-bold ${item.badgeColor}`}>
                          {item.badge}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-stone-600 leading-relaxed">{item.description}</p>
                    <span className="text-[11px] text-stone-400 mt-1 block">
                      {formatDateTimeKE(item.timestamp)}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Manual Assignment Modal */}
      {assigningCase && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl border border-stone-200">
            <div className="flex items-center justify-between pb-3 border-b border-stone-100 mb-5">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-stone-900">
                    {language === 'sw' ? 'Ugawaji wa Kesi na Taarifa' : 'Assign Case to Officer'}
                  </h3>
                  <p className="text-xs text-stone-500">
                    {assigningCase.crop} • {assigningCase.farmerName} ({assigningCase.subCounty})
                  </p>
                </div>
              </div>
              <button
                onClick={() => setAssigningCase(null)}
                className="p-1.5 rounded-full hover:bg-stone-100 text-stone-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {assignFeedback && (
              <div className="p-3 mb-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-bold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>{assignFeedback}</span>
              </div>
            )}

            <div className="space-y-4 text-xs">
              <p className="text-stone-600">
                {language === 'sw'
                  ? 'Chagua afisa kilimo aliyethibitishwa. Mfumo utamjulisha mkulima na afisa moja kwa moja kwenye mazungumzo ya kesi.'
                  : 'Select an officer below. Both the farmer and officer will receive a direct notification in the case discussion.'}
              </p>

              <div>
                <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
                  {t('selectOfficer')} *
                </label>
                {verifiedOfficers.length === 0 ? (
                  <p className="text-amber-800 bg-amber-50 p-2.5 rounded-xl border border-amber-200">
                    No verified officers available. Approve officers first in Admin Centre.
                  </p>
                ) : (
                  <select
                    value={selectedOfficerId}
                    onChange={(e) => setSelectedOfficerId(e.target.value)}
                    className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3.5 py-2.5 text-xs text-stone-900"
                  >
                    {verifiedOfficers.map((off) => {
                      const load = cases.filter(
                        (c) => c.assignedOfficerId === off.id && c.status !== 'Resolved'
                      ).length;
                      return (
                        <option key={off.id} value={off.id}>
                          {off.fullName} • {off.subCounty} ({load} active cases)
                        </option>
                      );
                    })}
                  </select>
                )}
              </div>

              <div className="pt-3 border-t border-stone-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setAssigningCase(null)}
                  disabled={submittingAssign}
                  className="px-4 py-2 rounded-xl border border-stone-200 text-stone-600 text-xs font-semibold"
                >
                  {t('cancelBtn')}
                </button>
                <button
                  type="button"
                  onClick={handleConfirmAssignment}
                  disabled={submittingAssign || !selectedOfficerId}
                  className="px-5 py-2.5 rounded-xl bg-[#1e4620] hover:bg-[#285d2b] text-white text-xs font-bold shadow-sm flex items-center gap-1.5"
                >
                  {submittingAssign && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{language === 'sw' ? 'Wasilisha na Mjulishe Mkulima' : 'Assign & Notify'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Case Monitoring Inspection Modal (Read-Only Thread + Escalation Option) */}
      {monitoringCase && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-3xl w-full p-5 sm:p-7 shadow-2xl border border-stone-200 my-6 max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-stone-100 shrink-0">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200 inline-flex items-center gap-1">
                    <Sprout className="w-3.5 h-3.5 text-emerald-700" />
                    <span>{monitoringCase.crop}</span>
                  </span>
                  <span className="text-xs font-mono text-stone-500">
                    ID: {monitoringCase.id.slice(0, 8)}
                  </span>
                  <button
                    onClick={() => setShowEditCropModal(true)}
                    className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 text-xs font-bold shadow-2xs transition-colors"
                    title={language === 'sw' ? 'Sahihisha Zao' : 'Edit Crop'}
                  >
                    <Pencil className="w-3 h-3 text-amber-700" />
                    <span>{language === 'sw' ? 'Sahihisha Zao' : 'Edit Crop'}</span>
                  </button>
                  {monitoringCase.escalated && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-red-600 text-white shadow-2xs">
                      FLAGGED FOR REVIEW
                    </span>
                  )}
                </div>
                {monitoringCase.cropCorrectedBy && (
                  <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-900 bg-amber-100/80 px-2 py-0.5 rounded-md border border-amber-300">
                      <Pencil className="w-3 h-3 text-amber-700" />
                      <span>{language === 'sw' ? 'Zao lilisahihishwa na' : 'Crop corrected by'} {monitoringCase.cropCorrectedBy}</span>
                    </span>
                    {monitoringCase.previousCrop && (
                      <span className="text-[11px] text-stone-500">
                        ({language === 'sw' ? 'awali' : 'previously'}: {monitoringCase.previousCrop})
                      </span>
                    )}
                  </div>
                )}
                <h3 className="font-bold text-lg text-stone-900 mt-1">
                  {monitoringCase.farmerName} • {monitoringCase.subCounty}
                </h3>
              </div>
              <button
                onClick={() => setMonitoringCase(null)}
                className="p-1.5 rounded-full hover:bg-stone-100 text-stone-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Oversight Actions Bar */}
            <div className="py-2.5 px-4 bg-stone-50 border-b border-stone-200 flex flex-wrap items-center justify-between gap-2 shrink-0 text-xs">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-stone-600">Officer:</span>
                <span className="font-bold text-stone-900">
                  {monitoringCase.assignedOfficerName || 'Unassigned'}
                </span>
                <span>•</span>
                <span className="font-semibold text-stone-600">Status:</span>
                <span className="font-bold px-2 py-0.2 rounded-full bg-amber-100 text-amber-900">
                  {monitoringCase.status}
                </span>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {/* Edit Crop button for Admin */}
                <button
                  onClick={() => setShowEditCropModal(true)}
                  className="px-3 py-1.5 rounded-xl border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-900 font-bold flex items-center gap-1.5 shadow-2xs"
                >
                  <Pencil className="w-3.5 h-3.5 text-amber-700" />
                  <span>{language === 'sw' ? 'Sahihisha Zao' : 'Edit Crop'}</span>
                </button>

                {/* Flag / Escalate button */}
                <button
                  onClick={() => {
                    setEscalationReason(monitoringCase.escalationReason || '');
                    setShowEscalateModal(true);
                  }}
                  className={`px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5 transition-colors shadow-2xs ${
                    monitoringCase.escalated
                      ? 'bg-stone-200 hover:bg-stone-300 text-stone-800'
                      : 'bg-red-600 hover:bg-red-700 text-white'
                  }`}
                >
                  <Flag className="w-3.5 h-3.5" />
                  <span>
                    {monitoringCase.escalated
                      ? t('deescalateCaseBtn')
                      : t('escalateCaseBtn')}
                  </span>
                </button>
              </div>
            </div>

            {/* Content & Read-Only Chat Thread */}
            <div className="flex-1 overflow-y-auto py-4 space-y-4">
              {/* Symptoms & Diagnosis Summary */}
              <div className="p-3.5 rounded-2xl bg-stone-50 border border-stone-200 text-xs space-y-2">
                <p>
                  <strong className="text-stone-700">Symptoms Observed:</strong> {monitoringCase.symptomsDescription}
                </p>
                {monitoringCase.diagnosis && (
                  <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-950">
                    <strong className="block mb-0.5">Diagnosed: {monitoringCase.diagnosis.diseaseName}</strong>
                    <p>{monitoringCase.diagnosis.treatmentAdvice}</p>
                  </div>
                )}
                {monitoringCase.rating && (
                  <p className="font-bold text-amber-800">
                    ⭐ Farmer Rating: {monitoringCase.rating}/5{' '}
                    {monitoringCase.ratingFeedback ? `("${monitoringCase.ratingFeedback}")` : ''}
                  </p>
                )}
              </div>

              {/* Consultation Thread (Read-Only Mode) */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-stone-700 mb-1.5">
                  Consultation Discussion (Read-Only Oversight)
                </h4>
                <CaseChat caseId={monitoringCase.id} readOnly={true} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Flag / Escalate Confirmation Modal */}
      {showEscalateModal && monitoringCase && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl border border-stone-200">
            <div className="flex items-center justify-between pb-3 border-b border-stone-100 mb-4">
              <div className="flex items-center gap-2">
                <Flag className="w-5 h-5 text-red-600" />
                <h3 className="font-bold text-base text-stone-900">
                  {monitoringCase.escalated ? t('deescalateCaseBtn') : t('escalateCaseBtn')}
                </h3>
              </div>
              <button
                onClick={() => setShowEscalateModal(false)}
                className="p-1 rounded-full hover:bg-stone-100 text-stone-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <p className="text-stone-600 leading-relaxed">
                {monitoringCase.escalated
                  ? 'Are you sure you want to resolve and remove the escalation flag from this case?'
                  : 'Flagging a case alerts supervisors and officers that the diagnosis or farmer satisfaction requires urgent quality review.'}
              </p>

              {!monitoringCase.escalated && (
                <div>
                  <label className="block text-xs font-bold text-stone-700 uppercase mb-1">
                    {t('escalationReasonLabel')} *
                  </label>
                  <textarea
                    rows={3}
                    value={escalationReason}
                    onChange={(e) => setEscalationReason(e.target.value)}
                    placeholder={t('escalationPrompt')}
                    required
                    className="w-full bg-stone-50 border border-stone-200 rounded-xl p-2.5 text-xs text-stone-900"
                  />
                </div>
              )}

              <div className="pt-3 border-t border-stone-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowEscalateModal(false)}
                  disabled={submittingEscalation}
                  className="px-4 py-2 rounded-xl border border-stone-200 text-stone-600 text-xs font-semibold"
                >
                  {t('cancelBtn')}
                </button>
                <button
                  type="button"
                  onClick={handleSaveEscalation}
                  disabled={submittingEscalation || (!monitoringCase.escalated && !escalationReason.trim())}
                  className={`px-5 py-2.5 rounded-xl text-white text-xs font-bold shadow-sm flex items-center gap-1.5 ${
                    monitoringCase.escalated ? 'bg-stone-800 hover:bg-stone-900' : 'bg-red-600 hover:bg-red-700'
                  }`}
                >
                  {submittingEscalation && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{monitoringCase.escalated ? t('confirmBtn') : t('escalateCaseBtn')}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Crop Modal for Admins */}
      {showEditCropModal && monitoringCase && (
        <EditCropModal
          isOpen={showEditCropModal}
          onClose={() => setShowEditCropModal(false)}
          caseItem={monitoringCase}
          onCropUpdated={(newCrop, updatedCase) => {
            setMonitoringCase(updatedCase);
          }}
        />
      )}
    </div>
  );
};
