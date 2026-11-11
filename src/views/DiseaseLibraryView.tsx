import React, { useState, useEffect } from 'react';
import { DiseaseItem, DiseaseImage } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { collection, onSnapshot, doc, setDoc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';
import { db, storage } from '../firebase';
import { seedDiseasesCollectionIfNeeded } from '../utils/diseaseDatabase';
import { DiseaseImageWithFallback } from '../components/DiseaseImageWithFallback';
import { formatDateKE } from '../utils/formatters';
import {
  BookOpen,
  Search,
  Sprout,
  X,
  ShieldCheck,
  AlertCircle,
  ArrowRight,
  PlusCircle,
  CheckCircle2,
  Filter,
  Leaf,
  Bug,
  AlertTriangle,
  UploadCloud, Trash2,
  LayoutGrid,
  List,
  Edit,
  Camera,
  Layers,
  ChevronRight,
  HelpCircle,
  Check,
  Calendar,
  UserCheck,
} from 'lucide-react';

interface DiseaseLibraryViewProps {
  onReportDisease?: (crop: string, symptoms: string) => void;
}

const CROPS_LIST = [
  'All',
  'Maize',
  'Beans',
  'Cassava',
  'Mango',
  'Tomato',
  'Kale',
  'Cowpea',
  'Pigeon pea',
  'Sorghum',
] as const;

const AFFECTED_PARTS = [
  { id: 'all', en: 'All Parts', sw: 'Sehemu Zote' },
  { id: 'leaves', en: 'Leaves', sw: 'Majani' },
  { id: 'stem', en: 'Stem', sw: 'Shina' },
  { id: 'roots', en: 'Roots', sw: 'Mizizi' },
  { id: 'fruit', en: 'Fruit & Pods', sw: 'Matunda / Maganda' },
  { id: 'flower', en: 'Flower', sw: 'Maua' },
  { id: 'wilt', en: 'Wilting', sw: 'Kunyauka' },
  { id: 'pests', en: 'Pests & Insects', sw: 'Wadudu' },
] as const;

export const DiseaseLibraryView: React.FC<DiseaseLibraryViewProps> = ({ onReportDisease }) => {
  const { t, language } = useLanguage();
  const { currentUser, profile } = useAuth();

  const [diseases, setDiseases] = useState<DiseaseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCrop, setSelectedCrop] = useState<string>('All');
  const [selectedPart, setSelectedPart] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [selectedDisease, setSelectedDisease] = useState<DiseaseItem | null>(null);

  // Admin modal state
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [editingDisease, setEditingDisease] = useState<DiseaseItem | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [pendingPhotos, setPendingPhotos] = useState<{ file: File; previewUrl: string }[]>([]);
  const [photoModalDisease, setPhotoModalDisease] = useState<DiseaseItem | null>(null);
  const [deletingPhotoIdx, setDeletingPhotoIdx] = useState<number | null>(null);
  const [imageCaption, setImageCaption] = useState('');
  const [imagePart, setImagePart] = useState('leaves');
  const [imageCredit, setImageCredit] = useState('CropCare Centre Field Team');
  const [adminForm, setAdminForm] = useState({
    slug: '',
    crop: 'Maize',
    nameEn: '',
    nameSw: '',
    scientificCause: '',
    severity: 'HIGH' as 'HIGH' | 'MODERATE' | 'LOW',
    affectedParts: ['leaves'] as string[],
    symptoms: '',
    spread: '',
    treatment: '',
    prevention: '',
  });
  const [adminSaving, setAdminSaving] = useState(false);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const isAdmin = profile?.role === 'admin' || profile?.role === 'superadmin';
  const canUploadPhotos = isAdmin || profile?.role === 'officer';

  // Seed & real-time load from Firestore diseases collection
  useEffect(() => {
    let unsubscribe: () => void = () => {};

    async function initDiseases() {
      try {
        await seedDiseasesCollectionIfNeeded();
      } catch (err) {
        console.warn('Initial seed error:', err);
      }

      unsubscribe = onSnapshot(
        collection(db, 'diseases'),
        (snapshot) => {
          const list: DiseaseItem[] = [];
          snapshot.forEach((d) => {
            const data = d.data();
            list.push({
              slug: data.slug || d.id,
              id: data.slug || d.id,
              crop: data.crop || 'Maize',
              nameEn: data.nameEn || data.name || d.id,
              nameSw: data.nameSw || data.swahiliName || '',
              scientificCause: data.scientificCause || data.scientificName || data.causes || '',
              severity: (data.severity as any) || 'MODERATE',
              affectedParts: data.affectedParts || data.symptomTags || ['leaves'],
              symptoms: data.symptoms || '',
              spread: data.spread || data.causes || '',
              treatment: data.treatment || '',
              prevention: data.prevention || '',
              images: Array.isArray(data.images) ? data.images : [],
              reviewedBy: data.reviewedBy || 'CropCare Centre Agronomy Board',
              reviewedAt: data.reviewedAt || '2026-10-15',
              name: data.nameEn || data.name,
              swahiliName: data.nameSw || data.swahiliName,
              scientificName: data.scientificCause || data.scientificName,
            } as DiseaseItem);
          });
          setDiseases(list);
          setLoading(false);
        },
        (error) => {
          console.warn('Firestore snapshot error on diseases:', error);
          setLoading(false);
        }
      );
    }

    initDiseases();
    return () => unsubscribe();
  }, []);

  // Filter diseases based on search, crop, and affected part
  const filteredDiseases = diseases.filter((d) => {
    // Crop filter
    if (selectedCrop !== 'All') {
      if (d.crop.toLowerCase() !== selectedCrop.toLowerCase()) {
        return false;
      }
    }

    // Affected part filter
    if (selectedPart !== 'all') {
      const parts = d.affectedParts || [];
      if (!parts.includes(selectedPart)) {
        return false;
      }
    }

    // Search box: matches English name, Swahili name, and scientific name
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const inEn = d.nameEn?.toLowerCase().includes(q) || d.name?.toLowerCase().includes(q);
      const inSw = d.nameSw?.toLowerCase().includes(q) || d.swahiliName?.toLowerCase().includes(q);
      const inSci = d.scientificCause?.toLowerCase().includes(q) || d.scientificName?.toLowerCase().includes(q);
      const inSymptoms = d.symptoms?.toLowerCase().includes(q);
      if (!inEn && !inSw && !inSci && !inSymptoms) {
        return false;
      }
    }

    return true;
  });

  const getSeverityPill = (severity: string) => {
    const norm = (severity || '').toUpperCase();
    if (norm === 'HIGH') {
      return (
        <span className="px-3 py-1 rounded-full text-[11px] font-bold bg-[#FEE2E2] text-[#991B1B] border border-[#FCA5A5] shadow-xs">
          HIGH
        </span>
      );
    }
    if (norm === 'MODERATE') {
      return (
        <span className="px-3 py-1 rounded-full text-[11px] font-bold bg-[#FEF3C7] text-[#92400E] border border-[#FDE68A] shadow-xs">
          MODERATE
        </span>
      );
    }
    return (
      <span className="px-3 py-1 rounded-full text-[11px] font-bold bg-[#DCFCE7] text-[#166534] border border-[#86EFAC] shadow-xs">
        LOW
      </span>
    );
  };

  const openAdminEdit = (disease?: DiseaseItem) => {
    if (disease) {
      setEditingDisease(disease);
      setAdminForm({
        slug: disease.slug,
        crop: disease.crop,
        nameEn: disease.nameEn,
        nameSw: disease.nameSw,
        scientificCause: disease.scientificCause,
        severity: (disease.severity as any) || 'MODERATE',
        affectedParts: disease.affectedParts || ['leaves'],
        symptoms: disease.symptoms,
        spread: disease.spread,
        treatment: disease.treatment,
        prevention: disease.prevention,
      });
    } else {
      setEditingDisease(null);
      setAdminForm({
        slug: '',
        crop: 'Maize',
        nameEn: '',
        nameSw: '',
        scientificCause: '',
        severity: 'HIGH',
        affectedParts: ['leaves'],
        symptoms: '',
        spread: '',
        treatment: '',
        prevention: '',
      });
    }
    setShowAdminModal(true);
  };

  const handleAdminSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminForm.nameEn.trim()) return;

    setAdminSaving(true);
    try {
      const slug = editingDisease?.slug || adminForm.slug.trim() || adminForm.nameEn.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      const payload: DiseaseItem = {
        slug,
        id: slug,
        crop: adminForm.crop,
        nameEn: adminForm.nameEn.trim(),
        nameSw: adminForm.nameSw.trim(),
        scientificCause: adminForm.scientificCause.trim(),
        severity: adminForm.severity,
        affectedParts: adminForm.affectedParts,
        symptoms: adminForm.symptoms.trim(),
        spread: adminForm.spread.trim(),
        treatment: adminForm.treatment.trim(),
        prevention: adminForm.prevention.trim(),
        images: editingDisease?.images || [],
        reviewedBy: profile?.fullName || 'CropCare Centre Agronomy Board',
        reviewedAt: new Date().toISOString().split('T')[0],
        name: adminForm.nameEn.trim(),
        swahiliName: adminForm.nameSw.trim(),
        scientificName: adminForm.scientificCause.trim(),
      };

      await setDoc(doc(db, 'diseases', slug), payload, { merge: true });
      setActionSuccess(`Saved ${payload.nameEn} successfully.`);
      setTimeout(() => setActionSuccess(null), 4000);
      setShowAdminModal(false);
    } catch (err) {
      console.error('Error saving disease:', err);
    } finally {
      setAdminSaving(false);
    }
  };

  const compressDiseaseImage = (file: File): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const objectUrl = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(objectUrl);
        const maxWidth = 1200;
        let { width, height } = img;
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Could not initialize canvas context for image compression.'));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (blob) => {
            if (blob) resolve(blob);
            else reject(new Error('Image compression failed.'));
          },
          'image/jpeg',
          0.8
        );
      };
      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        reject(new Error(`Failed to load image "${file.name}" for compression.`));
      };
      img.src = objectUrl;
    });
  };

  const handleSelectPhotoFiles = (e: React.ChangeEvent<HTMLInputElement>, targetDisease: DiseaseItem) => {
    setUploadError(null);
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    const files = Array.from(fileList);
    const invalid = files.find((f) => !allowedTypes.includes(f.type));
    if (invalid) {
      setUploadError(`Unsupported file type "${invalid.type || invalid.name}". Please select JPG, PNG, or WEBP images only.`);
      e.target.value = '';
      return;
    }

    const existingCount = targetDisease.images?.length || 0;
    if (existingCount + files.length > 4) {
      setUploadError(`Maximum 4 photos per disease. This disease already has ${existingCount} photo(s); you can add up to ${Math.max(0, 4 - existingCount)} more.`);
      e.target.value = '';
      return;
    }

    pendingPhotos.forEach((p) => URL.revokeObjectURL(p.previewUrl));
    setPendingPhotos(
      files.map((file) => ({
        file,
        previewUrl: URL.createObjectURL(file),
      }))
    );
    e.target.value = '';
  };

  const handleSavePendingPhotos = async (targetDisease: DiseaseItem) => {
    if (pendingPhotos.length === 0) return;
    setUploadingImage(true);
    setUploadProgress(0);
    setUploadError(null);

    try {
      const uploadedImages: DiseaseImage[] = [];
      const total = pendingPhotos.length;

      for (let i = 0; i < total; i++) {
        const { file } = pendingPhotos[i];
        const compressedBlob = await compressDiseaseImage(file);
        const baseName = file.name.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9_-]/g, '_');
        const storagePath = `diseases/${targetDisease.slug}/${Date.now()}_${i}_${baseName}.jpg`;
        const storageRef = ref(storage, storagePath);

        const downloadUrl = await new Promise<string>((resolve, reject) => {
          const task = uploadBytesResumable(storageRef, compressedBlob, {
            contentType: 'image/jpeg',
          });
          task.on(
            'state_changed',
            (snapshot) => {
              const fileProgress = snapshot.totalBytes > 0 ? snapshot.bytesTransferred / snapshot.totalBytes : 0;
              const overall = Math.round(((i + fileProgress) / total) * 100);
              setUploadProgress(overall);
            },
            (err) => reject(err),
            async () => {
              try {
                const url = await getDownloadURL(task.snapshot.ref);
                resolve(url);
              } catch (urlErr) {
                reject(urlErr);
              }
            }
          );
        });

        uploadedImages.push({
          url: downloadUrl,
          caption: imageCaption.trim() || undefined,
          part: imagePart,
          credit: imageCredit.trim() || undefined,
          license: 'CropCare Centre Machakos',
        });
      }

      const updatedImages = [...(targetDisease.images || []), ...uploadedImages];
      await updateDoc(doc(db, 'diseases', targetDisease.slug), {
        images: updatedImages,
      });

      const updatedDisease: DiseaseItem = {
        ...targetDisease,
        images: updatedImages,
        referencePhotoUrls: updatedImages.map((img) => img.url),
      };

      setDiseases((prev) => prev.map((d) => (d.slug === targetDisease.slug ? updatedDisease : d)));
      if (editingDisease?.slug === targetDisease.slug) setEditingDisease(updatedDisease);
      if (selectedDisease?.slug === targetDisease.slug) setSelectedDisease(updatedDisease);
      if (photoModalDisease?.slug === targetDisease.slug) setPhotoModalDisease(updatedDisease);

      pendingPhotos.forEach((p) => URL.revokeObjectURL(p.previewUrl));
      setPendingPhotos([]);
      setImageCaption('');
      setUploadProgress(100);
      setActionSuccess(`${uploadedImages.length} photo(s) uploaded and saved for ${targetDisease.nameEn}.`);
      setTimeout(() => setActionSuccess(null), 5000);
    } catch (err: any) {
      console.error('Error uploading photo:', err);
      const code = err?.code ? `${err.code}: ` : '';
      const msg = err?.message || String(err);
      setUploadError(`${code}${msg}`);
    } finally {
      setUploadingImage(false);
    }
  };

  const handleDeleteDiseasePhoto = async (targetDisease: DiseaseItem, photoIndex: number) => {
    if (!isAdmin) return;
    const imgToDelete = targetDisease.images?.[photoIndex];
    if (!imgToDelete) return;

    setDeletingPhotoIdx(photoIndex);
    setUploadError(null);
    try {
      try {
        const storageRef = ref(storage, imgToDelete.url);
        await deleteObject(storageRef);
      } catch (storageErr: any) {
        console.warn('Storage delete warning:', storageErr);
      }

      const updatedImages = (targetDisease.images || []).filter((_, idx) => idx !== photoIndex);
      await updateDoc(doc(db, 'diseases', targetDisease.slug), {
        images: updatedImages,
      });

      const updatedDisease: DiseaseItem = {
        ...targetDisease,
        images: updatedImages,
        referencePhotoUrls: updatedImages.map((img) => img.url),
      };

      setDiseases((prev) => prev.map((d) => (d.slug === targetDisease.slug ? updatedDisease : d)));
      if (editingDisease?.slug === targetDisease.slug) setEditingDisease(updatedDisease);
      if (selectedDisease?.slug === targetDisease.slug) setSelectedDisease(updatedDisease);
      if (photoModalDisease?.slug === targetDisease.slug) setPhotoModalDisease(updatedDisease);

      setActionSuccess('Photo deleted from Storage and Firestore.');
      setTimeout(() => setActionSuccess(null), 4000);
    } catch (err: any) {
      console.error('Error deleting photo:', err);
      const code = err?.code ? `${err.code}: ` : '';
      const msg = err?.message || String(err);
      setUploadError(`${code}${msg}`);
    } finally {
      setDeletingPhotoIdx(null);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10">
      {/* Top Heading & Admin Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#EAE5D9] text-[#0F4A2F] text-xs font-semibold mb-2">
            <Sprout className="w-3.5 h-3.5 text-[#2BC55B]" />
            <span>Reference guide for Machakos County crops</span>
          </div>
          <h1 className="font-heading font-black text-3xl sm:text-4xl text-[#0F4A2F] tracking-tight">
            {t('diseaseLibraryTitle')}
          </h1>
          <p className="text-xs sm:text-sm text-[#40544B] mt-1 max-w-2xl leading-relaxed">
            {t('diseaseLibrarySubtitle')}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {isAdmin && (
            <button
              onClick={() => openAdminEdit()}
              className="min-h-[48px] px-4 py-2.5 rounded-full bg-[#0F4A2F] hover:bg-[#155e3c] text-white font-bold text-xs shadow-xs transition-all flex items-center gap-2"
            >
              <PlusCircle className="w-4 h-4 text-[#2BC55B]" />
              <span>{language === 'sw' ? 'Ongeza Ugonjwa' : 'Add Disease'}</span>
            </button>
          )}

          {/* Grid / List View Toggle */}
          <div className="flex items-center bg-[#FBFAF5] border border-[#E7E2D5] rounded-full p-1 shadow-xs">
            <button
              onClick={() => setViewMode('grid')}
              className={`min-h-[40px] px-3 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 ${
                viewMode === 'grid'
                  ? 'bg-[#0F4A2F] text-white shadow-xs'
                  : 'text-[#52665C] hover:text-[#0F4A2F]'
              }`}
              title="Grid view"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{t('gridView')}</span>
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`min-h-[40px] px-3 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 ${
                viewMode === 'list'
                  ? 'bg-[#0F4A2F] text-white shadow-xs'
                  : 'text-[#52665C] hover:text-[#0F4A2F]'
              }`}
              title="List view"
            >
              <List className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{t('listView')}</span>
            </button>
          </div>
        </div>
      </div>

      {actionSuccess && (
        <div className="mb-5 p-3.5 rounded-2xl bg-[#DCFCE7] border border-[#86EFAC] text-[#166534] text-xs font-medium flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-[#166534] shrink-0" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {/* Search Box */}
      <div className="mb-5">
        <div className="relative">
          <Search className="w-5 h-5 text-[#687C73] absolute left-4 top-3.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={
              language === 'sw'
                ? 'Tafuta kwa jina la Kiingereza, Kiswahili, au kisayansi (mf. Cassava Mosaic, Funza wa Jeshi, Spodoptera)...'
                : 'Search by English name, Swahili name, or scientific name (e.g. Fall Armyworm, Ugonjwa wa Ukoma, Geminiviridae)...'
            }
            className="w-full min-h-[48px] bg-[#FBFAF5] border border-[#E7E2D5] rounded-2xl pl-12 pr-10 py-3 text-xs sm:text-sm text-[#2B3A33] shadow-xs focus:outline-none focus:ring-2 focus:ring-[#2BC55B]"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3.5 top-3.5 text-[#687C73] hover:text-[#0F4A2F] p-1"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Crop Filter Chips (Row 1) */}
      <div className="mb-3">
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
          {CROPS_LIST.map((crop) => {
            const active = selectedCrop === crop;
            return (
              <button
                key={crop}
                onClick={() => setSelectedCrop(crop)}
                className={`min-h-[48px] px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all flex items-center gap-2 ${
                  active
                    ? 'bg-[#0F4A2F] text-white shadow-sm'
                    : 'bg-[#FBFAF5] text-[#2B3A33] border border-[#E7E2D5] hover:bg-[#EAE5D9]'
                }`}
              >
                <Sprout className={`w-3.5 h-3.5 ${active ? 'text-[#2BC55B]' : 'text-[#687C73]'}`} />
                <span>{crop === 'All' ? (language === 'sw' ? 'Mazao Yote' : 'All Crops') : crop}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Affected Part Filter Chips (Row 2, Smaller) */}
      <div className="mb-8">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-2 scrollbar-none">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#687C73] mr-1 shrink-0 flex items-center gap-1">
            <Filter className="w-3 h-3 text-[#2BC55B]" />
            <span>{language === 'sw' ? 'Sehemu:' : 'Affected Part:'}</span>
          </span>
          {AFFECTED_PARTS.map((part) => {
            const active = selectedPart === part.id;
            return (
              <button
                key={part.id}
                onClick={() => setSelectedPart(part.id)}
                className={`min-h-[36px] px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
                  active
                    ? 'bg-[#2BC55B] text-[#0F4A2F] font-bold shadow-xs'
                    : 'bg-[#EAE5D9]/70 text-[#2B3A33] hover:bg-[#EAE5D9]'
                }`}
              >
                {language === 'sw' ? part.sw : part.en}
              </button>
            );
          })}
        </div>
      </div>

      {/* Disease Cards (3 col desktop, 2 tablet, 1 mobile) OR List View */}
      {loading ? (
        <div className="p-16 text-center text-[#52665C]">
          <div className="w-10 h-10 border-2 border-[#0F4A2F] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-xs font-medium">{t('loading')}</p>
        </div>
      ) : filteredDiseases.length === 0 ? (
        <div className="bg-[#FBFAF5] rounded-3xl border border-[#E7E2D5] p-8 sm:p-12 text-center max-w-md mx-auto shadow-xs">
          <div className="w-14 h-14 rounded-full bg-[#EAE5D9] text-[#0F4A2F] flex items-center justify-center mx-auto mb-4">
            <BookOpen className="w-7 h-7 text-[#2BC55B]" />
          </div>
          <h3 className="font-heading font-bold text-base text-[#0F4A2F] mb-1">
            {language === 'sw' ? 'Hakuna Magonjwa Yaliyopatikana' : 'No matching diseases found'}
          </h3>
          <p className="text-xs text-[#52665C] leading-relaxed mb-4">
            {language === 'sw'
              ? 'Jaribu kuweka neno tofauti la utafutaji au ubadilishe vichujio.'
              : 'Try clearing your filters or searching for another keyword.'}
          </p>
          <button
            onClick={() => {
              setSearchQuery('');
              setSelectedCrop('All');
              setSelectedPart('all');
            }}
            className="min-h-[48px] px-5 py-2.5 rounded-full bg-[#0F4A2F] text-white text-xs font-bold"
          >
            {language === 'sw' ? 'Weka Upya Vichujio' : 'Reset All Filters'}
          </button>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredDiseases.map((disease) => {
            const firstImg = disease.images && disease.images.length > 0 ? disease.images[0].url : null;
            return (
              <div
                key={disease.slug}
                onClick={() => setSelectedDisease(disease)}
                className="group bg-[#FBFAF5] rounded-3xl border border-[#E7E2D5] p-5 shadow-xs hover:shadow-md transition-all cursor-pointer flex flex-col justify-between hover:border-[#2BC55B] relative select-none"
              >
                <div>
                  {/* Photo Container 16:10 with Overlay Pills */}
                  <div className="relative mb-3.5">
                    <DiseaseImageWithFallback
                      src={firstImg}
                      alt={disease.nameEn}
                      aspectRatioClass="aspect-[16/10]"
                    />
                    {/* Top Overlay Pills */}
                    <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between pointer-events-none">
                      <span className="px-3 py-1 rounded-full text-[11px] font-bold bg-[#FBFAF5]/90 backdrop-blur-xs text-[#0F4A2F] shadow-xs border border-[#E7E2D5]">
                        {disease.crop}
                      </span>
                      {getSeverityPill(disease.severity)}
                    </div>
                  </div>

                  {/* Common Name (bold) */}
                  <h3 className="font-heading font-black text-lg text-[#0F4A2F] group-hover:text-[#2BC55B] transition-colors leading-snug">
                    {disease.nameEn}
                  </h3>

                  {/* Swahili Name (green) */}
                  {disease.nameSw && (
                    <p className="text-xs font-bold text-[#166534] mt-0.5">
                      {disease.nameSw}
                    </p>
                  )}

                  {/* Scientific Name (italic, smaller) */}
                  {disease.scientificCause && (
                    <p className="text-[11px] text-[#52665C] italic mt-0.5">
                      {disease.scientificCause}
                    </p>
                  )}

                  {/* One-line Description */}
                  <p className="text-xs text-[#2B3A33] line-clamp-1 mt-2.5 leading-relaxed">
                    {disease.symptoms}
                  </p>
                </div>

                {/* Footer with Add photos & Circle Arrow Button */}
                <div className="pt-4 mt-3 border-t border-[#E7E2D5] flex items-center justify-between gap-2">
                  <span className="text-[11px] font-medium text-[#687C73] truncate">
                    {disease.affectedParts && disease.affectedParts.length > 0
                      ? disease.affectedParts.join(', ')
                      : 'General'}
                  </span>

                  <div className="flex items-center gap-2 shrink-0">
                    {canUploadPhotos && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setUploadError(null);
                          setPendingPhotos([]);
                          setPhotoModalDisease(disease);
                        }}
                        className="px-2.5 py-1 rounded-full bg-[#0F4A2F] hover:bg-[#155e3c] text-white text-[11px] font-bold flex items-center gap-1 transition-colors"
                      >
                        <Camera className="w-3 h-3 text-[#2BC55B]" />
                        <span>Add photos</span>
                      </button>
                    )}

                    {/* Circle Arrow Button (outline, fills on hover) */}
                    <div className="w-9 h-9 rounded-full border border-[#2BC55B] flex items-center justify-center text-[#0F4A2F] group-hover:bg-[#2BC55B] group-hover:text-white transition-all">
                      <ArrowRight className="w-4 h-4" />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Compact List View Toggle */
        <div className="bg-[#FBFAF5] rounded-3xl border border-[#E7E2D5] divide-y divide-[#E7E2D5] overflow-hidden shadow-xs">
          {filteredDiseases.map((disease) => {
            const firstImg = disease.images && disease.images.length > 0 ? disease.images[0].url : null;
            return (
              <div
                key={disease.slug}
                onClick={() => setSelectedDisease(disease)}
                className="group p-4 flex items-center justify-between gap-4 hover:bg-[#F6F1E4] transition-all cursor-pointer select-none"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  {/* Small Rounded Thumbnail */}
                  <div className="w-16 h-12 rounded-xl overflow-hidden shrink-0 border border-[#E7E2D5]">
                    <DiseaseImageWithFallback
                      src={firstImg}
                      alt={disease.nameEn}
                      aspectRatioClass="aspect-[4/3]"
                    />
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="font-heading font-black text-sm text-[#0F4A2F] group-hover:text-[#2BC55B] transition-colors truncate">
                        {disease.nameEn}
                      </h4>
                      <span className="hidden sm:inline-block">{getSeverityPill(disease.severity)}</span>
                    </div>

                    {disease.nameSw && (
                      <p className="text-xs font-bold text-[#166534] truncate">
                        {disease.nameSw}
                      </p>
                    )}

                    {disease.scientificCause && (
                      <p className="text-[11px] text-[#52665C] italic truncate">
                        {disease.scientificCause}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <span className="hidden md:inline-block text-xs font-semibold px-2.5 py-0.5 rounded-full bg-[#EAE5D9] text-[#0F4A2F]">
                    {disease.crop}
                  </span>
                  <div className="w-9 h-9 rounded-full border border-[#2BC55B] flex items-center justify-center text-[#0F4A2F] group-hover:bg-[#2BC55B] group-hover:text-white transition-all">
                    <ArrowRight className="w-4 h-4" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Disease Detail Modal */}
      {selectedDisease && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-[#FBFAF5] rounded-3xl max-w-3xl w-full p-5 sm:p-8 shadow-2xl border border-[#E7E2D5] my-6 animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Top Bar */}
            <div className="flex items-start justify-between pb-4 border-b border-[#E7E2D5] mb-4">
              <div>
                <div className="flex items-center gap-2 flex-wrap mb-1.5">
                  <span className="text-xs font-bold uppercase tracking-wider text-[#0F4A2F] bg-[#EAE5D9] px-3 py-1 rounded-full">
                    {selectedDisease.crop}
                  </span>
                  {getSeverityPill(selectedDisease.severity)}
                </div>
                <h2 className="font-heading font-black text-2xl sm:text-3xl text-[#0F4A2F] leading-tight">
                  {selectedDisease.nameEn}
                </h2>
                {selectedDisease.nameSw && (
                  <p className="text-sm font-bold text-[#166534] mt-0.5">
                    {selectedDisease.nameSw}
                  </p>
                )}
                {selectedDisease.scientificCause && (
                  <p className="text-xs text-[#52665C] italic mt-0.5">
                    {selectedDisease.scientificCause}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-1">
                {isAdmin && (
                  <button
                    onClick={() => {
                      const d = selectedDisease;
                      setSelectedDisease(null);
                      openAdminEdit(d);
                    }}
                    className="p-2 rounded-full text-[#0F4A2F] hover:bg-[#EAE5D9]"
                    title="Edit Disease"
                  >
                    <Edit className="w-5 h-5" />
                  </button>
                )}
                <button
                  onClick={() => setSelectedDisease(null)}
                  className="p-2 rounded-full text-[#52665C] hover:bg-[#EAE5D9] hover:text-[#0F4A2F]"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            {/* Modal Scrollable Body */}
            <div className="space-y-4 max-h-[65vh] overflow-y-auto pr-1">
              {/* Image Gallery */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-[#0F4A2F]">
                    Photos ({selectedDisease.images?.length || 0}/4)
                  </span>
                  {canUploadPhotos && (
                    <button
                      type="button"
                      onClick={() => {
                        setUploadError(null);
                        setPendingPhotos([]);
                        setPhotoModalDisease(selectedDisease);
                      }}
                      className="px-3 py-1.5 rounded-full bg-[#0F4A2F] hover:bg-[#155e3c] text-white text-xs font-bold flex items-center gap-1.5 transition-colors"
                    >
                      <Camera className="w-3.5 h-3.5 text-[#2BC55B]" />
                      <span>Add photos</span>
                    </button>
                  )}
                </div>
                {selectedDisease.images && selectedDisease.images.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {selectedDisease.images.map((img, idx) => (
                      <div key={idx} className="relative rounded-2xl overflow-hidden border border-[#E7E2D5] bg-white">
                        <DiseaseImageWithFallback
                          src={img.url}
                          alt={img.caption || selectedDisease.nameEn}
                          aspectRatioClass="aspect-[16/10]"
                        />
                        {isAdmin && (
                          <button
                            type="button"
                            disabled={deletingPhotoIdx === idx}
                            onClick={() => handleDeleteDiseasePhoto(selectedDisease, idx)}
                            title="Delete photo"
                            className="absolute top-2 right-2 p-2 rounded-full bg-red-600 hover:bg-red-700 text-white shadow-md transition-colors disabled:opacity-50"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {(img.caption || img.credit) && (
                          <div className="p-2 text-[11px] text-[#52665C]">
                            {img.caption && <p className="font-medium text-[#2B3A33]">{img.caption}</p>}
                            {img.credit && <p className="text-[10px] text-[#687C73]">Credit: {img.credit}</p>}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <DiseaseImageWithFallback
                    src={null}
                    alt={selectedDisease.nameEn}
                    aspectRatioClass="aspect-[16/9]"
                  />
                )}
              </div>

              {/* Symptoms */}
              <div className="p-4 rounded-2xl bg-white border border-[#E7E2D5]">
                <div className="flex items-center gap-2 mb-1.5">
                  <Leaf className="w-4 h-4 text-[#2BC55B]" />
                  <h4 className="font-heading font-black text-sm text-[#0F4A2F]">
                    {t('symptomsHeading')}
                  </h4>
                </div>
                <p className="text-xs sm:text-sm text-[#2B3A33] leading-relaxed whitespace-pre-line pl-6">
                  {selectedDisease.symptoms}
                </p>
              </div>

              {/* Scientific Cause / Vector */}
              <div className="p-4 rounded-2xl bg-white border border-[#E7E2D5]">
                <div className="flex items-center gap-2 mb-1.5">
                  <Bug className="w-4 h-4 text-[#0F4A2F]" />
                  <h4 className="font-heading font-black text-sm text-[#0F4A2F]">
                    {t('scientificCauseLabel')}
                  </h4>
                </div>
                <p className="text-xs sm:text-sm text-[#2B3A33] leading-relaxed pl-6">
                  {selectedDisease.scientificCause}
                </p>
              </div>

              {/* How It Spreads */}
              <div className="p-4 rounded-2xl bg-white border border-[#E7E2D5]">
                <div className="flex items-center gap-2 mb-1.5">
                  <AlertTriangle className="w-4 h-4 text-amber-700" />
                  <h4 className="font-heading font-black text-sm text-[#0F4A2F]">
                    {t('spreadHeading')}
                  </h4>
                </div>
                <p className="text-xs sm:text-sm text-[#2B3A33] leading-relaxed pl-6">
                  {selectedDisease.spread}
                </p>
              </div>

              {/* Treatment */}
              <div className="p-4 rounded-2xl bg-[#DCFCE7]/40 border border-[#86EFAC]/60">
                <div className="flex items-center gap-2 mb-1.5">
                  <ShieldCheck className="w-4 h-4 text-[#166534]" />
                  <h4 className="font-heading font-black text-sm text-[#166534]">
                    {t('treatmentHeading')}
                  </h4>
                </div>
                <p className="text-xs sm:text-sm text-[#2B3A33] leading-relaxed pl-6">
                  {selectedDisease.treatment}
                </p>
              </div>

              {/* Prevention */}
              <div className="p-4 rounded-2xl bg-[#FEF3C7]/40 border border-[#FDE68A]/70">
                <div className="flex items-center gap-2 mb-1.5">
                  <Sprout className="w-4 h-4 text-[#92400E]" />
                  <h4 className="font-heading font-black text-sm text-[#92400E]">
                    {t('preventionHeading')}
                  </h4>
                </div>
                <p className="text-xs sm:text-sm text-[#2B3A33] leading-relaxed pl-6">
                  {selectedDisease.prevention}
                </p>
              </div>

              {/* Reviewed meta */}
              <div className="px-3 py-2 rounded-xl bg-[#EAE5D9]/50 flex items-center justify-between text-[11px] text-[#52665C]">
                <span>{t('reviewedByLabel')}: {selectedDisease.reviewedBy || 'CropCare Centre Agronomy Board'}</span>
                <span>{t('reviewedAtLabel')}: {formatDateKE(selectedDisease.reviewedAt)}</span>
              </div>
            </div>

            {/* Modal Bottom Actions */}
            <div className="pt-4 mt-4 border-t border-[#E7E2D5] flex flex-col sm:flex-row items-center justify-between gap-3">
              <span className="text-xs text-[#52665C]">
                {language === 'sw'
                  ? 'Je, unaona dalili hizi shambani mwako?'
                  : 'Observing these symptoms in your field?'}
              </span>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                {onReportDisease && (
                  <button
                    onClick={() => {
                      const crop = selectedDisease.crop;
                      const symptoms = `Suspected ${selectedDisease.nameEn}. Symptoms: ${selectedDisease.symptoms.substring(0, 150)}...`;
                      setSelectedDisease(null);
                      onReportDisease(crop, symptoms);
                    }}
                    className="flex-1 sm:flex-none min-h-[48px] px-6 py-2.5 rounded-full bg-[#2BC55B] hover:bg-[#25ad50] text-[#0F4A2F] font-bold text-xs shadow-xs transition-all flex items-center justify-center gap-1.5"
                  >
                    <PlusCircle className="w-4 h-4 stroke-[2.5]" />
                    <span>{t('reportCaseForThisDisease')}</span>
                  </button>
                )}

                <button
                  onClick={() => setSelectedDisease(null)}
                  className="min-h-[48px] px-5 py-2.5 rounded-full bg-[#FBFAF5] border border-[#D5CFC0] text-[#2B3A33] hover:bg-[#EAE5D9] font-semibold text-xs transition-all"
                >
                  {t('cancelBtn')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Admin Screen / Modal to Create/Edit Disease and Upload to Storage */}
      {showAdminModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-[#FBFAF5] rounded-3xl max-w-2xl w-full p-5 sm:p-8 shadow-2xl border border-[#E7E2D5] my-6">
            <div className="flex items-center justify-between pb-3 border-b border-[#E7E2D5] mb-4">
              <h3 className="font-heading font-black text-xl text-[#0F4A2F]">
                {editingDisease ? 'Edit Disease & Manage Verified Photos' : 'Add New Disease to Catalog'}
              </h3>
              <button
                onClick={() => setShowAdminModal(false)}
                className="p-1.5 rounded-full text-[#52665C] hover:bg-[#EAE5D9]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAdminSave} className="space-y-4 max-h-[65vh] overflow-y-auto pr-1 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-[#0F4A2F] mb-1">Common English Name *</label>
                  <input
                    type="text"
                    required
                    value={adminForm.nameEn}
                    onChange={(e) => setAdminForm({ ...adminForm, nameEn: e.target.value })}
                    placeholder="e.g. Maize Lethal Necrosis Disease"
                    className="w-full min-h-[44px] bg-white border border-[#D5CFC0] rounded-xl px-3 py-2 text-[#2B3A33] text-xs focus:ring-2 focus:ring-[#2BC55B] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-bold text-[#0F4A2F] mb-1">Swahili Name *</label>
                  <input
                    type="text"
                    value={adminForm.nameSw}
                    onChange={(e) => setAdminForm({ ...adminForm, nameSw: e.target.value })}
                    placeholder="e.g. Ugonjwa Hatari wa Mahindi"
                    className="w-full min-h-[44px] bg-white border border-[#D5CFC0] rounded-xl px-3 py-2 text-[#2B3A33] text-xs focus:ring-2 focus:ring-[#2BC55B] focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-[#0F4A2F] mb-1">Crop *</label>
                  <select
                    value={adminForm.crop}
                    onChange={(e) => setAdminForm({ ...adminForm, crop: e.target.value })}
                    className="w-full min-h-[44px] bg-white border border-[#D5CFC0] rounded-xl px-3 py-2 text-[#2B3A33] text-xs focus:ring-2 focus:ring-[#2BC55B] focus:outline-none"
                  >
                    {CROPS_LIST.filter((c) => c !== 'All').map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-[#0F4A2F] mb-1">Severity *</label>
                  <select
                    value={adminForm.severity}
                    onChange={(e) => setAdminForm({ ...adminForm, severity: e.target.value as any })}
                    className="w-full min-h-[44px] bg-white border border-[#D5CFC0] rounded-xl px-3 py-2 text-[#2B3A33] text-xs focus:ring-2 focus:ring-[#2BC55B] focus:outline-none"
                  >
                    <option value="HIGH">HIGH (Epidemic)</option>
                    <option value="MODERATE">MODERATE</option>
                    <option value="LOW">LOW (Advisory)</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-[#0F4A2F] mb-1">Affected Part</label>
                  <select
                    value={adminForm.affectedParts[0] || 'leaves'}
                    onChange={(e) => setAdminForm({ ...adminForm, affectedParts: [e.target.value] })}
                    className="w-full min-h-[44px] bg-white border border-[#D5CFC0] rounded-xl px-3 py-2 text-[#2B3A33] text-xs focus:ring-2 focus:ring-[#2BC55B] focus:outline-none"
                  >
                    <option value="leaves">Leaves</option>
                    <option value="stem">Stem</option>
                    <option value="roots">Roots</option>
                    <option value="fruit">Fruit</option>
                    <option value="flower">Flower</option>
                    <option value="wilt">Wilting</option>
                    <option value="pests">Pests</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-[#0F4A2F] mb-1">Scientific Cause / Vector *</label>
                <input
                  type="text"
                  value={adminForm.scientificCause}
                  onChange={(e) => setAdminForm({ ...adminForm, scientificCause: e.target.value })}
                  placeholder="e.g. Spodoptera frugiperda"
                  className="w-full min-h-[44px] bg-white border border-[#D5CFC0] rounded-xl px-3 py-2 text-[#2B3A33] text-xs focus:ring-2 focus:ring-[#2BC55B] focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-[#0F4A2F] mb-1">Symptoms *</label>
                <textarea
                  rows={2}
                  required
                  value={adminForm.symptoms}
                  onChange={(e) => setAdminForm({ ...adminForm, symptoms: e.target.value })}
                  className="w-full bg-white border border-[#D5CFC0] rounded-xl px-3 py-2 text-[#2B3A33] text-xs focus:ring-2 focus:ring-[#2BC55B] focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-[#0F4A2F] mb-1">How It Spreads *</label>
                <textarea
                  rows={2}
                  value={adminForm.spread}
                  onChange={(e) => setAdminForm({ ...adminForm, spread: e.target.value })}
                  className="w-full bg-white border border-[#D5CFC0] rounded-xl px-3 py-2 text-[#2B3A33] text-xs focus:ring-2 focus:ring-[#2BC55B] focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-[#0F4A2F] mb-1">Treatment *</label>
                  <textarea
                    rows={2}
                    value={adminForm.treatment}
                    onChange={(e) => setAdminForm({ ...adminForm, treatment: e.target.value })}
                    className="w-full bg-white border border-[#D5CFC0] rounded-xl px-3 py-2 text-[#2B3A33] text-xs focus:ring-2 focus:ring-[#2BC55B] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-bold text-[#0F4A2F] mb-1">Prevention *</label>
                  <textarea
                    rows={2}
                    value={adminForm.prevention}
                    onChange={(e) => setAdminForm({ ...adminForm, prevention: e.target.value })}
                    className="w-full bg-white border border-[#D5CFC0] rounded-xl px-3 py-2 text-[#2B3A33] text-xs focus:ring-2 focus:ring-[#2BC55B] focus:outline-none"
                  />
                </div>
              </div>

              {/* Upload Real Photo to Firebase Storage */}
              {editingDisease && canUploadPhotos && (
                <div className="p-4 rounded-2xl bg-[#EAE5D9]/60 border border-[#D5CFC0] space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Camera className="w-4 h-4 text-[#0F4A2F]" />
                      <h4 className="font-heading font-black text-xs text-[#0F4A2F]">
                        Disease Photos ({editingDisease.images?.length || 0}/4)
                      </h4>
                    </div>
                    <label className="min-h-[38px] px-3.5 py-1.5 rounded-full bg-[#0F4A2F] hover:bg-[#155e3c] text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-xs">
                      <Camera className="w-3.5 h-3.5 text-[#2BC55B]" />
                      <span>Add photos</span>
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        multiple
                        disabled={uploadingImage}
                        onChange={(e) => handleSelectPhotoFiles(e, editingDisease)}
                        className="hidden"
                      />
                    </label>
                  </div>

                  {uploadError && (
                    <div className="p-2.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-medium">
                      {uploadError}
                    </div>
                  )}

                  {pendingPhotos.length > 0 && (
                    <div className="space-y-2.5 p-3 rounded-xl bg-white border border-[#D5CFC0]">
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {pendingPhotos.map((p, idx) => (
                          <div key={idx} className="relative rounded-xl overflow-hidden border border-[#E7E2D5] aspect-[16/10]">
                            <img src={p.previewUrl} alt="Preview" className="w-full h-full object-cover" />
                          </div>
                        ))}
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <input
                          type="text"
                          placeholder="Optional caption (e.g. Leaf necrosis)"
                          value={imageCaption}
                          onChange={(e) => setImageCaption(e.target.value)}
                          className="bg-white border border-[#D5CFC0] rounded-xl px-3 py-1.5 text-xs text-[#2B3A33]"
                        />
                        <input
                          type="text"
                          placeholder="Photo source / credit (optional)"
                          value={imageCredit}
                          onChange={(e) => setImageCredit(e.target.value)}
                          className="bg-white border border-[#D5CFC0] rounded-xl px-3 py-1.5 text-xs text-[#2B3A33]"
                        />
                      </div>
                      {uploadingImage && (
                        <div className="space-y-1">
                          <div className="w-full h-2 bg-[#EAE5D9] rounded-full overflow-hidden">
                            <div
                              className="h-full bg-[#2BC55B] transition-all duration-200"
                              style={{ width: `${uploadProgress}%` }}
                            />
                          </div>
                          <p className="text-[11px] text-[#52665C] font-medium">Uploading... {uploadProgress}%</p>
                        </div>
                      )}
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          disabled={uploadingImage}
                          onClick={() => {
                            pendingPhotos.forEach((p) => URL.revokeObjectURL(p.previewUrl));
                            setPendingPhotos([]);
                          }}
                          className="px-3 py-1.5 rounded-full border border-[#D5CFC0] text-xs font-semibold text-[#2B3A33]"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          disabled={uploadingImage}
                          onClick={() => handleSavePendingPhotos(editingDisease)}
                          className="px-4 py-1.5 rounded-full bg-[#2BC55B] hover:bg-[#23a84d] text-white text-xs font-bold disabled:opacity-50"
                        >
                          {uploadingImage ? `Uploading (${uploadProgress}%)` : 'Save photo'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="pt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAdminModal(false)}
                  className="min-h-[48px] px-5 py-2 rounded-full bg-[#FBFAF5] border border-[#D5CFC0] text-[#2B3A33] text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={adminSaving}
                  className="min-h-[48px] px-6 py-2 rounded-full bg-[#2BC55B] hover:bg-[#25ad50] text-[#0F4A2F] font-bold text-xs shadow-xs"
                >
                  {adminSaving ? 'Saving...' : 'Save Disease Entry'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Dedicated Add Photos Modal */}
      {photoModalDisease && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-[#FBFAF5] rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-[#E7E2D5] space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-heading font-black text-lg text-[#0F4A2F]">
                  Add photos — {photoModalDisease.nameEn}
                </h3>
                <p className="text-xs text-[#52665C]">
                  {photoModalDisease.images?.length || 0}/4 photos used. JPG, PNG, or WEBP only.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  pendingPhotos.forEach((p) => URL.revokeObjectURL(p.previewUrl));
                  setPendingPhotos([]);
                  setUploadError(null);
                  setPhotoModalDisease(null);
                }}
                className="p-2 rounded-full hover:bg-[#EAE5D9] text-[#2B3A33]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {uploadError && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-medium">
                {uploadError}
              </div>
            )}

            <label className="min-h-[48px] px-5 py-2.5 rounded-full bg-[#0F4A2F] hover:bg-[#155e3c] text-white font-bold text-xs inline-flex items-center gap-2 cursor-pointer shadow-xs">
              <Camera className="w-4 h-4 text-[#2BC55B]" />
              <span>Select photos (up to {Math.max(0, 4 - (photoModalDisease.images?.length || 0))})</span>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                disabled={uploadingImage}
                onChange={(e) => handleSelectPhotoFiles(e, photoModalDisease)}
                className="hidden"
              />
            </label>

            {pendingPhotos.length > 0 && (
              <div className="space-y-3 p-3.5 rounded-2xl bg-white border border-[#D5CFC0]">
                <div className="grid grid-cols-2 gap-2.5">
                  {pendingPhotos.map((p, idx) => (
                    <div key={idx} className="rounded-xl overflow-hidden border border-[#E7E2D5] aspect-[16/10]">
                      <img src={p.previewUrl} alt="Preview" className="w-full h-full object-cover" />
                    </div>
                  ))}
                </div>
                <div className="space-y-2">
                  <input
                    type="text"
                    placeholder="Optional caption (e.g. Leaf necrosis)"
                    value={imageCaption}
                    onChange={(e) => setImageCaption(e.target.value)}
                    className="w-full bg-white border border-[#D5CFC0] rounded-xl px-3 py-2 text-xs text-[#2B3A33]"
                  />
                  <input
                    type="text"
                    placeholder="Photo source / credit (optional)"
                    value={imageCredit}
                    onChange={(e) => setImageCredit(e.target.value)}
                    className="w-full bg-white border border-[#D5CFC0] rounded-xl px-3 py-2 text-xs text-[#2B3A33]"
                  />
                </div>
                {uploadingImage && (
                  <div className="space-y-1">
                    <div className="w-full h-2 bg-[#EAE5D9] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#2BC55B] transition-all duration-200"
                        style={{ width: `${uploadProgress}%` }}
                      />
                    </div>
                    <p className="text-[11px] text-[#52665C] font-medium">Uploading... {uploadProgress}%</p>
                  </div>
                )}
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    disabled={uploadingImage}
                    onClick={() => {
                      pendingPhotos.forEach((p) => URL.revokeObjectURL(p.previewUrl));
                      setPendingPhotos([]);
                    }}
                    className="px-4 py-2 rounded-full border border-[#D5CFC0] text-xs font-semibold text-[#2B3A33]"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={uploadingImage}
                    onClick={() => handleSavePendingPhotos(photoModalDisease)}
                    className="px-5 py-2 rounded-full bg-[#2BC55B] hover:bg-[#23a84d] text-white text-xs font-bold disabled:opacity-50"
                  >
                    {uploadingImage ? `Uploading (${uploadProgress}%)` : 'Save photo'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
