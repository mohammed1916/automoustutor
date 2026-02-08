import React, { useState } from 'react';
import { X, AlertCircle } from 'lucide-react';
import { googleLogin, UserProfile } from '../services/storageService';
import { GoogleLogin } from '@react-oauth/google';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (user: UserProfile) => void;
}

const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleGoogleSuccess = (credentialResponse: any) => {
    if (credentialResponse.credential) {
      try {
        const user = googleLogin(credentialResponse.credential);
        onSuccess(user);
        onClose();
      } catch (e) {
        console.error("Google Login Error", e);
        setError("Failed to process Google Login");
      }
    }
  };

  const handleGoogleError = () => {
    setError("Google Sign-In Failed");
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-800 bg-slate-800/50">
          <h2 className="text-xl font-bold text-white">
            Sign In
          </h2>
          <button 
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-full transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-8 space-y-8 flex flex-col items-center">
          
          {error && (
            <div className="w-full p-3 bg-red-900/30 border border-red-500/30 rounded-lg flex items-center gap-3 text-red-200 text-sm">
              <AlertCircle size={16} className="flex-shrink-0" />
              {error}
            </div>
          )}

          <div className="text-center space-y-2">
              <p className="text-slate-400 text-sm leading-relaxed">
                  Sign in to save your progress, track mastery levels, and sync across devices.
              </p>
          </div>

          <div className="w-full flex justify-center">
            <GoogleLogin
              onSuccess={handleGoogleSuccess}
              onError={handleGoogleError}
              theme="filled_black"
              shape="pill"
              size="large"
              width="300"
              text="continue_with"
            />
          </div>
          
          <div className="text-[10px] text-slate-600 text-center max-w-[250px]">
              By continuing, you agree to share your name and email from your Google Profile for account creation.
          </div>

        </div>
      </div>
    </div>
  );
};

export default AuthModal;