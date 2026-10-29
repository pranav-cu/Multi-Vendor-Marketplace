import React, { useState, useEffect, type FormEvent } from 'react';
import { useCustomer } from '../context/useCustomer';
import { requestCustomerOtp, verifyCustomerOtp, CustomerApiError } from '../services/customerApi';
import {
  AtelierLogoGlyph,
  ShieldLockIcon,
  CheckCircleIcon,
  SpinnerIcon,
  ArrowRightIcon,
} from '../components/ui/Icons';

export interface CustomerAuthViewProps {
  onSuccess?: () => void;
  onNavigateToVendorAuth?: () => void;
}

export const CustomerAuthView: React.FC<CustomerAuthViewProps> = ({
  onSuccess,
  onNavigateToVendorAuth,
}) => {
  const { loginCustomer } = useCustomer();

  const [step, setStep] = useState<'email' | 'otp'>('email');
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [otp, setOtp] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successInfo, setSuccessInfo] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  const handleRequestOtp = async (e?: FormEvent) => {
    if (e) e.preventDefault();
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setErrorMessage('Please enter a valid email address.');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);
    setSuccessInfo(null);

    try {
      const response = await requestCustomerOtp(cleanEmail);
      setStep('otp');
      setResendCooldown(60);
      setSuccessInfo(response.message || 'Verification code sent to your email.');
    } catch (err) {
      if (err instanceof CustomerApiError) {
        if (err.statusCode === 503) {
          setErrorMessage('Unable to deliver verification code right now. Please check service health and try again.');
        } else {
          setErrorMessage(err.message);
        }
      } else if (err instanceof Error) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage('Failed to request verification code.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async (e: FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.trim().toLowerCase();
    const cleanOtp = otp.trim().replace(/\D/g, '');

    if (cleanOtp.length !== 6) {
      setErrorMessage('Please enter the 6-digit verification code.');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const auth = await verifyCustomerOtp(
        cleanEmail,
        cleanOtp,
        displayName.trim() || undefined
      );

      loginCustomer(auth.token, auth.user, auth.customer);
      setSuccessInfo('Authentication verified.');
      if (onSuccess) {
        setTimeout(() => onSuccess(), 400);
      }
    } catch (err) {
      if (err instanceof CustomerApiError) {
        if (err.statusCode === 409) {
          setErrorMessage('This email is registered as a vendor or administrator. Please use the Vendor / Admin portal.');
        } else {
          setErrorMessage(err.message);
        }
      } else if (err instanceof Error) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage('Verification failed. Please check the code and try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto my-12 px-4">
      <div className="bg-white border border-neutral-200 p-8 sm:p-10 shadow-sm space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="w-10 h-10 mx-auto border border-neutral-300 bg-white flex items-center justify-center p-2 mb-3">
            <AtelierLogoGlyph className="w-full h-full text-neutral-800" />
          </div>
          <span className="text-[10px] font-bold tracking-[0.22em] uppercase text-[#9c784e]">
            CUSTOMER CLIENT ACCESS
          </span>
          <h1 className="text-2xl font-normal text-neutral-900 tracking-tight">
            {step === 'email' ? 'Client Identification' : 'Verify Code'}
          </h1>
          <p className="text-xs text-neutral-500 font-light">
            {step === 'email'
              ? 'Enter your email to receive a secure one-time verification passcode.'
              : `Enter the code sent to ${email}`}
          </p>
        </div>

        {/* Status Messages */}
        {errorMessage && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-2">
            <span className="font-bold">Error:</span>
            <span>{errorMessage}</span>
          </div>
        )}
        {successInfo && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
            <CheckCircleIcon className="w-4 h-4 shrink-0 text-emerald-600" />
            <span>{successInfo}</span>
          </div>
        )}

        {/* Step 1: Email Form */}
        {step === 'email' && (
          <form onSubmit={handleRequestOtp} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="customer-email" className="block text-[11px] font-semibold tracking-wider uppercase text-neutral-700">
                Email Address
              </label>
              <input
                id="customer-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                className="w-full bg-[#fbfbfa] border border-neutral-300 px-3.5 py-2.5 text-xs text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:border-black rounded-none"
                autoComplete="email"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="customer-name" className="block text-[11px] font-semibold tracking-wider uppercase text-neutral-700">
                Display Name <span className="text-neutral-400 font-normal">(Optional for new clients)</span>
              </label>
              <input
                id="customer-name"
                type="text"
                maxLength={120}
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="e.g. Jane Doe"
                className="w-full bg-[#fbfbfa] border border-neutral-300 px-3.5 py-2.5 text-xs text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:border-black rounded-none"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading || !email.trim()}
              className="w-full bg-black text-white py-3 text-xs font-semibold tracking-[0.18em] uppercase hover:bg-neutral-800 transition-colors disabled:bg-neutral-300 cursor-pointer flex items-center justify-center gap-2 rounded-none"
            >
              {isLoading ? (
                <>
                  <SpinnerIcon className="w-4 h-4 animate-spin" />
                  <span>TRANSMITTING CODE...</span>
                </>
              ) : (
                <>
                  <span>REQUEST PASSCODE</span>
                  <ArrowRightIcon className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </form>
        )}

        {/* Step 2: OTP Verification Form */}
        {step === 'otp' && (
          <form onSubmit={handleVerifyOtp} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="customer-otp" className="block text-[11px] font-semibold tracking-wider uppercase text-neutral-700">
                One-Time Passcode
              </label>
              <input
                id="customer-otp"
                type="text"
                required
                maxLength={6}
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="6-digit code"
                className="w-full text-center tracking-[0.3em] font-mono text-base bg-[#fbfbfa] border border-neutral-300 px-3.5 py-2.5 text-neutral-900 placeholder:text-neutral-300 focus:outline-none focus:border-black rounded-none"
                autoComplete="one-time-code"
                autoFocus
              />
            </div>

            <button
              type="submit"
              disabled={isLoading || otp.trim().length !== 6}
              className="w-full bg-black text-white py-3 text-xs font-semibold tracking-[0.18em] uppercase hover:bg-neutral-800 transition-colors disabled:bg-neutral-300 cursor-pointer flex items-center justify-center gap-2 rounded-none"
            >
              {isLoading ? (
                <>
                  <SpinnerIcon className="w-4 h-4 animate-spin" />
                  <span>VERIFYING CODE...</span>
                </>
              ) : (
                <>
                  <ShieldLockIcon className="w-4 h-4" />
                  <span>AUTHENTICATE & ENTER</span>
                </>
              )}
            </button>

            <div className="flex items-center justify-between text-xs pt-2">
              <button
                type="button"
                onClick={() => {
                  setStep('email');
                  setOtp('');
                  setErrorMessage(null);
                }}
                className="text-neutral-500 hover:text-black underline cursor-pointer"
              >
                ← Change Email
              </button>

              <button
                type="button"
                disabled={resendCooldown > 0 || isLoading}
                onClick={() => handleRequestOtp()}
                className={`cursor-pointer ${
                  resendCooldown > 0
                    ? 'text-neutral-400 cursor-not-allowed'
                    : 'text-neutral-800 font-semibold hover:underline'
                }`}
              >
                {resendCooldown > 0 ? `Resend code (${resendCooldown}s)` : 'Resend Code'}
              </button>
            </div>
          </form>
        )}

        {/* Switch to Vendor / Admin Portal */}
        {onNavigateToVendorAuth && (
          <div className="pt-6 border-t border-neutral-200 text-center">
            <p className="text-[11px] text-neutral-500">
              Are you a merchant or administrator?{' '}
              <button
                type="button"
                onClick={onNavigateToVendorAuth}
                className="font-semibold text-neutral-900 underline hover:text-black cursor-pointer"
              >
                Vendor / Admin Portal
              </button>
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
