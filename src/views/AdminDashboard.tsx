import React, { useState, useEffect } from 'react';
import {
  UserProfile,
  CaseItem,
  DiseaseItem,
  AuditLogItem,
  UserRole,
  OfficerStatus,
} from '../types';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import {
  collection,
  onSnapshot,
  doc,
  updateDoc,
  deleteDoc,
  setDoc,
  getDocs,
  deleteField,
  orderBy,
  query,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { calculateCaseMetrics, generateCasesCsv, isUserSuperAdmin } from '../utils/caseFilters';
import { CaseCard } from '../components/CaseCard';
import { ReassignModal } from '../components/ReassignModal';
import { EditCropModal } from '../components/EditCropModal';
import { COMMON_CROPS, MACHAKOS_SUB_COUNTIES } from '../utils/machakosData';
import {
  ShieldCheck,
  UserCheck,
  Users,
  ClipboardList,
  BarChart3,
  BookOpen,
  History,
  Download,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Search,
  PlusCircle,
  Edit2,
  Trash2,
  Loader2,
  Star,
  Clock,
  MapPin,
  RefreshCw,
  X,
  Crown,
  Pencil,
  Sprout,
  RotateCcw,
} from 'lucide-react';
import { formatDateKE, formatDateTimeKE } from '../utils/formatters';

export const AdminDashboard: React.FC = () => {
  const { profile, currentUser, recordAuditLog, isSuperAdminUser, promoteUserToAdmin, demoteAdminToOfficer } = useAuth();
  const { t, language } = useLanguage();

  const [activeTab, setActiveTab] = useState<
    'pending' | 'users' | 'cases' | 'trash' | 'reports' | 'diseases' | 'audit'
  >('pending');

  const [users, setUsers] = useState<UserProfile[]>([]);
  const [cases, setCases] = useState<CaseItem[]>([]);
  const [diseases, setDiseases] = useState<DiseaseItem[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Reassignment modal
  const [caseToReassign, setCaseToReassign] = useState<CaseItem | null>(null);
  const [confirmDisableUser, setConfirmDisableUser] = useState<UserProfile | null>(null);
  const [disablingUser, setDisablingUser] = useState(false);

  // Soft delete / Trash / Permanent delete modals
  const [caseToDelete, setCaseToDelete] = useState<CaseItem | null>(null);
  const [deleteReason, setDeleteReason] = useState('');
  const [deletingCase, setDeletingCase] = useState(false);
  const [caseToPermanentDelete, setCaseToPermanentDelete] = useState<CaseItem | null>(null);
  const [permanentlyDeleting, setPermanentlyDeleting] = useState(false);
  const [restoringCaseId, setRestoringCaseId] = useState<string | null>(null);

  // Disease management modal
  const [editingDisease, setEditingDisease] = useState<DiseaseItem | null>(null);
  const [showDiseaseModal, setShowDiseaseModal] = useState(false);
  const [diseaseForm, setDiseaseForm] = useState({
    name: '',
    crop: 'Cassava (Mihogo)',
    symptoms: '',
    causes: '',
    prevention: '',
    treatment: '',
    photoUrl: '',
  });

  // User search/filter
  const [userQuery, setUserQuery] = useState('');
  const [caseQuery, setCaseQuery] = useState('');
  const [selectedCaseDetail, setSelectedCaseDetail] = useState<CaseItem | null>(null);
  const [showEditCropModal, setShowEditCropModal] = useState(false);
  const [caseToEditCrop, setCaseToEditCrop] = useState<CaseItem | null>(null);

  // Subscribe to real-time collections
  useEffect(() => {
    const unsubUsers = onSnapshot(collection(db, 'users'), (snap) => {
      const list: UserProfile[] = [];
      snap.forEach((d) => list.push(d.data() as UserProfile));
      setUsers(list);
    });

    const unsubCases = onSnapshot(collection(db, 'cases'), (snap) => {
      const list: CaseItem[] = [];
      snap.forEach((d) => list.push(d.data() as CaseItem));
      list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setCases(list);

      if (selectedCaseDetail) {
        const updated = list.find((c) => c.id === selectedCaseDetail.id);
        if (updated) setSelectedCaseDetail(updated);
      }
    });

    const unsubDiseases = onSnapshot(collection(db, 'diseases'), (snap) => {
      const list: DiseaseItem[] = [];
      snap.forEach((d) => list.push(d.data() as DiseaseItem));
      setDiseases(list);
    });

    const auditCol = collection(db, 'auditLogs');
    const unsubAudit = onSnapshot(auditCol, (snap) => {
      const list: AuditLogItem[] = [];
      snap.forEach((d) => list.push(d.data() as AuditLogItem));
      list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setAuditLogs(list);
      setLoading(false);
    });

    return () => {
      unsubUsers();
      unsubCases();
      unsubDiseases();
      unsubAudit();
    };
  }, []);

  // Officer approval / rejection actions
  const handleOfficerStatusChange = async (
    targetUser: UserProfile,
    newStatus: OfficerStatus
  ) => {
    try {
      const userRef = doc(db, 'users', targetUser.id);
      await updateDoc(userRef, {
        officerStatus: newStatus,
        updatedAt: new Date().toISOString(),
      });

      await recordAuditLog(
        newStatus === 'verified' ? 'OFFICER_APPROVED' : newStatus === 'rejected' ? 'OFFICER_REJECTED' : 'OFFICER_REVOKED',
        targetUser.id,
        `Officer ${targetUser.fullName} (${targetUser.email}) status set to ${newStatus} by Admin`
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${targetUser.id}`);
    }
  };

  // Change user role
  const handleChangeRole = async (targetUser: UserProfile, newRole: UserRole) => {
    if (isUserSuperAdmin(targetUser.email) || targetUser.role === 'superadmin') {
      alert('The Super Admin account can never have its role changed or revoked.');
      return;
    }

    if (newRole === 'admin') {
      if (!isSuperAdminUser) {
        alert('Unauthorized: Only the designated Super Admin can promote users to Administrator.');
        return;
      }
      try {
        await promoteUserToAdmin(targetUser);
      } catch (err: any) {
        alert(err.message || 'Failed to promote user to Admin.');
      }
      return;
    }

    if (targetUser.role === 'admin') {
      if (!isSuperAdminUser) {
        alert('Unauthorized: Only the designated Super Admin can demote Administrators.');
        return;
      }
      try {
        await demoteAdminToOfficer(targetUser);
      } catch (err: any) {
        alert(err.message || 'Failed to demote Administrator.');
      }
      return;
    }

    const confirmPrompt = window.confirm(
      `Change role for ${targetUser.fullName} to "${newRole}"?`
    );
    if (!confirmPrompt) return;

    try {
      const userRef = doc(db, 'users', targetUser.id);
      const updateData: Record<string, unknown> = {
        role: newRole,
        updatedAt: new Date().toISOString(),
      };
      if (newRole === 'officer') {
        updateData.officerStatus = 'verified';
      }
      await updateDoc(userRef, updateData);

      await recordAuditLog(
        'ROLE_CHANGED',
        targetUser.id,
        `User ${targetUser.fullName} role changed to ${newRole}`
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${targetUser.id}`);
    }
  };

  // Toggle user disabled status
  const handleToggleDisable = async (targetUser: UserProfile) => {
    if (isUserSuperAdmin(targetUser.email) || targetUser.role === 'superadmin') {
      return;
    }
    setConfirmDisableUser(targetUser);
  };

  const executeDisableToggle = async () => {
    if (!confirmDisableUser || disablingUser) return;
    setDisablingUser(true);
    const targetUser = confirmDisableUser;
    const nextState = !targetUser.disabled;

    try {
      const userRef = doc(db, 'users', targetUser.id);
      await updateDoc(userRef, {
        disabled: nextState,
        updatedAt: new Date().toISOString(),
      });

      await recordAuditLog(
        nextState ? 'ACCOUNT_DISABLED' : 'ACCOUNT_ENABLED',
        targetUser.id,
        `Account for ${targetUser.fullName} was ${nextState ? 'disabled' : 'enabled'}`
      );
      setConfirmDisableUser(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${targetUser.id}`);
    } finally {
      setDisablingUser(false);
    }
  };

  // Save or edit disease entry
  const handleSaveDisease = async (e: React.FormEvent) => {
    e.preventDefault();
    const id = editingDisease?.id || `dis_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    const nowIso = new Date().toISOString();

    const diseaseDoc: DiseaseItem = {
      id,
      slug: editingDisease?.slug || id.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      name: diseaseForm.name.trim(),
      nameEn: editingDisease?.nameEn || diseaseForm.name.trim(),
      nameSw: editingDisease?.nameSw || diseaseForm.name.trim(),
      crop: diseaseForm.crop,
      scientificCause: editingDisease?.scientificCause || diseaseForm.causes.trim(),
      severity: editingDisease?.severity || 'Moderate',
      affectedParts: editingDisease?.affectedParts || ['leaves'],
      symptoms: diseaseForm.symptoms.trim(),
      spread: editingDisease?.spread || 'Spread by wind, rain splash, or infected planting material.',
      causes: diseaseForm.causes.trim(),
      prevention: diseaseForm.prevention.trim(),
      treatment: diseaseForm.treatment.trim(),
      images: editingDisease?.images || [],
      referencePhotoUrls: diseaseForm.photoUrl.trim() ? [diseaseForm.photoUrl.trim()] : (editingDisease?.referencePhotoUrls || []),
      createdAt: editingDisease?.createdAt || nowIso,
      updatedAt: nowIso,
    };

    try {
      await setDoc(doc(db, 'diseases', id), diseaseDoc);
      await recordAuditLog(
        editingDisease ? 'DISEASE_UPDATED' : 'DISEASE_CREATED',
        id,
        `Disease "${diseaseDoc.name}" ${editingDisease ? 'updated' : 'added'} by Admin`
      );
      setShowDiseaseModal(false);
      setEditingDisease(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `diseases/${id}`);
    }
  };

  const handleDeleteDisease = async (diseaseId: string, diseaseName: string) => {
    if (!window.confirm(`${t('confirmDelete')} "${diseaseName}"`)) return;
    try {
      await deleteDoc(doc(db, 'diseases', diseaseId));
      await recordAuditLog('DISEASE_DELETED', diseaseId, `Disease "${diseaseName}" deleted by Admin`);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `diseases/${diseaseId}`);
    }
  };

  // Soft delete case (moves to Trash)
  const handleSoftDeleteCase = async () => {
    if (!caseToDelete || deletingCase) return;
    setDeletingCase(true);
    const targetCase = caseToDelete;
    const reason = deleteReason.trim();
    const nowIso = new Date().toISOString();
    const actorName = profile?.fullName || currentUser?.email || 'Administrator';

    try {
      await updateDoc(doc(db, 'cases', targetCase.id), {
        deleted: true,
        deletedAt: nowIso,
        deletedBy: actorName,
        ...(reason ? { deleteReason: reason } : {}),
        updatedAt: nowIso,
      });

      // Notify farmer
      if (targetCase.farmerId) {
        const farmerNotifId = `notif_del_${targetCase.id}_${Date.now()}`;
        await setDoc(doc(db, 'notifications', farmerNotifId), {
          id: farmerNotifId,
          userId: targetCase.farmerId,
          caseId: targetCase.id,
          title: language === 'sw' ? 'Kesi Imeondolewa' : 'Case Moved to Trash',
          message: reason
            ? `Your ${targetCase.crop} case (${targetCase.id.slice(0, 8)}) was deleted by ${actorName}. Reason: ${reason}`
            : `Your ${targetCase.crop} case (${targetCase.id.slice(0, 8)}) was deleted by ${actorName}.`,
          type: 'general',
          read: false,
          createdAt: nowIso,
        });
      }

      // Notify assigned officer
      if (targetCase.assignedOfficerId) {
        const officerNotifId = `notif_del_off_${targetCase.id}_${Date.now()}`;
        await setDoc(doc(db, 'notifications', officerNotifId), {
          id: officerNotifId,
          userId: targetCase.assignedOfficerId,
          caseId: targetCase.id,
          title: language === 'sw' ? 'Kesi Imeondolewa' : 'Assigned Case Moved to Trash',
          message: reason
            ? `Case ${targetCase.id.slice(0, 8)} (${targetCase.crop}) was deleted by ${actorName}. Reason: ${reason}`
            : `Case ${targetCase.id.slice(0, 8)} (${targetCase.crop}) was deleted by ${actorName}.`,
          type: 'general',
          read: false,
          createdAt: nowIso,
        });
      }

      await recordAuditLog(
        'CASE_DELETED',
        targetCase.id,
        `Case ${targetCase.id} (${targetCase.crop}) moved to Trash by ${actorName}${reason ? ` — Reason: ${reason}` : ''}`
      );

      if (selectedCaseDetail?.id === targetCase.id) {
        setSelectedCaseDetail(null);
      }
      setCaseToDelete(null);
      setDeleteReason('');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `cases/${targetCase.id}`);
    } finally {
      setDeletingCase(false);
    }
  };

  // Restore soft-deleted case from Trash
  const handleRestoreCase = async (targetCase: CaseItem) => {
    if (restoringCaseId) return;
    setRestoringCaseId(targetCase.id);
    const nowIso = new Date().toISOString();
    const actorName = profile?.fullName || currentUser?.email || 'Administrator';

    try {
      await updateDoc(doc(db, 'cases', targetCase.id), {
        deleted: false,
        deletedAt: deleteField(),
        deletedBy: deleteField(),
        deleteReason: deleteField(),
        updatedAt: nowIso,
      });

      // Notify farmer
      if (targetCase.farmerId) {
        const farmerNotifId = `notif_res_${targetCase.id}_${Date.now()}`;
        await setDoc(doc(db, 'notifications', farmerNotifId), {
          id: farmerNotifId,
          userId: targetCase.farmerId,
          caseId: targetCase.id,
          title: language === 'sw' ? 'Kesi Imerejeshwa' : 'Case Restored',
          message: `Your ${targetCase.crop} case (${targetCase.id.slice(0, 8)}) was restored by ${actorName}.`,
          type: 'general',
          read: false,
          createdAt: nowIso,
        });
      }

      // Notify assigned officer
      if (targetCase.assignedOfficerId) {
        const officerNotifId = `notif_res_off_${targetCase.id}_${Date.now()}`;
        await setDoc(doc(db, 'notifications', officerNotifId), {
          id: officerNotifId,
          userId: targetCase.assignedOfficerId,
          caseId: targetCase.id,
          title: language === 'sw' ? 'Kesi Imerejeshwa' : 'Assigned Case Restored',
          message: `Case ${targetCase.id.slice(0, 8)} (${targetCase.crop}) was restored by ${actorName}.`,
          type: 'general',
          read: false,
          createdAt: nowIso,
        });
      }

      await recordAuditLog(
        'CASE_RESTORED',
        targetCase.id,
        `Case ${targetCase.id} (${targetCase.crop}) restored from Trash by ${actorName}`
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `cases/${targetCase.id}`);
    } finally {
      setRestoringCaseId(null);
    }
  };

  // Permanently delete case, its chat messages, and its photos
  const handlePermanentDeleteCase = async () => {
    if (!caseToPermanentDelete || permanentlyDeleting) return;
    setPermanentlyDeleting(true);
    const targetCase = caseToPermanentDelete;
    const actorName = profile?.fullName || currentUser?.email || 'Administrator';

    try {
      // 1. Delete chat messages subcollection
      const messagesSnap = await getDocs(collection(db, 'cases', targetCase.id, 'messages'));
      for (const msgDoc of messagesSnap.docs) {
        await deleteDoc(msgDoc.ref);
      }

      // 2. Delete Firestore photos subcollection
      const photosSnap = await getDocs(collection(db, 'cases', targetCase.id, 'photos'));
      for (const photoDoc of photosSnap.docs) {
        await deleteDoc(photoDoc.ref);
      }

      // 3. Delete the case document
      await deleteDoc(doc(db, 'cases', targetCase.id));

      // 5. Record audit log
      await recordAuditLog(
        'CASE_PERMANENTLY_DELETED',
        targetCase.id,
        `Case ${targetCase.id} (${targetCase.crop}) permanently deleted by ${actorName}${
          targetCase.deleteReason ? ` — Original reason: ${targetCase.deleteReason}` : ''
        }`
      );

      setCaseToPermanentDelete(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `cases/${targetCase.id}`);
    } finally {
      setPermanentlyDeleting(false);
    }
  };

  // CSV Export download handler
  const handleDownloadCsv = () => {
    const csvContent = generateCasesCsv(activeCases);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `CDIMS_Machakos_Cases_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const pendingOfficers = users.filter(
    (u) => u.role === 'officer' && u.officerStatus === 'pending'
  );

  const filteredUsers = users.filter((u) => {
    if (!userQuery.trim()) return true;
    const q = userQuery.toLowerCase();
    return (
      u.fullName?.toLowerCase().includes(q) ||
      u.email?.toLowerCase().includes(q) ||
      u.phone?.toLowerCase().includes(q) ||
      u.subCounty?.toLowerCase().includes(q) ||
      u.officerIdNumber?.toLowerCase().includes(q)
    );
  });

  const activeCases = cases.filter((c) => !c.deleted);
  const deletedCases = cases.filter((c) => c.deleted === true);

  const filteredCases = activeCases.filter((c) => {
    if (!caseQuery.trim()) return true;
    const q = caseQuery.toLowerCase();
    return (
      c.farmerName?.toLowerCase().includes(q) ||
      c.crop?.toLowerCase().includes(q) ||
      c.subCounty?.toLowerCase().includes(q) ||
      c.assignedOfficerName?.toLowerCase().includes(q) ||
      c.status?.toLowerCase().includes(q)
    );
  });

  const metrics = calculateCaseMetrics(activeCases);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-amber-100 text-amber-900">
              <ShieldCheck className="w-5 h-5 text-amber-800" />
            </span>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-stone-900 tracking-tight">
              {t('adminTitle')}
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-stone-600 mt-1">
            CropCare Centre Machakos County • Administrative Governance & Disease Surveillance
          </p>
        </div>

        {/* Quick CSV Export */}
        <button
          onClick={handleDownloadCsv}
          className="px-4 py-2.5 rounded-2xl bg-[#1e4620] hover:bg-[#285d2b] text-white text-xs font-bold shadow-sm flex items-center gap-2 transition-transform hover:scale-[1.02] shrink-0"
        >
          <Download className="w-4 h-4" />
          <span>{t('exportCsvBtn')}</span>
        </button>
      </div>

      {/* Tabs navigation */}
      <div className="flex items-center gap-2 border-b border-stone-200 pb-3 mb-6 overflow-x-auto scrollbar-none">
        <button
          onClick={() => setActiveTab('pending')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 whitespace-nowrap transition-colors ${
            activeTab === 'pending'
              ? 'bg-[#1e4620] text-amber-300 shadow-sm'
              : 'bg-white text-stone-600 border border-stone-200 hover:bg-stone-50'
          }`}
        >
          <UserCheck className="w-4 h-4" />
          <span>{t('pendingOfficersTab')}</span>
          {pendingOfficers.length > 0 && (
            <span className="px-1.5 py-0.5 rounded-full bg-amber-400 text-stone-950 text-[10px] font-extrabold">
              {pendingOfficers.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('users')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 whitespace-nowrap transition-colors ${
            activeTab === 'users'
              ? 'bg-[#1e4620] text-amber-300 shadow-sm'
              : 'bg-white text-stone-600 border border-stone-200 hover:bg-stone-50'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>{t('userManagementTab')}</span>
          <span className="px-1.5 py-0.5 rounded-full bg-stone-100 text-stone-700 text-[10px] font-bold">
            {users.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('cases')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 whitespace-nowrap transition-colors ${
            activeTab === 'cases'
              ? 'bg-[#1e4620] text-amber-300 shadow-sm'
              : 'bg-white text-stone-600 border border-stone-200 hover:bg-stone-50'
          }`}
        >
          <ClipboardList className="w-4 h-4" />
          <span>{t('allCasesTab')}</span>
          <span className="px-1.5 py-0.5 rounded-full bg-stone-100 text-stone-700 text-[10px] font-bold">
            {activeCases.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('trash')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 whitespace-nowrap transition-colors ${
            activeTab === 'trash'
              ? 'bg-red-700 text-white shadow-sm'
              : 'bg-white text-stone-600 border border-stone-200 hover:bg-red-50 hover:text-red-700'
          }`}
        >
          <Trash2 className="w-4 h-4" />
          <span>Trash</span>
          {deletedCases.length > 0 && (
            <span className="px-1.5 py-0.5 rounded-full bg-red-100 text-red-800 text-[10px] font-bold">
              {deletedCases.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('reports')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 whitespace-nowrap transition-colors ${
            activeTab === 'reports'
              ? 'bg-[#1e4620] text-amber-300 shadow-sm'
              : 'bg-white text-stone-600 border border-stone-200 hover:bg-stone-50'
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          <span>{t('reportsTab')}</span>
        </button>

        <button
          onClick={() => setActiveTab('diseases')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 whitespace-nowrap transition-colors ${
            activeTab === 'diseases'
              ? 'bg-[#1e4620] text-amber-300 shadow-sm'
              : 'bg-white text-stone-600 border border-stone-200 hover:bg-stone-50'
          }`}
        >
          <BookOpen className="w-4 h-4" />
          <span>{t('diseaseManagerTab')}</span>
        </button>

        <button
          onClick={() => setActiveTab('audit')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 whitespace-nowrap transition-colors ${
            activeTab === 'audit'
              ? 'bg-[#1e4620] text-amber-300 shadow-sm'
              : 'bg-white text-stone-600 border border-stone-200 hover:bg-stone-50'
          }`}
        >
          <History className="w-4 h-4" />
          <span>{t('auditLogsTab')}</span>
        </button>
      </div>

      {/* TAB 1: PENDING OFFICERS */}
      {activeTab === 'pending' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-stone-900">{t('pendingOfficersTab')}</h2>
            <span className="text-xs text-stone-500">
              {pendingOfficers.length} {language === 'sw' ? 'wanasubiri' : 'awaiting verification'}
            </span>
          </div>

          {pendingOfficers.length === 0 ? (
            <div className="bg-white rounded-3xl border border-stone-200 p-8 sm:p-12 text-center max-w-md mx-auto shadow-xs">
              <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center mx-auto mb-3">
                <CheckCircle className="w-8 h-8" />
              </div>
              <h3 className="font-bold text-stone-900 text-sm mb-1">
                {language === 'sw' ? 'Hakuna Maafisa Wanaosubiri' : 'No pending officers'}
              </h3>
              <p className="text-xs text-stone-600 leading-relaxed">
                {language === 'sw'
                  ? 'Maombi yote ya maafisa kilimo yamekaguliwa.'
                  : 'All extension officer verification requests have been reviewed.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {pendingOfficers.map((officer) => (
                <div
                  key={officer.id}
                  className="bg-white rounded-2xl border border-amber-200 p-5 shadow-xs flex flex-col justify-between space-y-4"
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="font-bold text-stone-900 text-base">{officer.fullName}</h4>
                        <p className="text-xs text-stone-500">{officer.email}</p>
                      </div>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                        {t('statusPending')}
                      </span>
                    </div>

                    <div className="p-3 rounded-xl bg-stone-50 border border-stone-200 text-xs space-y-1">
                      <p>
                        <strong className="text-stone-700">{t('officerIdLabel')}:</strong>{' '}
                        <span className="font-mono font-bold text-emerald-900">
                          {officer.officerIdNumber || 'Not provided'}
                        </span>
                      </p>
                      <p>
                        <strong className="text-stone-700">Phone:</strong> {officer.phone}
                      </p>
                      <p>
                        <strong className="text-stone-700">Sub-County:</strong> {officer.subCounty}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-2 border-t border-stone-100">
                    <button
                      onClick={() => handleOfficerStatusChange(officer, 'verified')}
                      className="flex-1 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold transition-colors shadow-2xs"
                    >
                      {t('approveBtn')}
                    </button>
                    <button
                      onClick={() => handleOfficerStatusChange(officer, 'rejected')}
                      className="py-2 px-3 rounded-xl bg-stone-100 hover:bg-red-50 hover:text-red-700 text-stone-600 text-xs font-semibold transition-colors"
                    >
                      {t('rejectBtn')}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: USER MANAGEMENT */}
      {activeTab === 'users' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-stone-900">{t('userManagementTab')}</h2>
              <p className="text-xs text-stone-500 mt-0.5">
                {isSuperAdminUser
                  ? 'Super Admin Mode: You have exclusive authority to promote and demote Administrators.'
                  : 'Administrator Mode: Extension officer verification and county staff governance.'}
              </p>
            </div>
            <div className="relative max-w-xs w-full">
              <Search className="w-4 h-4 text-stone-400 absolute left-3 top-3" />
              <input
                type="text"
                value={userQuery}
                onChange={(e) => setUserQuery(e.target.value)}
                placeholder="Search user, phone, role..."
                className="w-full bg-white border border-stone-200 rounded-xl pl-9 pr-3 py-2 text-xs text-stone-900"
              />
            </div>
          </div>

          {/* Super Admin / Admin governance notice */}
          <div className={`p-3.5 rounded-2xl border text-xs flex items-center justify-between gap-3 ${
            isSuperAdminUser
              ? 'bg-purple-50 border-purple-200 text-purple-950'
              : 'bg-amber-50/70 border-amber-200 text-amber-950'
          }`}>
            <div className="flex items-center gap-2.5">
              <Crown className={`w-4 h-4 shrink-0 ${isSuperAdminUser ? 'text-purple-700' : 'text-amber-700'}`} />
              <div>
                <span className="font-bold">
                  {isSuperAdminUser ? 'Exclusive Governance Authority' : 'Role Security Protocol'}
                </span>
                <span className="text-stone-600 ml-1.5 hidden sm:inline">
                  {isSuperAdminUser
                    ? 'Only you (wanjiruclaire016@gmail.com) can promote or demote Administrators. This privilege is enforced in Firestore security rules.'
                    : 'Only the designated Super Admin can promote or demote Administrators. Regular Admins cannot alter Admin privileges.'}
                </span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-stone-50 border-b border-stone-200 text-stone-600 font-bold uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">User</th>
                    <th className="py-3 px-4">Role</th>
                    <th className="py-3 px-4">Officer ID / Status</th>
                    <th className="py-3 px-4">Location</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {filteredUsers.map((u) => {
                    const isTargetSuper = isUserSuperAdmin(u.email) || u.role === 'superadmin';

                    return (
                      <tr key={u.id} className={u.disabled ? 'bg-red-50/50 opacity-75' : 'hover:bg-stone-50/80'}>
                        <td className="py-3 px-4">
                          <div className="font-semibold text-stone-900 flex items-center gap-1.5">
                            <span>{u.fullName}</span>
                            {isTargetSuper && (
                              <span className="px-1.5 py-0.2 rounded bg-purple-100 text-purple-800 text-[10px] font-extrabold border border-purple-200 inline-flex items-center gap-1">
                                <Crown className="w-3 h-3 text-purple-700" />
                                <span>Super Admin</span>
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-stone-500">{u.email} • {u.phone}</div>
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`inline-block px-2 py-0.5 rounded-full font-bold uppercase text-[10px] ${
                              isTargetSuper
                                ? 'bg-purple-100 text-purple-950 border border-purple-300'
                                : u.role === 'admin'
                                ? 'bg-amber-100 text-amber-900 border border-amber-300'
                                : u.role === 'officer'
                                ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                                : 'bg-stone-100 text-stone-800'
                            }`}
                          >
                            {isTargetSuper ? 'superadmin' : u.role}
                          </span>
                          {u.disabled && (
                            <span className="ml-1 text-[10px] font-bold text-red-600 bg-red-100 px-1.5 py-0.5 rounded">
                              Disabled
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          {u.role === 'officer' ? (
                            <div>
                              <span className="font-mono text-stone-700 block">
                                {u.officerIdNumber || '—'}
                              </span>
                              <span className="text-[10px] font-semibold text-emerald-800">
                                {u.officerStatus}
                              </span>
                            </div>
                          ) : (
                            <span className="text-stone-400">—</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-stone-600">
                          {u.subCounty} {u.ward ? `• ${u.ward}` : ''}
                        </td>
                        <td className="py-3 px-4 text-right space-x-1 whitespace-nowrap">
                          {isTargetSuper ? (
                            <span className="px-2.5 py-1 rounded-lg bg-purple-50 text-purple-800 border border-purple-200 font-bold text-[11px] inline-flex items-center gap-1">
                              <ShieldCheck className="w-3.5 h-3.5 text-purple-700" />
                              Immutable Super Admin
                            </span>
                          ) : (
                            <>
                              {u.role !== 'admin' && (
                                <button
                                  onClick={() => handleChangeRole(u, u.role === 'officer' ? 'farmer' : 'officer')}
                                  className="px-2 py-1 rounded bg-stone-100 hover:bg-stone-200 text-stone-700 font-semibold text-[11px]"
                                >
                                  Make {u.role === 'officer' ? 'Farmer' : 'Officer'}
                                </button>
                              )}

                              {/* Super Admin only: Promote to Admin */}
                              {u.role !== 'admin' && isSuperAdminUser && (
                                <button
                                  onClick={() => handleChangeRole(u, 'admin')}
                                  className="px-2 py-1 rounded bg-amber-100 hover:bg-amber-200 text-amber-900 font-bold text-[11px]"
                                >
                                  Promote Admin
                                </button>
                              )}

                              {/* Super Admin only: Demote Admin */}
                              {u.role === 'admin' && isSuperAdminUser && (
                                <button
                                  onClick={() => handleChangeRole(u, 'officer')}
                                  className="px-2 py-1 rounded bg-stone-200 hover:bg-amber-100 text-stone-800 font-bold text-[11px]"
                                >
                                  Demote Admin
                                </button>
                              )}

                              {/* Non-Super Admins cannot change Admins */}
                              {u.role === 'admin' && !isSuperAdminUser && (
                                <span className="text-[11px] text-stone-400 italic px-2 py-1">
                                  Admin (Super Admin only)
                                </span>
                              )}

                              <button
                                onClick={() => handleToggleDisable(u)}
                                className={`px-2 py-1 rounded font-semibold text-[11px] ${
                                  u.disabled
                                    ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                                    : 'bg-red-50 text-red-700 hover:bg-red-100'
                                }`}
                              >
                                {u.disabled ? t('enableUserBtn') : t('disableUserBtn')}
                              </button>
                            </>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: ALL CASES & REASSIGNMENT */}
      {activeTab === 'cases' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h2 className="text-base font-bold text-stone-900">{t('allCasesTab')}</h2>
            <div className="relative max-w-xs w-full">
              <Search className="w-4 h-4 text-stone-400 absolute left-3 top-3" />
              <input
                type="text"
                value={caseQuery}
                onChange={(e) => setCaseQuery(e.target.value)}
                placeholder="Search case, crop, officer..."
                className="w-full bg-white border border-stone-200 rounded-xl pl-9 pr-3 py-2 text-xs text-stone-900"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredCases.map((c) => (
              <div key={c.id} className="relative">
                <CaseCard caseItem={c} onOpen={() => setSelectedCaseDetail(c)} />
                <div className="mt-2 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setCaseToEditCrop(c);
                        setShowEditCropModal(true);
                      }}
                      className="px-2.5 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 text-xs font-bold inline-flex items-center gap-1"
                    >
                      <Pencil className="w-3 h-3 text-amber-700" />
                      <span>{language === 'sw' ? 'Sahihisha Zao' : 'Edit Crop'}</span>
                    </button>
                    <button
                      onClick={() => setCaseToReassign(c)}
                      className="px-2.5 py-1 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-800 border border-stone-200 text-xs font-semibold inline-flex items-center gap-1"
                    >
                      <RefreshCw className="w-3 h-3" />
                      <span>{t('manualReassignBtn')}</span>
                    </button>
                  </div>
                  <button
                    onClick={() => {
                      setCaseToDelete(c);
                      setDeleteReason('');
                    }}
                    className="px-2.5 py-1 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 text-xs font-bold inline-flex items-center gap-1"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>Delete</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB: TRASH (DELETED CASES) */}
      {activeTab === 'trash' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-stone-900">Trash</h2>
              <p className="text-xs text-stone-500">
                Deleted cases can be restored for 30 days or permanently removed.
              </p>
            </div>
            <span className="text-xs font-semibold text-stone-500">
              {deletedCases.length} {deletedCases.length === 1 ? 'case' : 'cases'} in Trash
            </span>
          </div>

          {deletedCases.length === 0 ? (
            <div className="bg-white rounded-2xl border border-stone-200 p-10 text-center text-stone-400 text-sm">
              Trash is empty.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {deletedCases.map((c) => (
                <div key={c.id} className="bg-white rounded-2xl border border-red-200 p-4 shadow-xs flex flex-col justify-between space-y-3">
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                        {c.crop}
                      </span>
                      <span className="text-[11px] font-mono text-stone-500">
                        ID: {c.id.slice(0, 8)}
                      </span>
                    </div>
                    <h4 className="font-bold text-sm text-stone-900">{c.farmerName}</h4>
                    <p className="text-xs text-stone-500">{c.subCounty}</p>
                    {c.deletedAt && (
                      <p className="text-[11px] text-stone-500 mt-1">
                        Deleted: {formatDateTimeKE(c.deletedAt)} {c.deletedBy ? `by ${c.deletedBy}` : ''}
                      </p>
                    )}
                    {c.deleteReason && (
                      <p className="text-xs text-red-800 bg-red-50 border border-red-100 rounded-xl p-2 mt-2">
                        Reason: {c.deleteReason}
                      </p>
                    )}
                  </div>

                  <div className="pt-2 border-t border-stone-100 flex items-center justify-between gap-2">
                    <button
                      onClick={() => handleRestoreCase(c)}
                      disabled={restoringCaseId === c.id}
                      className="px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-bold inline-flex items-center gap-1 disabled:opacity-50"
                    >
                      {restoringCaseId === c.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <RotateCcw className="w-3.5 h-3.5" />
                      )}
                      <span>Restore</span>
                    </button>
                    <button
                      onClick={() => setCaseToPermanentDelete(c)}
                      className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-bold inline-flex items-center gap-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Delete permanently</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 4: REPORTS DASHBOARD */}
      {activeTab === 'reports' && (
        <div className="space-y-6">
          {/* Top High-Level Metrics Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-2xs">
              <span className="text-xs text-stone-500 font-semibold block">{t('metricTotalCases')}</span>
              <span className="text-2xl font-black text-stone-900 mt-1 block">{metrics.totalCases}</span>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-2xs">
              <span className="text-xs text-stone-500 font-semibold block">{t('metricOpenCases')}</span>
              <span className="text-2xl font-black text-amber-700 mt-1 block">{metrics.openCases}</span>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-2xs">
              <span className="text-xs text-stone-500 font-semibold block">{t('metricResolvedCases')}</span>
              <span className="text-2xl font-black text-emerald-800 mt-1 block">{metrics.resolvedCases}</span>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-2xs">
              <span className="text-xs text-stone-500 font-semibold block">{t('metricAvgResponse')}</span>
              <span className="text-2xl font-black text-stone-900 mt-1 block">
                {metrics.averageResponseTimeHours} hrs
              </span>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-2xs col-span-2 sm:col-span-1">
              <span className="text-xs text-stone-500 font-semibold block">{t('metricAvgRating')}</span>
              <span className="text-2xl font-black text-amber-600 mt-1 flex items-center gap-1">
                ⭐ {metrics.averageRating}
                <span className="text-xs font-normal text-stone-400">({metrics.totalRatings})</span>
              </span>
            </div>
          </div>

          {/* Breakdown Grids */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Cases per Crop */}
            <div className="bg-white p-5 rounded-3xl border border-stone-200 shadow-2xs space-y-3">
              <h3 className="font-bold text-sm text-stone-900">{t('casesByCropTitle')}</h3>
              <div className="space-y-2">
                {Object.entries(metrics.casesByCrop).map(([cropName, count]) => {
                  const pct = Math.round((count / (metrics.totalCases || 1)) * 100);
                  return (
                    <div key={cropName} className="text-xs">
                      <div className="flex justify-between font-semibold mb-1">
                        <span className="text-stone-800">{cropName}</span>
                        <span className="text-stone-600">{count} ({pct}%)</span>
                      </div>
                      <div className="w-full bg-stone-100 rounded-full h-2 overflow-hidden">
                        <div className="bg-[#1e4620] h-2 rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Cases per Sub-County */}
            <div className="bg-white p-5 rounded-3xl border border-stone-200 shadow-2xs space-y-3">
              <h3 className="font-bold text-sm text-stone-900">{t('casesBySubCountyTitle')}</h3>
              <div className="space-y-2">
                {Object.entries(metrics.casesBySubCounty).map(([subCountyName, count]) => {
                  const pct = Math.round((count / (metrics.totalCases || 1)) * 100);
                  return (
                    <div key={subCountyName} className="text-xs">
                      <div className="flex justify-between font-semibold mb-1">
                        <span className="text-stone-800">{subCountyName}</span>
                        <span className="text-stone-600">{count} ({pct}%)</span>
                      </div>
                      <div className="w-full bg-stone-100 rounded-full h-2 overflow-hidden">
                        <div className="bg-amber-600 h-2 rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Cases by Disease */}
            <div className="bg-white p-5 rounded-3xl border border-stone-200 shadow-2xs space-y-3">
              <h3 className="font-bold text-sm text-stone-900">{t('casesByDiseaseTitle')}</h3>
              {Object.keys(metrics.casesByDisease).length === 0 ? (
                <p className="text-xs text-stone-500 italic">No diagnosed diseases yet.</p>
              ) : (
                <div className="space-y-2">
                  {Object.entries(metrics.casesByDisease).map(([disName, count]) => (
                    <div key={disName} className="flex items-center justify-between text-xs p-2 rounded-xl bg-stone-50 border border-stone-100">
                      <span className="font-semibold text-stone-800">{disName}</span>
                      <span className="font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-900">
                        {count} cases
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Officer Workload */}
            <div className="bg-white p-5 rounded-3xl border border-stone-200 shadow-2xs space-y-3">
              <h3 className="font-bold text-sm text-stone-900">{t('officerPerformanceTitle')}</h3>
              {Object.keys(metrics.officerWorkload).length === 0 ? (
                <p className="text-xs text-stone-500 italic">No assigned officer activity yet.</p>
              ) : (
                <div className="space-y-2">
                  {Object.entries(metrics.officerWorkload).map(([offId, data]) => (
                    <div key={offId} className="flex items-center justify-between text-xs p-2.5 rounded-xl bg-stone-50 border border-stone-100">
                      <div>
                        <span className="font-bold text-stone-800 block">{data.officerName}</span>
                        <span className="text-stone-500 text-[11px]">ID: {offId.slice(0, 8)}</span>
                      </div>
                      <div className="text-right">
                        <span className="font-bold text-stone-900">{data.count} cases</span>
                        <span className="text-[11px] text-emerald-700 block">
                          {data.resolvedCount} resolved
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: DISEASE LIBRARY MANAGER */}
      {activeTab === 'diseases' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-stone-900">{t('diseaseManagerTab')}</h2>
            <button
              onClick={() => {
                setEditingDisease(null);
                setDiseaseForm({
                  name: '',
                  crop: 'Cassava (Mihogo)',
                  symptoms: '',
                  causes: '',
                  prevention: '',
                  treatment: '',
                  photoUrl: '',
                });
                setShowDiseaseModal(true);
              }}
              className="px-3.5 py-2 rounded-xl bg-[#1e4620] hover:bg-[#285d2b] text-white text-xs font-bold shadow-xs flex items-center gap-1.5"
            >
              <PlusCircle className="w-4 h-4" />
              <span>{t('addDiseaseBtn')}</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {diseases.map((dis) => (
              <div key={dis.id} className="bg-white rounded-2xl border border-stone-200 p-5 shadow-xs flex flex-col justify-between space-y-3">
                <div>
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200 inline-flex items-center gap-1">
                      <Sprout className="w-3 h-3 text-emerald-700" />
                      <span>{dis.crop}</span>
                    </span>
                  </div>
                  <h3 className="font-bold text-base text-stone-900">{dis.name}</h3>
                  <p className="text-xs text-stone-600 line-clamp-3 mt-1">{dis.symptoms}</p>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-stone-100">
                  <button
                    onClick={() => {
                      setEditingDisease(dis);
                      setDiseaseForm({
                        name: dis.name || dis.nameEn || '',
                        crop: dis.crop,
                        symptoms: dis.symptoms || '',
                        causes: dis.causes || dis.scientificCause || '',
                        prevention: dis.prevention || '',
                        treatment: dis.treatment || '',
                        photoUrl: dis.referencePhotoUrls?.[0] || '',
                      });
                      setShowDiseaseModal(true);
                    }}
                    className="p-1.5 rounded-lg text-stone-600 hover:bg-stone-100 text-xs font-semibold flex items-center gap-1"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    <span>{t('editDiseaseBtn')}</span>
                  </button>
                  <button
                    onClick={() => handleDeleteDisease(dis.id, dis.name || dis.nameEn || 'Disease')}
                    className="p-1.5 rounded-lg text-red-600 hover:bg-red-50 text-xs font-semibold flex items-center gap-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>{t('deleteDiseaseBtn')}</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 6: AUDIT LOGS */}
      {activeTab === 'audit' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-stone-900">{t('auditLogsTab')}</h2>
            <span className="text-xs text-stone-500">
              {auditLogs.length} {language === 'sw' ? 'matukio yamerekodiwa' : 'records logged'}
            </span>
          </div>

          <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-stone-50 border-b border-stone-200 text-stone-600 font-bold uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Timestamp</th>
                    <th className="py-3 px-4">Action</th>
                    <th className="py-3 px-4">Actor</th>
                    <th className="py-3 px-4">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {auditLogs.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-stone-400">
                        No audit events recorded yet.
                      </td>
                    </tr>
                  ) : (
                    auditLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-stone-50/70 font-mono text-[11px]">
                        <td className="py-3 px-4 text-stone-500 font-sans">
                          {formatDateTimeKE(log.timestamp)}
                        </td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded font-bold uppercase bg-stone-100 text-stone-800">
                            {log.action}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-stone-800 font-sans font-semibold">
                          {log.actorName} ({log.actorEmail})
                        </td>
                        <td className="py-3 px-4 text-stone-600 font-sans">
                          {log.details}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Reassign case modal */}
      {caseToReassign && (
        <ReassignModal
          caseItem={caseToReassign}
          mode="toOfficer"
          onClose={() => setCaseToReassign(null)}
          onSuccess={() => setCaseToReassign(null)}
        />
      )}

      {/* Add / Edit Disease Modal */}
      {showDiseaseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 sm:p-8 shadow-2xl border border-stone-200 my-8">
            <div className="flex items-center justify-between pb-3 border-b border-stone-100 mb-5">
              <h3 className="font-bold text-base text-stone-900">
                {editingDisease ? t('editDiseaseBtn') : t('addDiseaseBtn')}
              </h3>
              <button
                onClick={() => setShowDiseaseModal(false)}
                className="p-1.5 rounded-full hover:bg-stone-100 text-stone-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveDisease} className="space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-stone-700 uppercase mb-1">
                    Disease Name *
                  </label>
                  <input
                    type="text"
                    value={diseaseForm.name}
                    onChange={(e) => setDiseaseForm({ ...diseaseForm, name: e.target.value })}
                    required
                    placeholder="e.g. Cassava Mosaic Disease"
                    className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-xs text-stone-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 uppercase mb-1">
                    Crop *
                  </label>
                  <select
                    value={diseaseForm.crop}
                    onChange={(e) => setDiseaseForm({ ...diseaseForm, crop: e.target.value })}
                    className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-xs text-stone-900"
                  >
                    {COMMON_CROPS.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 uppercase mb-1">
                  Symptoms Description *
                </label>
                <textarea
                  rows={2}
                  value={diseaseForm.symptoms}
                  onChange={(e) => setDiseaseForm({ ...diseaseForm, symptoms: e.target.value })}
                  required
                  placeholder="Distinctive yellow/green leaf chlorosis, distortion..."
                  className="w-full bg-stone-50 border border-stone-200 rounded-xl p-2.5 text-xs text-stone-900"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 uppercase mb-1">
                  Causes & Pathogens
                </label>
                <input
                  type="text"
                  value={diseaseForm.causes}
                  onChange={(e) => setDiseaseForm({ ...diseaseForm, causes: e.target.value })}
                  placeholder="Whitefly vector (Bemisia tabaci), infected cuttings..."
                  className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-xs text-stone-900"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 uppercase mb-1">
                  Prevention Tips *
                </label>
                <textarea
                  rows={2}
                  value={diseaseForm.prevention}
                  onChange={(e) => setDiseaseForm({ ...diseaseForm, prevention: e.target.value })}
                  required
                  placeholder="Certified disease-free cuttings, rogueing infected plants..."
                  className="w-full bg-stone-50 border border-stone-200 rounded-xl p-2.5 text-xs text-stone-900"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 uppercase mb-1">
                  Treatment & Remediation *
                </label>
                <textarea
                  rows={2}
                  value={diseaseForm.treatment}
                  onChange={(e) => setDiseaseForm({ ...diseaseForm, treatment: e.target.value })}
                  required
                  placeholder="Immediate uprooting and burning, whitefly control sprays..."
                  className="w-full bg-stone-50 border border-stone-200 rounded-xl p-2.5 text-xs text-stone-900"
                />
              </div>

              <div className="pt-3 border-t border-stone-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowDiseaseModal(false)}
                  className="px-4 py-2 rounded-xl border border-stone-200 text-stone-600 text-xs font-semibold"
                >
                  {t('cancelBtn')}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-[#1e4620] hover:bg-[#285d2b] text-white text-xs font-bold"
                >
                  {t('saveBtn')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Selected Case Detail Modal for Admin */}
      {selectedCaseDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-5 sm:p-7 shadow-2xl border border-stone-200 my-6 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-stone-100 shrink-0">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200 inline-flex items-center gap-1">
                    <Sprout className="w-3.5 h-3.5 text-emerald-700" />
                    <span>{selectedCaseDetail.crop}</span>
                  </span>
                  <span className="text-xs font-mono text-stone-500">
                    ID: {selectedCaseDetail.id.slice(0, 8)}
                  </span>
                  <button
                    onClick={() => {
                      setCaseToEditCrop(selectedCaseDetail);
                      setShowEditCropModal(true);
                    }}
                    className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 text-xs font-bold shadow-2xs transition-colors"
                  >
                    <Pencil className="w-3 h-3 text-amber-700" />
                    <span>{language === 'sw' ? 'Sahihisha Zao' : 'Edit Crop'}</span>
                  </button>
                </div>
                {selectedCaseDetail.cropCorrectedBy && (
                  <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-900 bg-amber-100/80 px-2 py-0.5 rounded-md border border-amber-300">
                      <Pencil className="w-3 h-3 text-amber-700" />
                      <span>{language === 'sw' ? 'Zao lilisahihishwa na' : 'Crop corrected by'} {selectedCaseDetail.cropCorrectedBy}</span>
                    </span>
                    {selectedCaseDetail.previousCrop && (
                      <span className="text-[11px] text-stone-500">
                        ({language === 'sw' ? 'awali' : 'previously'}: {selectedCaseDetail.previousCrop})
                      </span>
                    )}
                  </div>
                )}
                <h3 className="font-bold text-lg text-stone-900 mt-1">
                  {selectedCaseDetail.farmerName} • {selectedCaseDetail.subCounty}
                </h3>
              </div>
              <button
                onClick={() => setSelectedCaseDetail(null)}
                className="p-1.5 rounded-full hover:bg-stone-100 text-stone-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-4 space-y-4 text-xs">
              <div className="p-3.5 rounded-2xl bg-stone-50 border border-stone-200 grid grid-cols-2 gap-2">
                <div>
                  <span className="text-stone-500 block">Farmer Contact:</span>
                  <span className="font-semibold text-stone-800">{selectedCaseDetail.farmerPhone}</span>
                </div>
                <div>
                  <span className="text-stone-500 block">Assigned Officer:</span>
                  <span className="font-semibold text-stone-800">{selectedCaseDetail.assignedOfficerName || 'Unassigned'}</span>
                </div>
                <div>
                  <span className="text-stone-500 block">Status:</span>
                  <span className="font-bold text-stone-900">{selectedCaseDetail.status}</span>
                </div>
                <div>
                  <span className="text-stone-500 block">Date Submitted:</span>
                  <span className="font-semibold text-stone-800">{new Date(selectedCaseDetail.createdAt).toLocaleDateString()}</span>
                </div>
              </div>

              <div>
                <span className="font-bold text-stone-700 block mb-1 uppercase tracking-wider text-[11px]">Symptoms:</span>
                <p className="p-3 bg-stone-50 rounded-xl border border-stone-200 text-stone-800 leading-relaxed whitespace-pre-wrap">
                  {selectedCaseDetail.symptomsDescription}
                </p>
              </div>

              {selectedCaseDetail.diagnosis && (
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-950 space-y-1">
                  <span className="font-bold block">Diagnosis: {selectedCaseDetail.diagnosis.diseaseName}</span>
                  <p>{selectedCaseDetail.diagnosis.treatmentAdvice}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Edit Crop Modal for Admins */}
      {showEditCropModal && caseToEditCrop && (
        <EditCropModal
          isOpen={showEditCropModal}
          onClose={() => {
            setShowEditCropModal(false);
            setCaseToEditCrop(null);
          }}
          caseItem={caseToEditCrop}
          onCropUpdated={(newCrop, updatedCase) => {
            if (selectedCaseDetail && selectedCaseDetail.id === updatedCase.id) {
              setSelectedCaseDetail(updatedCase);
            }
          }}
        />
      )}

      {/* Confirm Disable / Enable User Modal */}
      {confirmDisableUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-[#FBFAF5] rounded-3xl max-w-md w-full p-6 shadow-2xl border border-[#E7E2D5]">
            <h3 className="font-heading font-bold text-lg text-[#0F4A2F] mb-2">
              {confirmDisableUser.disabled ? 'Enable Account?' : 'Disable Account?'}
            </h3>
            <p className="text-sm text-[#2B3A33] mb-6">
              Are you sure you want to {confirmDisableUser.disabled ? 'enable' : 'disable'} the account for{' '}
              <span className="font-bold">{confirmDisableUser.fullName}</span> ({confirmDisableUser.email})?
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setConfirmDisableUser(null)}
                disabled={disablingUser}
                className="min-h-[48px] px-5 py-2.5 rounded-full border border-[#D5CFC0] bg-white text-[#2B3A33] hover:bg-[#EAE5D9] text-xs font-bold"
              >
                {t('cancelBtn')}
              </button>
              <button
                type="button"
                onClick={executeDisableToggle}
                disabled={disablingUser}
                className={`min-h-[48px] px-5 py-2.5 rounded-full text-xs font-bold text-white flex items-center gap-2 ${
                  confirmDisableUser.disabled
                    ? 'bg-[#0F4A2F] hover:bg-[#155e3c]'
                    : 'bg-red-600 hover:bg-red-700'
                } disabled:opacity-50`}
              >
                {disablingUser && <Loader2 className="w-4 h-4 animate-spin" />}
                <span>{confirmDisableUser.disabled ? t('enableUserBtn') : t('disableUserBtn')}</span>
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Soft Delete Case Confirmation Modal */}
      {caseToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-[#FBFAF5] rounded-3xl max-w-md w-full p-6 shadow-2xl border border-[#E7E2D5]">
            <h3 className="font-heading font-bold text-lg text-[#0F4A2F] mb-2">
              Delete this case?
            </h3>
            <p className="text-sm text-[#2B3A33] mb-4">
              Delete this case? It will be moved to Trash and can be restored for 30 days.
            </p>
            <div className="mb-5">
              <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
                Reason (optional)
              </label>
              <textarea
                value={deleteReason}
                onChange={(e) => setDeleteReason(e.target.value)}
                rows={3}
                placeholder="Enter reason for deleting this case..."
                className="w-full bg-white border border-[#D5CFC0] rounded-2xl px-3.5 py-2.5 text-xs text-[#2B3A33] focus:outline-none focus:ring-2 focus:ring-red-500"
              />
            </div>
            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setCaseToDelete(null);
                  setDeleteReason('');
                }}
                disabled={deletingCase}
                className="min-h-[48px] px-5 py-2.5 rounded-full border border-[#D5CFC0] bg-white text-[#2B3A33] hover:bg-[#EAE5D9] text-xs font-bold"
              >
                {t('cancelBtn')}
              </button>
              <button
                type="button"
                onClick={handleSoftDeleteCase}
                disabled={deletingCase}
                className="min-h-[48px] px-5 py-2.5 rounded-full bg-red-600 hover:bg-red-700 text-white text-xs font-bold flex items-center gap-2 disabled:opacity-50"
              >
                {deletingCase && <Loader2 className="w-4 h-4 animate-spin" />}
                <span>Delete</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Permanent Delete Second Confirmation Modal */}
      {caseToPermanentDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
          <div className="bg-[#FBFAF5] rounded-3xl max-w-md w-full p-6 shadow-2xl border border-red-200">
            <h3 className="font-heading font-bold text-lg text-red-700 mb-2">
              Permanently Delete Case?
            </h3>
            <p className="text-sm text-[#2B3A33] mb-6">
              This action cannot be undone. Case{' '}
              <span className="font-mono font-bold">{caseToPermanentDelete.id.slice(0, 8)}</span>, all its chat messages, and all its photos will be permanently removed.
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setCaseToPermanentDelete(null)}
                disabled={permanentlyDeleting}
                className="min-h-[48px] px-5 py-2.5 rounded-full border border-[#D5CFC0] bg-white text-[#2B3A33] hover:bg-[#EAE5D9] text-xs font-bold"
              >
                {t('cancelBtn')}
              </button>
              <button
                type="button"
                onClick={handlePermanentDeleteCase}
                disabled={permanentlyDeleting}
                className="min-h-[48px] px-5 py-2.5 rounded-full bg-red-600 hover:bg-red-700 text-white text-xs font-bold flex items-center gap-2 disabled:opacity-50"
              >
                {permanentlyDeleting && <Loader2 className="w-4 h-4 animate-spin" />}
                <span>Delete permanently</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
