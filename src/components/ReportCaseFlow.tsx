import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { CaseItem, OutbreakAlert } from '../types';
import { MACHAKOS_SUB_COUNTIES } from '../utils/machakosData';
import { generateUniqueCaseId } from '../utils/idGenerator';
import { formatDateKE, isValidKenyanPhone, formatKenyanPhone } from '../utils/formatters';
import { db } from '../firebase';
import { doc, setDoc } from 'firebase/firestore';
import heic2any from 'heic2any';
import {
  saveCasePhotos,
  CasePhotoPayload,
  USE_FIRESTORE_PHOTOS as SERVICE_USE_FIRESTORE_PHOTOS,
} from '../services/casePhotosService';

/**
 * TOGGLE PHOTO STORAGE BACKEND:
 * Set to `true` to store case photos in Firestore subcollection cases/{caseId}/photos/{slotName}.
 * Set to `false` to store in Firebase Storage.
 */
import {
  Sprout,
  Camera,
  Upload,
  Mic,
  MicOff,
  Check,
  MapPin,
  Phone,
  ShieldCheck,
  AlertTriangle,
  ArrowRight,
  ArrowLeft,
  X,
  RotateCcw,
  Trash2,
  Calendar,
  Layers,
  HelpCircle,
  FileCheck,
  CheckCircle2,
  Wheat,
  Eye,
  AlertCircle,
  Info,
  Loader2,
} from 'lucide-react';

/**
 * TOGGLE PHOTO STORAGE BACKEND:
 * Set to `true` to store case photos in Firestore subcollection cases/{caseId}/photos/{slotName}.
 * Set to `false` to store in Firebase Storage.
 */
export const USE_FIRESTORE_PHOTOS = true;

interface ReportCaseFlowProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (caseId: string) => void;
  initialCrop?: string;
  initialSymptoms?: string;
  alerts?: OutbreakAlert[];
}

interface PhotoSlotData {
  file?: File;
  blobUrl?: string;
  dataUrl?: string;
  storageUrl?: string;
  fileSizeKb?: number;
  sizeBytes?: number;
  uploading?: boolean;
  progress?: number;
}

const CROP_OPTIONS = [
  { id: 'Maize', en: 'Maize', sw: 'Mahindi' },
  { id: 'Beans', en: 'Beans', sw: 'Maharagwe' },
  { id: 'Cassava', en: 'Cassava', sw: 'Mihogo' },
  { id: 'Mango', en: 'Mango', sw: 'Embe' },
  { id: 'Tomato', en: 'Tomato', sw: 'Nyanya' },
  { id: 'Kale', en: 'Kale / Sukuma Wiki', sw: 'Sukuma Wiki' },
  { id: 'Cowpea', en: 'Cowpea', sw: 'Kunde' },
  { id: 'Pigeon pea', en: 'Pigeon pea', sw: 'Mbaazi' },
  { id: 'Sorghum', en: 'Sorghum', sw: 'Mtama' },
  { id: 'Sweet Potato', en: 'Sweet Potato', sw: 'Viazi Vitamu' },
  { id: 'Other', en: 'Other Crop', sw: 'Zao Lingine' },
];

const SYMPTOM_CHIPS = [
  { id: 'Yellowing', en: 'Yellowing', sw: 'Kugeuka Manjano' },
  { id: 'Brown spots', en: 'Brown spots', sw: 'Madoa ya Kahawia' },
  { id: 'Wilting', en: 'Wilting', sw: 'Kunyauka' },
  { id: 'Holes in leaves', en: 'Holes in leaves', sw: 'Matundu Majanini' },
  { id: 'Mosaic pattern', en: 'Mosaic pattern', sw: 'Madoadoa (Mosaic)' },
  { id: 'Rotting', en: 'Rotting', sw: 'Kuoza' },
  { id: 'Stunted growth', en: 'Stunted growth', sw: 'Kudumaa' },
  { id: 'Insects seen', en: 'Insects seen', sw: 'Wadudu Wanaonekana' },
  { id: 'Powdery coating', en: 'Powdery coating', sw: 'Unga Mweupe' },
  { id: 'Curling leaves', en: 'Curling leaves', sw: 'Majani Kujikunja' },
];

const PHOTO_SLOTS = [
  { id: 'wholePlant', titleEn: 'Whole plant', titleSw: 'Mmea wote' },
  { id: 'closeUp', titleEn: 'Close-up of affected part', titleSw: 'Picha ya karibu' },
  { id: 'stemRoots', titleEn: 'Stem or roots', titleSw: 'Shina au mizizi' },
  { id: 'fieldView', titleEn: 'Wider field view', titleSw: 'Sehemu ya shamba' },
];

export const ReportCaseFlow: React.FC<ReportCaseFlowProps> = ({
  isOpen,
  onClose,
  onSuccess,
  initialCrop,
  initialSymptoms,
  alerts = [],
}) => {
  const { currentUser, profile } = useAuth();
  const { t, language } = useLanguage();

  const [step, setStep] = useState<number>(1);
  const [submittedCaseId, setSubmittedCaseId] = useState<string | null>(null);

  // Step 1: Crop
  const [selectedCrop, setSelectedCrop] = useState<string>(initialCrop || '');
  const [otherCropName, setOtherCropName] = useState<string>('');

  // Step 2: Guided Photos
  const [photoSlots, setPhotoSlots] = useState<{ [key: string]: PhotoSlotData }>({});
  const [photoError, setPhotoError] = useState<string | null>(null);

  // Step 3: Symptoms & Assessment
  const [selectedChips, setSelectedChips] = useState<string[]>([]);
  const [additionalNotes, setAdditionalNotes] = useState<string>(initialSymptoms || '');
  const [isListeningVoice, setIsListeningVoice] = useState<boolean>(false);
  const [fieldFraction, setFieldFraction] = useState<string>('few');
  const [spreadSpeed, setSpreadSpeed] = useState<string>('slowly');
  const [rainPastWeek, setRainPastWeek] = useState<string>('no');
  const [chemicalsUsed, setChemicalsUsed] = useState<string>('');
  const [cropStage, setCropStage] = useState<string>('growing');
  const todayStr = new Date().toISOString().split('T')[0];
  const [dateFirstNoticed, setDateFirstNoticed] = useState<string>(todayStr);

  // Step 4: Location & Contact
  const [subCounty, setSubCounty] = useState<string>('');
  const [ward, setWard] = useState<string>('');
  const [village, setVillage] = useState<string>('');
  const [phone, setPhone] = useState<string>(profile?.phone || '');
  const [gpsCoords, setGpsCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [detectingGps, setDetectingGps] = useState<boolean>(false);

  // Step 5: Review & Consent
  const [consentAccepted, setConsentAccepted] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Draft key
  const DRAFT_KEY = `cdims_case_draft_${currentUser?.uid || 'guest'}`;

  // Restore local draft on mount if available
  useEffect(() => {
    if (!isOpen) return;
    try {
      const saved = localStorage.getItem(DRAFT_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.selectedCrop && !selectedCrop) setSelectedCrop(parsed.selectedCrop);
        if (parsed.otherCropName) setOtherCropName(parsed.otherCropName);
        if (parsed.selectedChips) setSelectedChips(parsed.selectedChips);
        if (parsed.additionalNotes && !additionalNotes) setAdditionalNotes(parsed.additionalNotes);
        if (parsed.fieldFraction) setFieldFraction(parsed.fieldFraction);
        if (parsed.spreadSpeed) setSpreadSpeed(parsed.spreadSpeed);
        if (parsed.rainPastWeek) setRainPastWeek(parsed.rainPastWeek);
        if (parsed.chemicalsUsed) setChemicalsUsed(parsed.chemicalsUsed);
        if (parsed.cropStage) setCropStage(parsed.cropStage);
        if (parsed.dateFirstNoticed) setDateFirstNoticed(parsed.dateFirstNoticed);
        if (parsed.subCounty) setSubCounty(parsed.subCounty);
        if (parsed.ward) setWard(parsed.ward);
        if (parsed.village) setVillage(parsed.village);
      }
    } catch {
      // Ignore parse error
    }
  }, [isOpen]);

  // Save draft locally on changes
  useEffect(() => {
    if (!isOpen) return;
    try {
      const draft = {
        selectedCrop,
        otherCropName,
        selectedChips,
        additionalNotes,
        fieldFraction,
        spreadSpeed,
        rainPastWeek,
        chemicalsUsed,
        cropStage,
        dateFirstNoticed,
        subCounty,
        ward,
        village,
      };
      localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    } catch {
      // Ignore quota error
    }
  }, [
    isOpen,
    selectedCrop,
    otherCropName,
    selectedChips,
    additionalNotes,
    fieldFraction,
    spreadSpeed,
    rainPastWeek,
    chemicalsUsed,
    cropStage,
    dateFirstNoticed,
    subCounty,
    ward,
    village,
  ]);

  if (!isOpen) return null;

  // Matching alerts banner for farmer's crop and sub-county
  const matchingAlerts = alerts.filter((a) => {
    if (!a.active) return false;
    const matchCrop = selectedCrop && a.crop.toLowerCase().includes(selectedCrop.toLowerCase());
    const matchLocation = subCounty && (a.allMachakos || a.subCounty === subCounty || (a.subCounties && a.subCounties.includes(subCounty)));
    return matchCrop || matchLocation;
  });

  // Photo compression helper: max 1024px, quality 0.6-0.7 (~150 KB target).
  // Strictly rejects any photo that is still over 400 KB after compression.
  const compressImageFile = async (
    rawFile: File
  ): Promise<{ blob: Blob; sizeKb: number; dataUrl: string; sizeBytes: number }> => {
    let fileToProcess = rawFile;

    // Convert HEIC if needed
    if (rawFile.type.includes('heic') || rawFile.name.toLowerCase().endsWith('.heic')) {
      try {
        const converted = await heic2any({ blob: rawFile, toType: 'image/jpeg', quality: 0.8 });
        const blobResult = Array.isArray(converted) ? converted[0] : converted;
        fileToProcess = new File([blobResult], rawFile.name.replace(/\.heic$/i, '.jpg'), { type: 'image/jpeg' });
      } catch (err) {
        console.warn('HEIC conversion fallback:', err);
      }
    }

    return new Promise((resolve, reject) => {
      const img = new Image();
      img.src = URL.createObjectURL(fileToProcess);
      img.onload = () => {
        URL.revokeObjectURL(img.src);
        const maxDim = 1024;
        let width = img.width;
        let height = img.height;

        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas context unavailable'));
          return;
        }

        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        // Quality 0.6-0.7 targeting ~150 KB
        let quality = 0.66;
        let dataUrl = canvas.toDataURL('image/jpeg', quality);
        const head = 'data:image/jpeg;base64,';
        let sizeBytes = Math.round(((dataUrl.length - head.length) * 3) / 4);
        let sizeKb = Math.round(sizeBytes / 1024);

        if (sizeKb > 250) {
          quality = 0.60;
          dataUrl = canvas.toDataURL('image/jpeg', quality);
          sizeBytes = Math.round(((dataUrl.length - head.length) * 3) / 4);
          sizeKb = Math.round(sizeBytes / 1024);
        }

        // Strict rejection if still over 400 KB
        if (sizeKb > 400) {
          reject(
            new Error(
              language === 'sw'
                ? `Picha hii ina ukubwa wa ${sizeKb} KB baada ya mgandamizo, ikizidi kikomo cha 400 KB. Tafadhali chagua picha nyingine iliyo karibu na mmea.`
                : `Photo is ${sizeKb} KB after compression, exceeding the 400 KB limit. Please choose a closer photo with less background clutter.`
            )
          );
          return;
        }

        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve({ blob, sizeKb, dataUrl, sizeBytes });
            } else {
              reject(new Error('Compression failed'));
            }
          },
          'image/jpeg',
          quality
        );
      };
      img.onerror = () => reject(new Error('Image decode error'));
    });
  };

  const handleSlotFileSelected = async (slotId: string, file: File) => {
    setPhotoError(null);
    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'];
    const isHeic = file.name.toLowerCase().endsWith('.heic');

    if (!validTypes.includes(file.type) && !isHeic) {
      setPhotoError(t('photoFormatError'));
      return;
    }

    try {
      const { blob, sizeKb, dataUrl, sizeBytes } = await compressImageFile(file);
      const blobUrl = URL.createObjectURL(blob);
      const compressedFile = new File([blob], `${slotId}.jpg`, { type: 'image/jpeg' });

      setPhotoSlots((prev) => ({
        ...prev,
        [slotId]: {
          file: compressedFile,
          blobUrl,
          dataUrl,
          sizeBytes,
          fileSizeKb: sizeKb,
          uploading: false,
          progress: 100,
        },
      }));
    } catch (err: any) {
      console.error('Photo processing error:', err);
      setPhotoError(err?.message || 'Could not process this image. Please choose another photo.');
    }
  };

  const handleRemoveSlot = (slotId: string) => {
    setPhotoSlots((prev) => {
      const copy = { ...prev };
      if (copy[slotId]?.blobUrl) {
        URL.revokeObjectURL(copy[slotId].blobUrl!);
      }
      delete copy[slotId];
      return copy;
    });
  };

  // Voice recognition via Web Speech API (en-KE / sw-KE)
  const handleToggleVoiceInput = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert(t('voiceNotSupported'));
      return;
    }

    if (isListeningVoice) {
      setIsListeningVoice(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = language === 'sw' ? 'sw-KE' : 'en-KE';
      recognition.continuous = false;
      recognition.interimResults = false;

      recognition.onstart = () => setIsListeningVoice(true);
      recognition.onend = () => setIsListeningVoice(false);
      recognition.onerror = () => setIsListeningVoice(false);

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setAdditionalNotes((prev) => (prev ? `${prev} ${transcript}` : transcript));
        setIsListeningVoice(false);
      };

      recognition.start();
    } catch (err) {
      console.warn('Speech recognition error:', err);
      setIsListeningVoice(false);
    }
  };

  // GPS detection
  const handleDetectLocation = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser.');
      return;
    }
    setDetectingGps(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGpsCoords({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        });
        setDetectingGps(false);
      },
      (err) => {
        console.warn('GPS location error:', err);
        setDetectingGps(false);
        alert('Could not access GPS location. Please select your sub-county and ward manually.');
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  };

  // Step Validation
  const canProceedStep1 = selectedCrop.trim() !== '' && (selectedCrop !== 'Other' || otherCropName.trim() !== '');
  const uploadedPhotosCount = Object.keys(photoSlots).length;
  const canProceedStep2 = uploadedPhotosCount >= 1;
  const canProceedStep3 = (selectedChips.length > 0 || additionalNotes.trim() !== '') && dateFirstNoticed <= todayStr;
  const canProceedStep4 = subCounty.trim() !== '' && isValidKenyanPhone(phone);

  const handleNext = () => {
    if (step === 1 && !canProceedStep1) return;
    if (step === 2 && !canProceedStep2) {
      setPhotoError(t('atLeastOnePhoto'));
      return;
    }
    if (step === 3 && !canProceedStep3) return;
    if (step === 4 && !canProceedStep4) return;
    setStep((prev) => Math.min(prev + 1, 5));
  };

  const handleBack = () => {
    setStep((prev) => Math.max(prev - 1, 1));
  };

  // Final Submission to Firebase (Photo Subcollection & Firestore)
  const handleSubmitCase = async () => {
    if (!currentUser || !consentAccepted || submitting) return;
    setSubmitting(true);
    setSubmitError(null);

    // Timeout safety: 25 seconds
    let timeoutId: any;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => {
        reject(
          new Error(
            language === 'sw'
              ? 'Muda wa kutuma umekwisha (sekunde 25). Tafadhali hakikisha mtandao wako na ubonyeze tena.'
              : 'Case submission timed out (25s). Please check your internet connection and try again.'
          )
        );
      }, 25000);
    });

    try {
      await Promise.race([
        (async () => {
          const existingIds: string[] = [];
          const { id: caseId, ref: caseRef } = await generateUniqueCaseId(db, existingIds);

          const photoPayloads: CasePhotoPayload[] = Object.entries(photoSlots)
            .filter(([_, slotData]) => slotData.dataUrl)
            .map(([slotId, slotData]) => ({
              slot: slotId,
              dataUrl: slotData.dataUrl!,
              sizeBytes: slotData.sizeBytes || (slotData.fileSizeKb || 0) * 1024,
              file: slotData.file,
            }));

          const slotNames = photoPayloads.map((p) => p.slot);

          const effectiveCrop = selectedCrop === 'Other' ? otherCropName.trim() : selectedCrop;
          const effectiveSymptoms = [
            selectedChips.length > 0 ? `Observed symptoms: ${selectedChips.join(', ')}.` : '',
            additionalNotes.trim() ? `Additional notes: ${additionalNotes.trim()}` : '',
            `Field affected: ${fieldFraction}. Spread rate: ${spreadSpeed}. Recent rain: ${rainPastWeek}. Crop stage: ${cropStage}. Chemicals used: ${chemicalsUsed || 'None'}.`,
          ]
            .filter(Boolean)
            .join(' ');

          const formattedPhone = formatKenyanPhone(phone);

          // Main case document: store ONLY photoCount and slotNames.
          // NEVER put photos or base64 strings inside the main case document.
          const caseData: CaseItem = {
            id: caseId,
            farmerId: currentUser.uid,
            farmerName: profile?.fullName || currentUser.email?.split('@')[0] || 'Farmer',
            farmerPhone: formattedPhone,
            crop: effectiveCrop,
            symptomsDescription: effectiveSymptoms,
            dateFirstNoticed,
            subCounty,
            ward,
            village: village.trim() || undefined,
            photoCount: slotNames.length,
            slotNames: slotNames,
            photoUrls: [], // Photos are stored in subcollection, not in main doc
            symptomChips: selectedChips,
            fieldFraction,
            spreadSpeed,
            rainPastWeek,
            chemicalsUsed: chemicalsUsed.trim() || undefined,
            cropStage,
            gpsCoords: gpsCoords || undefined,
            status: 'Submitted',
            createdAt: new Date().toISOString(),
          };

          // 1. Write the main case document
          await setDoc(caseRef, caseData);

          // 2. Save each photo in subcollection cases/{caseId}/photos/{slotName} via unified saveCasePhotos
          await saveCasePhotos(caseId, photoPayloads);

          // 3. Clean draft
          try {
            localStorage.removeItem(DRAFT_KEY);
          } catch {}

          setSubmittedCaseId(caseId);
        })(),
        timeoutPromise,
      ]);
    } catch (err: any) {
      console.error('Case submission error:', err);
      const msg =
        err?.message ||
        (language === 'sw'
          ? 'Hitilafu imetokea wakati wa kutuma. Maelezo yako yamehifadhiwa, tafadhali jaribu tena.'
          : 'Network transmission failed. Your inputs have been saved locally. Please try again.');
      setSubmitError(msg);
    } finally {
      clearTimeout(timeoutId);
      setSubmitting(false);
    }
  };

  const selectedSubCountyWards = MACHAKOS_SUB_COUNTIES.find((s) => s.name === subCounty)?.wards || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
      {/* Full-screen on mobile, wide centered modal on desktop */}
      <div className="bg-[#FBFAF5] w-full h-full sm:h-auto sm:max-h-[92vh] sm:max-w-2xl rounded-none sm:rounded-3xl border border-[#E7E2D5] shadow-2xl flex flex-col overflow-hidden animate-in fade-in duration-200">
        {/* Top Header & Progress Bar */}
        <div className="bg-[#FBFAF5] border-b border-[#E7E2D5] px-4 sm:px-6 pt-4 pb-3 shrink-0">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-full bg-[#0F4A2F] text-white flex items-center justify-center font-bold">
                <Sprout className="w-5 h-5 text-[#2BC55B]" />
              </div>
              <div>
                <h3 className="font-heading font-black text-base text-[#0F4A2F] leading-tight">
                  {t('submitCaseTitle')}
                </h3>
                <p className="text-[11px] text-[#52665C]">CropCare Centre, Machakos</p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="w-10 h-10 rounded-full flex items-center justify-center text-[#52665C] hover:bg-[#EAE5D9] hover:text-[#0F4A2F]"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Progress Bar (5 Steps) */}
          {!submittedCaseId && (
            <div>
              <div className="flex items-center justify-between text-xs font-bold text-[#0F4A2F] mb-1.5">
                <span>
                  {t('stepLabel')} {step} {t('ofLabel')} 5
                </span>
                <span className="text-[#687C73] font-medium">
                  {step === 1 && (language === 'sw' ? 'Chagua Zao' : 'Select Crop')}
                  {step === 2 && (language === 'sw' ? 'Piga Picha' : 'Upload Photos')}
                  {step === 3 && (language === 'sw' ? 'Eleza Dalili' : 'Symptoms')}
                  {step === 4 && (language === 'sw' ? 'Eneo na Mawasiliano' : 'Location & Contact')}
                  {step === 5 && (language === 'sw' ? 'Hakiki na Wasilisha' : 'Review & Submit')}
                </span>
              </div>
              <div className="w-full bg-[#EAE5D9] h-2 rounded-full overflow-hidden">
                <div
                  className="bg-[#2BC55B] h-full transition-all duration-300 rounded-full"
                  style={{ width: `${(step / 5) * 100}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Scrollable Step Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
          {/* Active Outbreak Banner if matching */}
          {matchingAlerts.length > 0 && !submittedCaseId && (
            <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-300 text-amber-950 text-xs flex items-start gap-2.5 shadow-2xs">
              <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold block mb-0.5">{t('activeAlertsBannerTitle')}</span>
                <p className="text-amber-900 leading-relaxed">
                  {matchingAlerts[0].title}: {matchingAlerts[0].summary}
                </p>
              </div>
            </div>
          )}

          {/* Success Screen */}
          {submittedCaseId ? (
            <div className="text-center py-6 sm:py-8 space-y-4">
              <div className="w-16 h-16 rounded-full bg-[#DCFCE7] text-[#166534] border border-[#86EFAC] flex items-center justify-center mx-auto mb-2 shadow-sm">
                <CheckCircle2 className="w-9 h-9" />
              </div>

              <h3 className="font-heading font-black text-2xl text-[#0F4A2F]">
                {t('caseSubmittedSuccess')}
              </h3>

              <div className="p-4 rounded-2xl bg-[#FBFAF5] border border-[#E7E2D5] max-w-sm mx-auto shadow-xs">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#687C73] block mb-1">
                  {t('caseIdDisplay')}
                </span>
                <span className="font-mono font-bold text-lg text-[#0F4A2F] selection:bg-[#2BC55B]/30 select-all">
                  {submittedCaseId}
                </span>
              </div>

              <div className="p-5 rounded-3xl bg-white border border-[#E7E2D5] max-w-md mx-auto text-left space-y-2.5">
                <h4 className="font-heading font-black text-sm text-[#0F4A2F]">
                  {t('whatHappensNextTitle')}
                </h4>
                <div className="space-y-2 text-xs text-[#2B3A33] leading-relaxed">
                  <div className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-[#2BC55B] shrink-0 mt-0.5" />
                    <span>{t('whatHappensNextStep1')}</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-[#2BC55B] shrink-0 mt-0.5" />
                    <span>{t('whatHappensNextStep2')}</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-[#2BC55B] shrink-0 mt-0.5" />
                    <span>{t('whatHappensNextStep3')}</span>
                  </div>
                </div>
              </div>

              <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-3">
                <button
                  onClick={() => {
                    onSuccess(submittedCaseId);
                    onClose();
                  }}
                  className="min-h-[48px] w-full sm:w-auto px-6 py-3 rounded-full bg-[#0F4A2F] text-white font-bold text-xs shadow-sm hover:bg-[#155e3c] transition-all"
                >
                  {t('trackCaseBtn')}
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* STEP 1: CROP TILES */}
              {step === 1 && (
                <div className="space-y-4">
                  <div>
                    <h4 className="font-heading font-black text-xl text-[#0F4A2F]">
                      {t('step1CropTitle')}
                    </h4>
                    <p className="text-xs text-[#52665C] mt-0.5">
                      {t('step1CropSubtitle')}
                    </p>
                  </div>

                  {/* Large Tappable Crop Tiles (Nothing selected by default) */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {CROP_OPTIONS.map((c) => {
                      const selected = selectedCrop === c.id;
                      return (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => setSelectedCrop(c.id)}
                          className={`min-h-[64px] p-4 rounded-2xl border text-left flex items-center justify-between gap-3 transition-all cursor-pointer ${
                            selected
                              ? 'bg-[#DCFCE7]/70 border-[#2BC55B] text-[#0F4A2F] shadow-sm font-bold ring-2 ring-[#2BC55B]'
                              : 'bg-white border-[#E7E2D5] text-[#2B3A33] hover:border-[#2BC55B]/50 hover:bg-[#FBFAF5]'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div
                              className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                                selected ? 'bg-[#2BC55B] text-white' : 'bg-[#EAE5D9] text-[#0F4A2F]'
                              }`}
                            >
                              <Sprout className="w-4 h-4" />
                            </div>
                            <span className="text-xs font-semibold leading-tight truncate">
                              {language === 'sw' ? c.sw : c.en}
                            </span>
                          </div>
                          {selected && <Check className="w-4 h-4 text-[#166534] shrink-0" />}
                        </button>
                      );
                    })}
                  </div>

                  {selectedCrop === 'Other' && (
                    <div className="mt-3 p-4 rounded-2xl bg-white border border-[#E7E2D5]">
                      <label className="block text-xs font-bold text-[#0F4A2F] mb-1">
                        {language === 'sw' ? 'Taja jina la zao lako *' : 'Specify crop name *'}
                      </label>
                      <input
                        type="text"
                        value={otherCropName}
                        onChange={(e) => setOtherCropName(e.target.value)}
                        placeholder="e.g. Passion fruit, Watermelon, Onions"
                        className="w-full min-h-[48px] bg-[#FBFAF5] border border-[#D5CFC0] rounded-xl px-3.5 py-2 text-sm text-[#2B3A33] focus:outline-none focus:ring-2 focus:ring-[#2BC55B]"
                      />
                    </div>
                  )}
                </div>
              )}

              {/* STEP 2: GUIDED PHOTOS (4 Labelled Slots) */}
              {step === 2 && (
                <div className="space-y-4">
                  <div>
                    <h4 className="font-heading font-black text-xl text-[#0F4A2F]">
                      {t('step2PhotosTitle')}
                    </h4>
                    <p className="text-xs text-[#52665C] mt-0.5">
                      {t('step2PhotosSubtitle')}
                    </p>
                  </div>

                  {photoError && (
                    <div className="p-3 rounded-2xl bg-[#FEE2E2] border border-[#FCA5A5] text-[#991B1B] text-xs font-medium flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>{photoError}</span>
                    </div>
                  )}

                  {/* 4 Labelled Slots */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    {PHOTO_SLOTS.map((slot) => {
                      const slotData = photoSlots[slot.id];
                      const title = language === 'sw' ? slot.titleSw : slot.titleEn;
                      return (
                        <div
                          key={slot.id}
                          className="bg-white rounded-2xl border border-[#E7E2D5] p-3.5 shadow-2xs flex flex-col justify-between"
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-bold text-[#0F4A2F]">
                              {title}
                            </span>
                            {slotData && (
                              <span className="text-[10px] font-semibold text-[#166534] bg-[#DCFCE7] px-2 py-0.5 rounded-full">
                                ~{slotData.fileSizeKb} KB
                              </span>
                            )}
                          </div>

                          {slotData?.blobUrl ? (
                            <div className="relative aspect-video rounded-xl overflow-hidden bg-neutral-100 border border-[#E7E2D5] mb-2">
                              <img
                                src={slotData.blobUrl}
                                alt={title}
                                className="w-full h-full object-cover"
                              />
                              <div className="absolute top-2 right-2 flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => handleRemoveSlot(slot.id)}
                                  className="w-8 h-8 rounded-full bg-black/60 text-white hover:bg-black/80 flex items-center justify-center transition-all"
                                  title="Remove"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="aspect-video rounded-xl border border-dashed border-[#D5CFC0] bg-[#FBFAF5] flex flex-col items-center justify-center p-3 text-center mb-2">
                              <Camera className="w-6 h-6 text-[#687C73] mb-1 stroke-[1.5]" />
                              <span className="text-[11px] text-[#687C73] font-medium">
                                {title}
                              </span>
                            </div>
                          )}

                          {/* Upload / Camera Action Buttons */}
                          <div className="flex items-center gap-2 pt-1">
                            {/* Camera capture */}
                            <label className="flex-1 min-h-[44px] px-3 py-2 rounded-xl bg-[#0F4A2F] hover:bg-[#155e3c] text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer shadow-xs transition-all">
                              <Camera className="w-3.5 h-3.5 text-[#2BC55B]" />
                              <span>{t('cameraCapture')}</span>
                              <input
                                type="file"
                                accept="image/*"
                                capture="environment"
                                onChange={(e) => {
                                  if (e.target.files && e.target.files[0]) {
                                    handleSlotFileSelected(slot.id, e.target.files[0]);
                                  }
                                }}
                                className="hidden"
                              />
                            </label>

                            {/* Gallery upload */}
                            <label className="min-h-[44px] px-3 py-2 rounded-xl bg-[#EAE5D9] hover:bg-[#DDD7C8] text-[#0F4A2F] text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition-all">
                              <Upload className="w-3.5 h-3.5 text-[#0F4A2F]" />
                              <span className="hidden sm:inline">{t('galleryUpload')}</span>
                              <input
                                type="file"
                                accept="image/*,.heic"
                                onChange={(e) => {
                                  if (e.target.files && e.target.files[0]) {
                                    handleSlotFileSelected(slot.id, e.target.files[0]);
                                  }
                                }}
                                className="hidden"
                              />
                            </label>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Tips Box */}
                  <div className="p-4 rounded-2xl bg-[#DCFCE7]/50 border border-[#86EFAC]/70 text-xs text-[#166534] space-y-1.5">
                    <div className="flex items-center gap-1.5 font-bold">
                      <HelpCircle className="w-4 h-4 text-[#166534]" />
                      <span>{t('photoTipsHeading')}</span>
                    </div>
                    <ul className="list-disc pl-5 space-y-1 text-[11px] text-[#2B3A33]/90">
                      <li>{t('photoTip1')}</li>
                      <li>{t('photoTip2')}</li>
                      <li>{t('photoTip3')}</li>
                      <li>{t('photoTip4')}</li>
                    </ul>
                  </div>
                </div>
              )}

              {/* STEP 3: SYMPTOMS & RAPID ASSESSMENT */}
              {step === 3 && (
                <div className="space-y-4">
                  <div>
                    <h4 className="font-heading font-black text-xl text-[#0F4A2F]">
                      {t('step3SymptomsTitle')}
                    </h4>
                    <p className="text-xs text-[#52665C] mt-0.5">
                      {t('step3SymptomsSubtitle')}
                    </p>
                  </div>

                  {/* Tappable Symptom Chips */}
                  <div>
                    <label className="block text-xs font-bold text-[#0F4A2F] mb-2">
                      {t('commonSymptomsHeading')}
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {SYMPTOM_CHIPS.map((chip) => {
                        const active = selectedChips.includes(chip.id);
                        return (
                          <button
                            key={chip.id}
                            type="button"
                            onClick={() => {
                              setSelectedChips((prev) =>
                                active ? prev.filter((c) => c !== chip.id) : [...prev, chip.id]
                              );
                            }}
                            className={`min-h-[44px] px-3.5 py-2 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                              active
                                ? 'bg-[#2BC55B] text-[#0F4A2F] shadow-sm'
                                : 'bg-white border border-[#E7E2D5] text-[#2B3A33] hover:bg-[#EAE5D9]'
                            }`}
                          >
                            {active && <Check className="w-3.5 h-3.5 text-[#0F4A2F]" />}
                            <span>{language === 'sw' ? chip.sw : chip.en}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Microphone voice button & Text box */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-bold text-[#0F4A2F]">
                        {t('additionalNotesLabel')}
                      </label>

                      {/* Microphone Voice Input */}
                      <button
                        type="button"
                        onClick={handleToggleVoiceInput}
                        className={`min-h-[36px] px-3 rounded-full text-xs font-bold flex items-center gap-1.5 transition-all ${
                          isListeningVoice
                            ? 'bg-rose-500 text-white animate-pulse'
                            : 'bg-[#EAE5D9] text-[#0F4A2F] hover:bg-[#DDD7C8]'
                        }`}
                      >
                        {isListeningVoice ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
                        <span>{isListeningVoice ? t('listeningVoice') : t('voiceInputBtn')}</span>
                      </button>
                    </div>

                    <textarea
                      rows={2}
                      value={additionalNotes}
                      onChange={(e) => setAdditionalNotes(e.target.value)}
                      placeholder={t('additionalNotesPlaceholder')}
                      className="w-full bg-white border border-[#D5CFC0] rounded-2xl p-3 text-xs sm:text-sm text-[#2B3A33] focus:outline-none focus:ring-2 focus:ring-[#2BC55B]"
                    />
                  </div>

                  {/* Quick Questions */}
                  <div className="p-4 rounded-2xl bg-white border border-[#E7E2D5] space-y-3">
                    <h5 className="font-heading font-black text-xs text-[#0F4A2F] uppercase tracking-wider">
                      {t('quickQuestionsTitle')}
                    </h5>

                    {/* How much affected */}
                    <div>
                      <span className="block text-xs font-semibold text-[#2B3A33] mb-1">
                        {t('fieldFractionLabel')}
                      </span>
                      <div className="grid grid-cols-3 gap-2">
                        {[
                          { id: 'few', label: t('fractionFew') },
                          { id: 'half', label: t('fractionHalf') },
                          { id: 'most', label: t('fractionMost') },
                        ].map((opt) => (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => setFieldFraction(opt.id)}
                            className={`min-h-[44px] px-2 py-1.5 rounded-xl text-xs font-semibold text-center transition-all ${
                              fieldFraction === opt.id
                                ? 'bg-[#0F4A2F] text-white shadow-xs'
                                : 'bg-[#FBFAF5] border border-[#E7E2D5] text-[#2B3A33] hover:bg-[#EAE5D9]'
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* How fast spreading & Rain */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <span className="block text-xs font-semibold text-[#2B3A33] mb-1">
                          {t('spreadSpeedLabel')}
                        </span>
                        <div className="grid grid-cols-2 gap-2">
                          {[
                            { id: 'slowly', label: t('speedSlowly') },
                            { id: 'quickly', label: t('speedQuickly') },
                          ].map((opt) => (
                            <button
                              key={opt.id}
                              type="button"
                              onClick={() => setSpreadSpeed(opt.id)}
                              className={`min-h-[44px] px-2 py-1 rounded-xl text-xs font-semibold text-center transition-all ${
                                spreadSpeed === opt.id
                                  ? 'bg-[#0F4A2F] text-white shadow-xs'
                                  : 'bg-[#FBFAF5] border border-[#E7E2D5] text-[#2B3A33] hover:bg-[#EAE5D9]'
                              }`}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <span className="block text-xs font-semibold text-[#2B3A33] mb-1">
                          {t('rainPastWeekLabel')}
                        </span>
                        <div className="grid grid-cols-2 gap-2">
                          {[
                            { id: 'yes', label: t('yesOption') },
                            { id: 'no', label: t('noOption') },
                          ].map((opt) => (
                            <button
                              key={opt.id}
                              type="button"
                              onClick={() => setRainPastWeek(opt.id)}
                              className={`min-h-[44px] px-2 py-1 rounded-xl text-xs font-semibold text-center transition-all ${
                                rainPastWeek === opt.id
                                  ? 'bg-[#0F4A2F] text-white shadow-xs'
                                  : 'bg-[#FBFAF5] border border-[#E7E2D5] text-[#2B3A33] hover:bg-[#EAE5D9]'
                              }`}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Crop Stage & Chemicals used */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <span className="block text-xs font-semibold text-[#2B3A33] mb-1">
                          {t('cropStageLabel')}
                        </span>
                        <select
                          value={cropStage}
                          onChange={(e) => setCropStage(e.target.value)}
                          className="w-full min-h-[44px] bg-[#FBFAF5] border border-[#D5CFC0] rounded-xl px-3 py-2 text-xs text-[#2B3A33]"
                        >
                          <option value="seedling">{t('stageSeedling')}</option>
                          <option value="growing">{t('stageGrowing')}</option>
                          <option value="flowering">{t('stageFlowering')}</option>
                          <option value="harvest">{t('stageHarvest')}</option>
                        </select>
                      </div>

                      <div>
                        <span className="block text-xs font-semibold text-[#2B3A33] mb-1">
                          {t('chemicalsUsedLabel')}
                        </span>
                        <input
                          type="text"
                          value={chemicalsUsed}
                          onChange={(e) => setChemicalsUsed(e.target.value)}
                          placeholder={t('chemicalsPlaceholder')}
                          className="w-full min-h-[44px] bg-[#FBFAF5] border border-[#D5CFC0] rounded-xl px-3 py-2 text-xs text-[#2B3A33]"
                        />
                      </div>
                    </div>

                    {/* Date First Noticed */}
                    <div>
                      <span className="block text-xs font-semibold text-[#2B3A33] mb-1">
                        {t('dateNoticedLabel')} ({t('dateNoticedHelp')})
                      </span>
                      <input
                        type="date"
                        max={todayStr}
                        value={dateFirstNoticed}
                        onChange={(e) => setDateFirstNoticed(e.target.value)}
                        className="w-full min-h-[44px] bg-[#FBFAF5] border border-[#D5CFC0] rounded-xl px-3 py-2 text-xs text-[#2B3A33]"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 4: LOCATION & CONTACT */}
              {step === 4 && (
                <div className="space-y-4">
                  <div>
                    <h4 className="font-heading font-black text-xl text-[#0F4A2F]">
                      {t('step4LocationTitle')}
                    </h4>
                    <p className="text-xs text-[#52665C] mt-0.5">
                      {t('step4LocationSubtitle')}
                    </p>
                  </div>

                  <div className="space-y-3.5">
                    {/* Sub-county dropdown with placeholder */}
                    <div>
                      <label className="block text-xs font-bold text-[#0F4A2F] mb-1">
                        {t('subCountyLabel')} *
                      </label>
                      <select
                        value={subCounty}
                        onChange={(e) => {
                          setSubCounty(e.target.value);
                          setWard('');
                        }}
                        required
                        className="w-full min-h-[48px] bg-white border border-[#D5CFC0] rounded-2xl px-3.5 py-2.5 text-xs sm:text-sm text-[#2B3A33] focus:outline-none focus:ring-2 focus:ring-[#2BC55B]"
                      >
                        <option value="" disabled>
                          -- Select Sub-County --
                        </option>
                        {MACHAKOS_SUB_COUNTIES.map((sc) => (
                          <option key={sc.name} value={sc.name}>
                            {sc.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Ward dropdown with placeholder */}
                    <div>
                      <label className="block text-xs font-bold text-[#0F4A2F] mb-1">
                        {t('wardLabel')}
                      </label>
                      <select
                        value={ward}
                        onChange={(e) => setWard(e.target.value)}
                        disabled={!subCounty}
                        className="w-full min-h-[48px] bg-white border border-[#D5CFC0] rounded-2xl px-3.5 py-2.5 text-xs sm:text-sm text-[#2B3A33] focus:outline-none focus:ring-2 focus:ring-[#2BC55B] disabled:opacity-50"
                      >
                        <option value="" disabled>
                          -- Select Ward --
                        </option>
                        {selectedSubCountyWards.map((w) => (
                          <option key={w} value={w}>
                            {w}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Village text field */}
                    <div>
                      <label className="block text-xs font-bold text-[#0F4A2F] mb-1">
                        {t('villageLabel')}
                      </label>
                      <input
                        type="text"
                        value={village}
                        onChange={(e) => setVillage(e.target.value)}
                        placeholder={t('villagePlaceholder')}
                        className="w-full min-h-[48px] bg-white border border-[#D5CFC0] rounded-2xl px-3.5 py-2.5 text-xs sm:text-sm text-[#2B3A33] focus:outline-none focus:ring-2 focus:ring-[#2BC55B]"
                      />
                    </div>

                    {/* GPS button */}
                    <div>
                      <button
                        type="button"
                        onClick={handleDetectLocation}
                        disabled={detectingGps}
                        className="min-h-[48px] px-4 py-2.5 rounded-full bg-[#EAE5D9] hover:bg-[#DDD7C8] text-[#0F4A2F] text-xs font-bold flex items-center gap-2 transition-all"
                      >
                        <MapPin className="w-4 h-4 text-[#2BC55B]" />
                        <span>
                          {detectingGps
                            ? t('fetchingLocation')
                            : gpsCoords
                            ? t('locationDetected')
                            : t('useMyLocationBtn')}
                        </span>
                      </button>
                    </div>

                    {/* Phone number with Kenyan validation */}
                    <div>
                      <label className="block text-xs font-bold text-[#0F4A2F] mb-1">
                        {t('phoneLabel')} *
                      </label>
                      <div className="relative">
                        <Phone className="w-4 h-4 text-[#687C73] absolute left-3.5 top-3.5" />
                        <input
                          type="tel"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          placeholder={t('phonePlaceholder')}
                          required
                          className="w-full min-h-[48px] bg-white border border-[#D5CFC0] rounded-2xl pl-10 pr-3.5 py-2.5 text-xs sm:text-sm text-[#2B3A33] focus:outline-none focus:ring-2 focus:ring-[#2BC55B]"
                        />
                      </div>
                      <p className="text-[11px] text-[#687C73] mt-1">
                        {t('phoneValidationHelp')}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 5: REVIEW & SUBMIT */}
              {step === 5 && (
                <div className="space-y-4">
                  <div>
                    <h4 className="font-heading font-black text-xl text-[#0F4A2F]">
                      {t('step5ReviewTitle')}
                    </h4>
                    <p className="text-xs text-[#52665C] mt-0.5">
                      {t('step5ReviewSubtitle')}
                    </p>
                  </div>

                  {submitError && (
                    <div className="p-3.5 rounded-2xl bg-[#FEE2E2] border border-[#FCA5A5] text-[#991B1B] text-xs font-medium flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>{submitError}</span>
                    </div>
                  )}

                  {/* Summary Card with Edit links */}
                  <div className="space-y-3">
                    {/* Crop */}
                    <div className="p-3.5 rounded-2xl bg-white border border-[#E7E2D5] flex items-center justify-between">
                      <div>
                        <span className="text-[11px] font-bold text-[#687C73] uppercase tracking-wider block">
                          Crop
                        </span>
                        <span className="font-heading font-bold text-sm text-[#0F4A2F]">
                          {selectedCrop === 'Other' ? otherCropName : selectedCrop}
                        </span>
                      </div>
                      <button
                        onClick={() => setStep(1)}
                        className="text-xs font-bold text-[#0F4A2F] hover:underline"
                      >
                        {t('editSection')}
                      </button>
                    </div>

                    {/* Photos */}
                    <div className="p-3.5 rounded-2xl bg-white border border-[#E7E2D5] flex items-center justify-between">
                      <div>
                        <span className="text-[11px] font-bold text-[#687C73] uppercase tracking-wider block">
                          Photos
                        </span>
                        <span className="text-xs font-medium text-[#2B3A33]">
                          {uploadedPhotosCount} guided photos attached
                        </span>
                      </div>
                      <button
                        onClick={() => setStep(2)}
                        className="text-xs font-bold text-[#0F4A2F] hover:underline"
                      >
                        {t('editSection')}
                      </button>
                    </div>

                    {/* Symptoms */}
                    <div className="p-3.5 rounded-2xl bg-white border border-[#E7E2D5] flex items-start justify-between">
                      <div className="pr-4">
                        <span className="text-[11px] font-bold text-[#687C73] uppercase tracking-wider block">
                          Symptoms & Timing
                        </span>
                        <p className="text-xs text-[#2B3A33] mt-0.5 leading-relaxed">
                          {selectedChips.join(', ')} {additionalNotes ? `• ${additionalNotes}` : ''}
                        </p>
                        <p className="text-[11px] text-[#687C73] mt-1">
                          Date noticed: {formatDateKE(dateFirstNoticed)}
                        </p>
                      </div>
                      <button
                        onClick={() => setStep(3)}
                        className="text-xs font-bold text-[#0F4A2F] hover:underline shrink-0"
                      >
                        {t('editSection')}
                      </button>
                    </div>

                    {/* Location & Contact */}
                    <div className="p-3.5 rounded-2xl bg-white border border-[#E7E2D5] flex items-center justify-between">
                      <div>
                        <span className="text-[11px] font-bold text-[#687C73] uppercase tracking-wider block">
                          Location & Contact
                        </span>
                        <span className="text-xs font-medium text-[#2B3A33]">
                          {subCounty}{ward ? `, ${ward}` : ''}{village ? ` (${village})` : ''} • {phone}
                        </span>
                      </div>
                      <button
                        onClick={() => setStep(4)}
                        className="text-xs font-bold text-[#0F4A2F] hover:underline"
                      >
                        {t('editSection')}
                      </button>
                    </div>
                  </div>

                  {/* Consent Checkbox with short privacy note */}
                  <div className="p-4 rounded-2xl bg-[#EAE5D9]/60 border border-[#D5CFC0] space-y-2.5">
                    <div className="flex items-start gap-2.5">
                      <ShieldCheck className="w-4 h-4 text-[#0F4A2F] shrink-0 mt-0.5" />
                      <p className="text-xs text-[#2B3A33] leading-relaxed">
                        {t('consentText')}
                      </p>
                    </div>

                    <label className="flex items-center gap-2.5 cursor-pointer pt-1">
                      <input
                        type="checkbox"
                        checked={consentAccepted}
                        onChange={(e) => setConsentAccepted(e.target.checked)}
                        className="w-4 h-4 text-[#2BC55B] rounded border-[#D5CFC0] focus:ring-[#2BC55B]"
                      />
                      <span className="text-xs font-bold text-[#0F4A2F]">
                        {t('consentCheckboxLabel')}
                      </span>
                    </label>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Bottom Navigation Buttons (Back / Next / Submit) */}
        {!submittedCaseId && (
          <div className="bg-[#FBFAF5] border-t border-[#E7E2D5] px-4 sm:px-6 py-3.5 shrink-0 flex items-center justify-between gap-3">
            {step > 1 ? (
              <button
                type="button"
                onClick={handleBack}
                disabled={submitting}
                className="min-h-[48px] px-5 py-2.5 rounded-full border border-[#D5CFC0] bg-white text-[#2B3A33] hover:bg-[#EAE5D9] text-xs font-bold flex items-center gap-1.5 transition-all"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>{t('backBtn')}</span>
              </button>
            ) : (
              <div />
            )}

            {step < 5 ? (
              <button
                type="button"
                onClick={handleNext}
                className="min-h-[48px] px-6 py-2.5 rounded-full bg-[#0F4A2F] hover:bg-[#155e3c] text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all"
              >
                <span>{t('nextBtn')}</span>
                <ArrowRight className="w-4 h-4 text-[#2BC55B]" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmitCase}
                disabled={!consentAccepted || submitting}
                className="min-h-[48px] px-6 py-2.5 rounded-full bg-[#2BC55B] hover:bg-[#25ad50] text-[#0F4A2F] text-xs font-black flex items-center gap-2 shadow-sm transition-all disabled:opacity-50"
              >
                <span>{submitting ? t('submittingCase') : t('submitCaseBtn')}</span>
                <ArrowRight className="w-4 h-4 stroke-[3]" />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
