import React, { useState, useRef } from 'react';
import { Camera, Upload, X, Loader2, Image as ImageIcon, AlertCircle, Check } from 'lucide-react';
import { compressImageInBrowser, validateImageFile } from '../utils/imageCompressor';
import { useLanguage } from '../contexts/LanguageContext';

interface ImageUploadWithPreviewProps {
  photos: string[];
  onChange: (newPhotos: string[]) => void;
  maxPhotos?: number;
}

export const ImageUploadWithPreview: React.FC<ImageUploadWithPreviewProps> = ({
  photos,
  onChange,
  maxPhotos = 4,
}) => {
  const { t, language } = useLanguage();
  const [compressing, setCompressing] = useState(false);
  const [compressionMsg, setCompressionMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setErrorMsg(null);
    const availableSlots = maxPhotos - photos.length;
    if (availableSlots <= 0) {
      setErrorMsg(`Maximum of ${maxPhotos} photos allowed.`);
      return;
    }

    const filesToProcess = Array.from(files).slice(0, availableSlots);
    setCompressing(true);

    try {
      const newUrls: string[] = [];
      let totalSavedKb = 0;

      for (let i = 0; i < filesToProcess.length; i++) {
        const file = filesToProcess[i];
        const validation = validateImageFile(file);
        if (!validation.valid) {
          setErrorMsg(validation.error || 'Invalid file format');
          continue;
        }

        setCompressionMsg(
          language === 'sw'
            ? `Inabana picha ${i + 1} kati ya ${filesToProcess.length}...`
            : `Optimizing photo ${i + 1} of ${filesToProcess.length} for mobile...`
        );

        const result = await compressImageInBrowser(file, 1200, 0.72);
        newUrls.push(result.dataUrl);

        const savedKb = Math.round((result.originalSizeBytes - result.sizeBytes) / 1024);
        if (savedKb > 0) totalSavedKb += savedKb;
      }

      if (newUrls.length > 0) {
        onChange([...photos, ...newUrls]);
        setCompressionMsg(
          language === 'sw'
            ? `Imekamilika! Umeokoa data ya takriban ${totalSavedKb} KB.`
            : `Compressed! Saved ~${totalSavedKb} KB of mobile data.`
        );
        setTimeout(() => setCompressionMsg(null), 4000);
      }
    } catch (err: unknown) {
      console.error('Compression error:', err);
      setErrorMsg(err instanceof Error ? err.message : 'Error processing image.');
    } finally {
      setCompressing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const removePhoto = (index: number) => {
    const updated = photos.filter((_, i) => i !== index);
    onChange(updated);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-xs text-stone-600">
        <span className="font-medium">
          {photos.length} / {maxPhotos} {language === 'sw' ? 'picha zimepakiwa' : 'photos added'}
        </span>
        <span className="text-emerald-700 font-medium">
          {language === 'sw' ? 'Mwisho picha 4' : 'Max 4 photos (JPEG/PNG)'}
        </span>
      </div>

      {/* Grid of uploaded images */}
      {photos.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {photos.map((url, idx) => (
            <div
              key={idx}
              className="relative aspect-square rounded-xl overflow-hidden border-2 border-stone-200 bg-stone-100 group shadow-xs"
            >
              <img
                src={url}
                alt={`Crop symptom photo ${idx + 1}`}
                className="w-full h-full object-cover"
              />
              <button
                type="button"
                onClick={() => removePhoto(idx)}
                className="absolute top-1.5 right-1.5 p-1 rounded-full bg-red-600 text-white hover:bg-red-700 transition-colors shadow-md"
                aria-label={`Remove photo ${idx + 1}`}
              >
                <X className="w-3.5 h-3.5" />
              </button>
              <div className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded bg-black/60 text-white text-[10px] font-medium">
                #{idx + 1}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Upload trigger button */}
      {photos.length < maxPhotos && (
        <div>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileSelect}
            accept="image/jpeg,image/png,image/webp,image/jpg"
            multiple
            className="hidden"
            id="crop-photo-input"
            disabled={compressing}
          />
          <label
            htmlFor="crop-photo-input"
            className={`flex flex-col items-center justify-center p-5 border-2 border-dashed rounded-xl cursor-pointer transition-all ${
              compressing
                ? 'bg-stone-50 border-stone-300 cursor-not-allowed opacity-75'
                : 'border-emerald-700/30 hover:border-emerald-600 hover:bg-emerald-50/40 bg-white'
            }`}
          >
            {compressing ? (
              <div className="flex flex-col items-center gap-2 text-emerald-800">
                <Loader2 className="w-7 h-7 animate-spin text-emerald-600" />
                <span className="text-xs font-semibold">{compressionMsg || t('loading')}</span>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-1.5 text-center">
                <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center mb-0.5">
                  <Camera className="w-5 h-5" />
                </div>
                <span className="text-sm font-bold text-stone-800">
                  {language === 'sw' ? 'Piga au Chagua Picha' : 'Take or Select Photo'}
                </span>
                <span className="text-xs text-stone-500">
                  {language === 'sw'
                    ? 'Inabana picha kiotomatiki kwa simu za mkononi'
                    : 'Fast in-browser compression for mobile networks'}
                </span>
              </div>
            )}
          </label>
        </div>
      )}

      {/* Compression status badge or error */}
      {compressionMsg && !compressing && (
        <p className="text-xs font-medium text-emerald-700 flex items-center gap-1">
          <Check className="w-3.5 h-3.5" />
          <span>{compressionMsg}</span>
        </p>
      )}

      {errorMsg && (
        <div className="p-2.5 rounded-lg bg-red-50 border border-red-200 text-red-800 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
          <span>{errorMsg}</span>
        </div>
      )}
    </div>
  );
};
