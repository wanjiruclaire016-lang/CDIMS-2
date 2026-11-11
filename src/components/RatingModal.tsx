import React, { useState } from 'react';
import { Star, X, Loader2 } from 'lucide-react';
import { doc, updateDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { useLanguage } from '../contexts/LanguageContext';

interface RatingModalProps {
  caseId: string;
  currentRating?: number | null;
  currentFeedback?: string;
  onClose: () => void;
  onSuccess: () => void;
}

export const RatingModal: React.FC<RatingModalProps> = ({
  caseId,
  currentRating = 5,
  currentFeedback = '',
  onClose,
  onSuccess,
}) => {
  const { t, language } = useLanguage();
  const [rating, setRating] = useState<number>(currentRating || 5);
  const [hoverRating, setHoverRating] = useState<number | null>(null);
  const [feedback, setFeedback] = useState(currentFeedback || '');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const caseRef = doc(db, 'cases', caseId);
      await updateDoc(caseRef, {
        rating,
        ratingFeedback: feedback.trim(),
        updatedAt: new Date().toISOString(),
      });
      onSuccess();
      onClose();
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `cases/${caseId}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl border border-stone-200">
        <div className="flex items-center justify-between pb-3 border-b border-stone-100 mb-5">
          <h3 className="font-bold text-lg text-stone-900">{t('rateCaseTitle')}</h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-stone-100 text-stone-400 hover:text-stone-700"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 text-center">
          <p className="text-sm text-stone-600">{t('rateCaseSubtitle')}</p>

          {/* Star Rating Selector */}
          <div className="flex items-center justify-center gap-2 py-2">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                onClick={() => setRating(star)}
                onMouseEnter={() => setHoverRating(star)}
                onMouseLeave={() => setHoverRating(null)}
                className="p-1 transition-transform hover:scale-110 focus:outline-none"
                aria-label={`${star} star`}
              >
                <Star
                  className={`w-9 h-9 ${
                    (hoverRating !== null ? star <= hoverRating : star <= rating)
                      ? 'fill-amber-400 text-amber-500'
                      : 'text-stone-300'
                  }`}
                />
              </button>
            ))}
          </div>
          <span className="text-xs font-bold text-amber-800 bg-amber-50 px-3 py-1 rounded-full">
            {rating === 5
              ? (language === 'sw' ? 'Nzuri Sana (5/5)' : 'Excellent Guidance (5/5)')
              : rating === 4
              ? (language === 'sw' ? 'Nzuri (4/5)' : 'Very Helpful (4/5)')
              : rating === 3
              ? (language === 'sw' ? 'Ya Kawaida (3/5)' : 'Satisfactory (3/5)')
              : (language === 'sw' ? 'Haikusaidia (1-2/5)' : 'Needs Improvement')}
          </span>

          {/* Feedback textarea */}
          <div className="text-left">
            <textarea
              rows={3}
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder={t('feedbackPlaceholder')}
              className="w-full bg-stone-50 border border-stone-200 rounded-xl p-3 text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-emerald-600 resize-none"
            />
          </div>

          <div className="pt-3 border-t border-stone-100 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2.5 rounded-xl border border-stone-200 text-stone-600 text-sm font-semibold hover:bg-stone-50"
            >
              {t('cancelBtn')}
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 text-sm font-bold shadow-sm flex items-center gap-2"
            >
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              {t('submitRatingBtn')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
