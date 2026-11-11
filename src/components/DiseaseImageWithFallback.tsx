import React, { useState } from 'react';
import { Sprout } from 'lucide-react';

interface DiseaseImageWithFallbackProps {
  src?: string | null;
  alt: string;
  className?: string;
  aspectRatioClass?: string;
}

export const DiseaseImageWithFallback: React.FC<DiseaseImageWithFallbackProps> = ({
  src,
  alt,
  className = '',
  aspectRatioClass = 'aspect-[16/10]',
}) => {
  const [hasError, setHasError] = useState(false);

  // If no source or error occurred, render soft green placeholder
  if (!src || hasError) {
    return (
      <div
        className={`w-full ${aspectRatioClass} bg-[#DCFCE7]/60 border border-[#86EFAC]/40 flex flex-col items-center justify-center p-4 text-center rounded-2xl select-none ${className}`}
      >
        <div className="w-12 h-12 rounded-full bg-[#22C55E]/15 flex items-center justify-center text-[#166534] mb-2">
          <Sprout className="w-6 h-6 stroke-[1.75]" />
        </div>
        <p className="text-xs font-medium text-[#166534] tracking-wide">Photo coming soon</p>
      </div>
    );
  }

  return (
    <div className={`relative w-full ${aspectRatioClass} overflow-hidden rounded-2xl bg-neutral-100 ${className}`}>
      <img
        src={src}
        alt={alt}
        className="w-full h-full object-cover"
        onError={() => setHasError(true)}
        loading="lazy"
      />
    </div>
  );
};
