import React, { useState, useEffect, useRef } from 'react';
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  setDoc,
  doc,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { CaseMessage, UserRole } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { Send, Image as ImageIcon, Loader2, User, ShieldCheck, MessageSquare, Info, X } from 'lucide-react';
import { compressImageInBrowser } from '../utils/imageCompressor';

interface CaseChatProps {
  caseId: string;
  readOnly?: boolean;
}

export const CaseChat: React.FC<CaseChatProps> = ({ caseId, readOnly = false }) => {
  const { currentUser, profile } = useAuth();
  const { t, language } = useLanguage();
  const [messages, setMessages] = useState<CaseMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [attachments, setAttachments] = useState<string[]>([]);
  const [sending, setSending] = useState(false);
  const [compressing, setCompressing] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatFileRef = useRef<HTMLInputElement>(null);

  // Subscribe to real-time chat messages
  useEffect(() => {
    if (!caseId) return;

    const messagesCol = collection(db, 'cases', caseId, 'messages');
    const q = query(messagesCol, orderBy('createdAt', 'asc'));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list: CaseMessage[] = [];
        snapshot.forEach((docSnap) => {
          list.push(docSnap.data() as CaseMessage);
        });
        setMessages(list);
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, `cases/${caseId}/messages`);
      }
    );

    return () => unsubscribe();
  }, [caseId]);

  // Auto scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (readOnly) return;
    if ((!inputText.trim() && attachments.length === 0) || !currentUser || !profile) return;

    setSending(true);
    const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    const msgData: Record<string, unknown> = {
      id: messageId,
      caseId,
      senderId: currentUser.uid,
      senderName: profile.fullName || currentUser.email?.split('@')[0] || 'User',
      senderRole: profile.role,
      text: inputText.trim(),
      createdAt: new Date().toISOString(),
    };
    if (attachments.length > 0) {
      msgData.attachments = attachments;
    }

    try {
      await setDoc(doc(db, 'cases', caseId, 'messages', messageId), msgData);
      setInputText('');
      setAttachments([]);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `cases/${caseId}/messages/${messageId}`);
    } finally {
      setSending(false);
    }
  };

  const handleAttachPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (readOnly) return;
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setCompressing(true);
    try {
      const file = files[0];
      const res = await compressImageInBrowser(file, 1000, 0.7);
      setAttachments((prev) => [...prev, res.dataUrl]);
    } catch (err) {
      console.error('Failed to attach photo to chat:', err);
    } finally {
      setCompressing(false);
      if (chatFileRef.current) chatFileRef.current.value = '';
    }
  };

  return (
    <div className="flex flex-col h-[520px] bg-stone-50 rounded-2xl border border-stone-200 overflow-hidden shadow-inner">
      {/* Header */}
      <div className="px-4 py-3 bg-[#0F4A2F] text-amber-50 flex items-center justify-between">
        <h4 className="font-heading font-black text-sm flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-[#2BC55B]" />
          {t('chatTitle')}
        </h4>
        <div className="flex items-center gap-2">
          {readOnly && (
            <span className="px-2 py-0.5 rounded-md bg-amber-400 text-stone-950 text-[10px] font-black uppercase tracking-wider">
              {language === 'sw' ? 'Kusoma Tu' : 'Read Only'}
            </span>
          )}
          <span className="text-xs text-amber-200/80">
            {messages.length} {language === 'sw' ? 'ujumbe' : 'messages'}
          </span>
        </div>
      </div>

      {/* Privacy Notice Banner for farmers & quality review */}
      <div className="bg-amber-50/90 border-b border-amber-200/70 px-4 py-2 text-[11px] text-amber-900 leading-snug flex items-start gap-2">
        <ShieldCheck className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
        <p>{t('privacyQualityNotice')}</p>
      </div>

      {/* Messages list */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-stone-500">
            <div className="w-12 h-12 rounded-full bg-stone-200/80 flex items-center justify-center text-stone-400 mb-2">
              <MessageSquare className="w-6 h-6 text-stone-400" />
            </div>
            <p className="text-sm font-medium">
              {language === 'sw'
                ? 'Hakuna ujumbe bado. Andika hapa kuanza mazungumzo.'
                : 'No messages yet. Send a message to start consultation.'}
            </p>
          </div>
        ) : (
          messages.map((msg) => {
            // System Notification Message
            if (msg.senderRole === 'system') {
              return (
                <div key={msg.id} className="w-full flex justify-center my-2">
                  <div className="px-3.5 py-1.5 rounded-full bg-stone-200/90 text-stone-700 text-xs font-semibold flex items-center gap-1.5 shadow-2xs border border-stone-300">
                    <Info className="w-3.5 h-3.5 text-stone-600" />
                    <span>{msg.text}</span>
                    <span className="text-[10px] text-stone-500">
                      • {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
              );
            }

            const isMe = msg.senderId === currentUser?.uid;
            const isOfficer = msg.senderRole === 'officer' || msg.senderRole === 'admin' || msg.senderRole === 'superadmin';

            return (
              <div
                key={msg.id}
                className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
              >
                {/* Sender name & role badge */}
                <div className="flex items-center gap-1.5 text-[11px] text-stone-500 mb-1 px-1">
                  <span className="font-semibold text-stone-700">
                    {isMe ? (language === 'sw' ? 'Wewe' : 'You') : msg.senderName}
                  </span>
                  {isOfficer && (
                    <span className="px-1.5 py-0.2 bg-emerald-100 text-emerald-800 rounded font-medium text-[10px]">
                      {msg.senderRole === 'superadmin' ? 'Super Admin' : msg.senderRole === 'admin' ? t('roleAdmin') : t('roleOfficer')}
                    </span>
                  )}
                  <span>•</span>
                  <span>{new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>

                {/* Message bubble */}
                <div
                  className={`max-w-[85%] sm:max-w-[75%] rounded-2xl px-4 py-2.5 text-sm shadow-xs ${
                    isMe
                      ? 'bg-[#0F4A2F] text-white rounded-tr-none'
                      : 'bg-white border border-stone-200 text-stone-900 rounded-tl-none'
                  }`}
                >
                  {msg.text && <p className="whitespace-pre-wrap leading-relaxed">{msg.text}</p>}

                  {/* Attached photos */}
                  {msg.attachments && msg.attachments.length > 0 && (
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      {msg.attachments.map((url, i) => (
                        <a
                          key={i}
                          href={url}
                          target="_blank"
                          rel="noreferrer"
                          className="block rounded-lg overflow-hidden border border-black/10 aspect-square bg-stone-100"
                        >
                          <img
                            src={url}
                            alt="Attachment"
                            className="w-full h-full object-cover hover:scale-105 transition-transform"
                          />
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Attachments preview bar before sending */}
      {attachments.length > 0 && !readOnly && (
        <div className="px-4 py-2 bg-stone-200/70 border-t border-stone-300 flex items-center gap-2">
          {attachments.map((att, i) => (
            <div key={i} className="relative w-12 h-12 rounded-lg overflow-hidden border border-stone-400">
              <img src={att} alt="Attachment preview" className="w-full h-full object-cover" />
              <button
                type="button"
                onClick={() => setAttachments([])}
                className="absolute top-0 right-0 bg-red-600 text-white p-0.5 rounded-full flex items-center justify-center"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
          <span className="text-xs text-stone-600 font-medium">
            {language === 'sw' ? 'Picha imeambatanishwa' : 'Photo attached'}
          </span>
        </div>
      )}

      {/* Input bar or Read-Only Banner */}
      {readOnly ? (
        <div className="p-3 bg-stone-100 border-t border-stone-200 text-center text-xs font-semibold text-stone-600 flex items-center justify-center gap-2">
          <ShieldCheck className="w-4 h-4 text-stone-600" />
          <span>{t('readOnlyOversight')}</span>
        </div>
      ) : (
        <form
          onSubmit={handleSendMessage}
          className="p-3 bg-white border-t border-stone-200 flex items-center gap-2"
        >
          <input
            type="file"
            ref={chatFileRef}
            onChange={handleAttachPhoto}
            accept="image/*"
            className="hidden"
            id="chat-photo-input"
            disabled={compressing || sending}
          />
          <label
            htmlFor="chat-photo-input"
            className="p-2.5 rounded-xl border border-stone-200 hover:bg-stone-100 text-stone-600 cursor-pointer transition-colors"
            title={t('attachPhoto')}
          >
            {compressing ? <Loader2 className="w-5 h-5 animate-spin text-emerald-600" /> : <ImageIcon className="w-5 h-5" />}
          </label>

          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder={t('chatPlaceholder')}
            disabled={sending}
            className="flex-1 bg-stone-100 border border-stone-200 rounded-xl px-4 py-2.5 text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-emerald-600"
          />

          <button
            type="submit"
            disabled={(!inputText.trim() && attachments.length === 0) || sending}
            className="p-2.5 rounded-xl bg-[#1e4620] hover:bg-[#285d2b] disabled:bg-stone-300 text-white font-medium transition-colors shadow-xs"
          >
            {sending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
          </button>
        </form>
      )}
    </div>
  );
};
