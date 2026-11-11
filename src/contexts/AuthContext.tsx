import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  User,
  onAuthStateChanged,
  signInWithPopup,
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  updateProfile as updateAuthProfile,
  sendPasswordResetEmail,
} from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, deleteDoc, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from '../firebase';
import { UserProfile, UserRole, OfficerStatus, Language } from '../types';
import { isUserFirstAdmin, isUserSuperAdmin } from '../utils/caseFilters';

interface AuthContextType {
  currentUser: User | null;
  profile: UserProfile | null;
  loading: boolean;
  isFirstAdminUser: boolean;
  isSuperAdminUser: boolean;
  isAdminUser: boolean;
  signInWithGoogle: (defaultRole?: UserRole, officerId?: string, subCounty?: string) => Promise<void>;
  signInWithEmail: (email: string, pass: string) => Promise<void>;
  signUpWithEmail: (
    email: string,
    pass: string,
    fullName: string,
    phone: string,
    role: UserRole,
    subCounty: string,
    ward?: string,
    officerIdNumber?: string,
    preferredLanguage?: Language
  ) => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
  signOutUser: () => Promise<void>;
  updateUserProfile: (data: Partial<UserProfile>) => Promise<void>;
  recordAuditLog: (action: string, targetId: string, details: string) => Promise<void>;
  promoteUserToAdmin: (targetUser: UserProfile) => Promise<void>;
  demoteAdminToOfficer: (targetUser: UserProfile) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // Monitor auth state
  useEffect(() => {
    let unsubscribeDoc: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);

      if (unsubscribeDoc) {
        unsubscribeDoc();
        unsubscribeDoc = null;
      }

      if (!user) {
        setProfile(null);
        setLoading(false);
        return;
      }

      const userDocRef = doc(db, 'users', user.uid);
      const isSuperAdmin = isUserSuperAdmin(user.email);

      // Listen for profile changes in real-time
      unsubscribeDoc = onSnapshot(
        userDocRef,
        async (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data() as UserProfile;
            // Super admin safeguard: if user is wanjiruclaire016@gmail.com, ensure role is superadmin
            if (isSuperAdmin && data.role !== 'superadmin') {
              try {
                await updateDoc(userDocRef, {
                  role: 'superadmin',
                  officerStatus: 'verified',
                  disabled: false,
                  updatedAt: new Date().toISOString(),
                });
                await setDoc(doc(db, 'admins', user.uid), {
                  id: user.uid,
                  email: user.email,
                  isSuperAdmin: true,
                  promotedAt: new Date().toISOString(),
                  bootstrapped: true,
                });
              } catch (e) {
                console.error('Failed to sync superadmin privilege:', e);
              }
            }
            setProfile(data);
          } else {
            // New user without profile doc (e.g. Google sign in)
            const newRole: UserRole = isSuperAdmin ? 'superadmin' : 'farmer';
            const initialProfile: Record<string, unknown> = {
              id: user.uid,
              fullName: user.displayName || user.email?.split('@')[0] || 'Farmer',
              email: user.email || '',
              phone: user.phoneNumber || '',
              role: newRole,
              subCounty: 'Machakos Town',
              ward: 'Machakos Central',
              preferredLanguage: 'en',
              disabled: false,
              createdAt: new Date().toISOString(),
            };

            if (isSuperAdmin) {
              initialProfile.officerStatus = 'verified';
            }

            try {
              await setDoc(userDocRef, initialProfile);
              if (isSuperAdmin) {
                await setDoc(doc(db, 'admins', user.uid), {
                  id: user.uid,
                  email: user.email,
                  isSuperAdmin: true,
                  promotedAt: new Date().toISOString(),
                  bootstrapped: true,
                });
              }
              setProfile(initialProfile as unknown as UserProfile);
            } catch (err) {
              console.warn('Profile initialization note:', err);
            }
          }
          setLoading(false);
        },
        (error) => {
          console.warn('Users profile snapshot listener note:', error);
          setLoading(false);
        }
      );
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeDoc) unsubscribeDoc();
    };
  }, []);

  const signInWithGoogle = async (
    intendedRole: UserRole = 'farmer',
    officerIdNumber?: string,
    subCounty = 'Machakos Town'
  ) => {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    const result = await signInWithPopup(auth, provider);
    const user = result.user;
    if (!user) return;
    const isSuperAdmin = isUserSuperAdmin(user.email);

    // Verify if profile exists, or create appropriately
    const userRef = doc(db, 'users', user.uid);
    const snap = await getDoc(userRef);

    if (!snap.exists()) {
      const assignedRole: UserRole = isSuperAdmin ? 'superadmin' : intendedRole;
      const newProfile: Record<string, unknown> = {
        id: user.uid,
        fullName: user.displayName || user.email?.split('@')[0] || 'User',
        email: user.email || '',
        phone: user.phoneNumber || '',
        role: assignedRole,
        subCounty,
        preferredLanguage: 'en',
        disabled: false,
        createdAt: new Date().toISOString(),
      };

      if (isSuperAdmin) {
        newProfile.officerStatus = 'verified';
      } else if (assignedRole === 'officer') {
        newProfile.officerStatus = 'pending';
        if (officerIdNumber) newProfile.officerIdNumber = officerIdNumber;
      }

      await setDoc(userRef, newProfile);

      if (isSuperAdmin) {
        await setDoc(doc(db, 'admins', user.uid), {
          id: user.uid,
          email: user.email,
          isSuperAdmin: true,
          promotedAt: new Date().toISOString(),
          bootstrapped: true,
        });
      }
      setProfile(newProfile as unknown as UserProfile);
    } else {
      const existingData = snap.data() as UserProfile;
      if (isSuperAdmin && existingData.role !== 'superadmin') {
        await updateDoc(userRef, {
          role: 'superadmin',
          officerStatus: 'verified',
          disabled: false,
          updatedAt: new Date().toISOString(),
        });
        await setDoc(doc(db, 'admins', user.uid), {
          id: user.uid,
          email: user.email,
          isSuperAdmin: true,
          promotedAt: new Date().toISOString(),
          bootstrapped: true,
        });
        setProfile({ ...existingData, role: 'superadmin', officerStatus: 'verified', disabled: false });
      } else {
        setProfile(existingData);
      }
    }
  };

  const signInWithEmail = async (email: string, pass: string) => {
    await signInWithEmailAndPassword(auth, email.trim(), pass);
  };

  const signUpWithEmail = async (
    email: string,
    pass: string,
    fullName: string,
    phone: string,
    role: UserRole,
    subCounty: string,
    ward?: string,
    officerIdNumber?: string,
    preferredLanguage: Language = 'en'
  ) => {
    const isSuperAdmin = isUserSuperAdmin(email);
    const effectiveRole: UserRole = isSuperAdmin ? 'superadmin' : role;

    const cred = await createUserWithEmailAndPassword(auth, email.trim(), pass);
    await updateAuthProfile(cred.user, { displayName: fullName });

    const newProfile: Record<string, unknown> = {
      id: cred.user.uid,
      fullName,
      email: cred.user.email || email,
      phone,
      role: effectiveRole,
      subCounty,
      ward: ward || '',
      preferredLanguage,
      disabled: false,
      createdAt: new Date().toISOString(),
    };

    if (isSuperAdmin) {
      newProfile.officerStatus = 'verified';
    } else if (effectiveRole === 'officer') {
      newProfile.officerStatus = 'pending';
      if (officerIdNumber) newProfile.officerIdNumber = officerIdNumber;
    }

    const userRef = doc(db, 'users', cred.user.uid);
    await setDoc(userRef, newProfile);

    if (isSuperAdmin) {
      await setDoc(doc(db, 'admins', cred.user.uid), {
        id: cred.user.uid,
        email: cred.user.email,
        isSuperAdmin: true,
        promotedAt: new Date().toISOString(),
        bootstrapped: true,
      });
    }

    setProfile(newProfile as unknown as UserProfile);
  };

  const sendPasswordReset = async (email: string) => {
    await sendPasswordResetEmail(auth, email.trim());
  };

  const signOutUser = async () => {
    await signOut(auth);
    setProfile(null);
  };

  const updateUserProfile = async (data: Partial<UserProfile>) => {
    if (!currentUser) throw new Error('Not logged in');
    const userRef = doc(db, 'users', currentUser.uid);
    await updateDoc(userRef, {
      ...data,
      updatedAt: new Date().toISOString(),
    });
  };

  const recordAuditLog = async (action: string, targetId: string, details: string) => {
    if (!currentUser || !profile) return;
    const logId = `log_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    try {
      await setDoc(doc(db, 'auditLogs', logId), {
        id: logId,
        actorId: currentUser.uid,
        actorName: profile.fullName || currentUser.email || 'Admin',
        actorEmail: currentUser.email || '',
        action,
        targetId,
        details,
        timestamp: new Date().toISOString(),
      });
    } catch (e) {
      console.warn('Could not record audit log:', e);
    }
  };

  const isSuperAdminUser = isUserSuperAdmin(currentUser?.email);
  const isFirstAdminUser = isSuperAdminUser;
  const isAdminUser = isSuperAdminUser || profile?.role === 'admin' || profile?.role === 'superadmin';

  // Only the Super Admin can promote a user to Admin
  const promoteUserToAdmin = async (targetUser: UserProfile) => {
    if (!isSuperAdminUser) {
      throw new Error('Unauthorized: Only the designated Super Admin can promote users to Administrator.');
    }
    const userRef = doc(db, 'users', targetUser.id);
    const nowIso = new Date().toISOString();
    await updateDoc(userRef, {
      role: 'admin',
      officerStatus: 'verified',
      updatedAt: nowIso,
    });
    await setDoc(doc(db, 'admins', targetUser.id), {
      id: targetUser.id,
      email: targetUser.email,
      promotedAt: nowIso,
      promotedBy: profile?.fullName || 'Super Admin',
    });
    await recordAuditLog(
      'ADMIN_PROMOTED',
      targetUser.id,
      `User ${targetUser.fullName} (${targetUser.email}) promoted to Administrator by Super Admin`
    );
  };

  // Only the Super Admin can demote an Admin
  const demoteAdminToOfficer = async (targetUser: UserProfile) => {
    if (!isSuperAdminUser) {
      throw new Error('Unauthorized: Only the designated Super Admin can demote Administrators.');
    }
    if (isUserSuperAdmin(targetUser.email)) {
      throw new Error('The Super Admin account can never be demoted or revoked.');
    }
    const userRef = doc(db, 'users', targetUser.id);
    const nowIso = new Date().toISOString();
    await updateDoc(userRef, {
      role: 'officer',
      officerStatus: 'verified',
      updatedAt: nowIso,
    });
    await deleteDoc(doc(db, 'admins', targetUser.id));
    await recordAuditLog(
      'ADMIN_DEMOTED',
      targetUser.id,
      `Administrator ${targetUser.fullName} (${targetUser.email}) demoted to Extension Officer by Super Admin`
    );
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        profile,
        loading,
        isFirstAdminUser,
        isSuperAdminUser,
        isAdminUser,
        signInWithGoogle,
        signInWithEmail,
        signUpWithEmail,
        sendPasswordReset,
        signOutUser,
        updateUserProfile,
        recordAuditLog,
        promoteUserToAdmin,
        demoteAdminToOfficer,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
