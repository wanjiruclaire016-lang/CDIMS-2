export interface ImageValidationResult {
  valid: boolean;
  error?: string;
}

export interface CompressionResult {
  dataUrl: string;
  sizeBytes: number;
  originalSizeBytes: number;
  width: number;
  height: number;
}

const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB input limit
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/jpg'];

/**
 * Validates image type and initial size bounds
 */
export function validateImageFile(file: { type: string; size: number }): ImageValidationResult {
  if (!file) {
    return { valid: false, error: 'No file provided.' };
  }
  const isImage = ALLOWED_MIME_TYPES.includes(file.type.toLowerCase()) || file.type.startsWith('image/');
  if (!isImage) {
    return { valid: false, error: 'File must be an image (JPEG, PNG, or WebP).' };
  }
  if (file.size > MAX_IMAGE_SIZE_BYTES) {
    return { valid: false, error: 'Image size exceeds 10MB limit. Please choose a smaller photo.' };
  }
  return { valid: true };
}

/**
 * Calculates scaled dimensions preserving aspect ratio
 */
export function calculateTargetDimensions(
  width: number,
  height: number,
  maxDimension = 1280
): { width: number; height: number } {
  if (width <= 0 || height <= 0) {
    return { width: maxDimension, height: maxDimension };
  }
  if (width <= maxDimension && height <= maxDimension) {
    return { width, height };
  }
  if (width > height) {
    const scale = maxDimension / width;
    return {
      width: maxDimension,
      height: Math.round(height * scale),
    };
  } else {
    const scale = maxDimension / height;
    return {
      width: Math.round(width * scale),
      height: maxDimension,
    };
  }
}

/**
 * Compresses an image in the browser using HTML5 Canvas to < 150KB - 200KB JPEG
 * Enables instant submission on slow mobile rural networks.
 */
export async function compressImageInBrowser(
  file: File,
  maxDimension = 1200,
  quality = 0.72
): Promise<CompressionResult> {
  const validation = validateImageFile(file);
  if (!validation.valid) {
    throw new Error(validation.error || 'Invalid image file');
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read image file'));
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => reject(new Error('Failed to load image in browser'));
      img.onload = () => {
        const { width, height } = calculateTargetDimensions(img.width, img.height, maxDimension);
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas 2D context not available'));
          return;
        }

        // Fill white background in case of transparent PNG
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        // Calculate rough byte size of base64
        const head = 'data:image/jpeg;base64,';
        const base64Length = dataUrl.length - head.length;
        const sizeBytes = Math.round((base64Length * 3) / 4);

        resolve({
          dataUrl,
          sizeBytes,
          originalSizeBytes: file.size,
          width,
          height,
        });
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
}
