import React, { useState, useEffect } from 'react';
import { fetchCasePhotos, CasePhotoRecord } from '../services/casePhotosService';
import { useLanguage } from '../contexts/LanguageContext';
import { Loader2, RefreshCw, ZoomIn, X, Sprout } from 'lucide-react';

interface CasePhotosViewerProps {
  caseId: string;
  fallbackUrls?: string[];
  photoCount?: number;
  slotNames?: string[];
  title?: string;
}

export const CasePhotosViewer: React.FC<CasePhotosViewerProps> = ({
  caseId,
  fallbackUrls = [],
  photoCount,
  slotNames = [],
  title,
}) => {
  const { language } = useLanguage();
  const [photos, setPhotos] = useState<CasePhotoRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedPreview, setSelectedPreview] = useState<CasePhotoRecord | null>(null);

  const getSlotLabel = (slot: string): string => {
    switch (slot) {
      case 'whole_plant':
        return language === 'sw' ? 'Mmea Wote' : 'Whole Plant';
      case 'close_up':
        return language === 'sw' ? 'Sehemu Iliyoathirika' : 'Close-up';
      case 'stem_roots':
        return language === 'sw' ? 'Shina au Mizizi' : 'Stem or Roots';
      case 'field_view':
        return language === 'sw' ? 'Mtazamo wa Shamba' : 'Field View';
      default:
        return slot.replace(/_/g, ' ');
    }
  };

  const loadPhotos = async () => {
    // If fallbackUrls is provided with items, use them immediately
    if (fallbackUrls && fallbackUrls.length > 0) {
      setPhotos(
        fallbackUrls.map((url, i) => ({
          id: `legacy_${i}`,
          slot: slotNames[i] || `photo_${i + 1}`,
          dataUrl: url,
          size: 0,
          createdAt: '',
        }))
      );
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const records = await fetchCasePhotos(caseId);
      setPhotos(records);
    } catch (err) {
      console.error('Error loading case photos:', err);
      setError(
        language === 'sw'
          ? 'Imeshindwa kupakia picha za kesi. Tafadhali jaribu tena.'
          : 'Could not load case photos from database.'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPhotos();
  }, [caseId]);

  const defaultHeading = language === 'sw' ? 'Picha za Kesi ya Magonjwa' : 'Crop Symptom Photos';

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between">
        <h4 className="font-heading font-black text-xs uppercase tracking-wider text-[#0F4A2F]">
          {title || defaultHeading}
          {photos.length > 0 && (
            <span className="ml-1.5 font-normal text-[#687C73]">
              ({photos.length})
            </span>
          )}
        </h4>

        {error && (
          <button
            type="button"
            onClick={loadPhotos}
            className="text-xs font-bold text-[#0F4A2F] hover:underline inline-flex items-center gap-1"
          >
            <RefreshCw className="w-3 h-3" />
            <span>{language === 'sw' ? 'Jaribu Tena' : 'Retry'}</span>
          </button>
        )}
      </div>

      {loading && (
        <div className="p-6 rounded-2xl bg-[#FBFAF5] border border-[#E7E2D5] flex items-center justify-center gap-2 text-xs text-[#52665C]">
          <Loader2 className="w-4 h-4 animate-spin text-[#0F4A2F]" />
          <span>{language === 'sw' ? 'Inapakia picha za kesi...' : 'Loading case photos...'}</span>
        </div>
      )}

      {error && !loading && (
        <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-center justify-between">
          <span>{error}</span>
          <button
            type="button"
            onClick={loadPhotos}
            className="px-2.5 py-1 rounded-lg bg-amber-100 hover:bg-amber-200 font-bold"
          >
            Retry
          </button>
        </div>
      )}

      {!loading && !error && photos.length === 0 && (
        <div className="p-6 rounded-2xl bg-[#FBFAF5] border border-dashed border-[#D5CFC0] text-center">
          <Sprout className="w-6 h-6 text-[#687C73] mx-auto mb-1.5 opacity-60" />
          <p className="text-xs text-[#687C73]">
            {language === 'sw'
              ? 'Hakuna picha zilizopakiwa kwa kesi hii.'
              : 'No photos were attached to this case.'}
          </p>
        </div>
      )}

      {!loading && photos.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {photos.map((photo) => {
            const sizeKb = photo.size > 0 ? Math.round(photo.size / 1024) : null;

            return (
              <div
                key={photo.id || photo.slot}
                onClick={() => setSelectedPreview(photo)}
                className="group relative aspect-square rounded-2xl overflow-hidden border border-[#E7E2D5] bg-stone-100 cursor-pointer shadow-2xs hover:shadow-md transition-all hover:scale-[1.02]"
              >
                <img
                  src={photo.dataUrl}
                  alt={getSlotLabel(photo.slot)}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />

                {/* Slot Label Badge */}
                <div className="absolute top-1.5 left-1.5 right-1.5 flex items-center justify-between gap-1 pointer-events-none">
                  <span className="px-2 py-0.5 rounded-md bg-[#0F4A2F]/85 backdrop-blur-xs text-white text-[10px] font-bold capitalize truncate">
                    {getSlotLabel(photo.slot)}
                  </span>
                  {sizeKb && (
                    <span className="px-1.5 py-0.5 rounded-md bg-black/60 backdrop-blur-xs text-stone-200 text-[9px] font-mono shrink-0">
                      {sizeKb} KB
                    </span>
                  )}
                </div>

                {/* Hover Zoom overlay */}
                <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <div className="w-8 h-8 rounded-full bg-white/90 text-[#0F4A2F] flex items-center justify-center shadow-sm">
                    <ZoomIn className="w-4 h-4" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Full Resolution Preview Lightbox */}
      {selectedPreview && (
        <div
          className="fixed inset-0 z-60 bg-black/85 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-150"
          onClick={() => setSelectedPreview(null)}
        >
          <div
            className="relative max-w-4xl max-h-[90vh] bg-[#FBFAF5] rounded-3xl p-3 sm:p-4 shadow-2xl border border-white/20 flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-2.5 px-2 border-b border-[#E7E2D5] mb-2 shrink-0">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full bg-[#0F4A2F] text-white text-xs font-bold capitalize">
                  {getSlotLabel(selectedPreview.slot)}
                </span>
                {selectedPreview.size > 0 && (
                  <span className="text-xs text-[#52665C] font-mono">
                    {Math.round(selectedPreview.size / 1024)} KB
                  </span>
                )}
              </div>

              <button
                type="button"
                onClick={() => setSelectedPreview(null)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-[#52665C] hover:bg-[#EAE5D9] hover:text-[#0F4A2F]"
                aria-label="Close image preview"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-auto max-h-[78vh] flex items-center justify-center rounded-2xl bg-black/5">
              <img
                src={selectedPreview.dataUrl}
                alt={getSlotLabel(selectedPreview.slot)}
                className="max-h-[75vh] w-auto object-contain rounded-xl"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
