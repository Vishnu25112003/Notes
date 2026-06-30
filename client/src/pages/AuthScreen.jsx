import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import {
  checkUsername,
  registerWebAuthn,
  getTotpSetup,
  verifyTotpSetup,
  checkUserExists,
  authenticateWebAuthn,
  loginTotp,
} from '../api/auth.js';

const DARK = {
  bg: '#0a0a0c',
  card: '#111116',
  border: '#2a2a31',
  accent: '#7c6cff',
  accentHover: '#6b5ce7',
  text: '#f4f4f6',
  muted: '#55555f',
  error: '#ec5d8a',
  success: '#5be3a0',
};

const styles = {
  page: {
    minHeight: '100vh',
    background: DARK.bg,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px 16px',
    fontFamily: "'Space Grotesk', 'JetBrains Mono', monospace",
  },
  card: {
    background: DARK.card,
    border: `1px solid ${DARK.border}`,
    borderRadius: '16px',
    padding: '40px 32px',
    width: '100%',
    maxWidth: '420px',
  },
  title: {
    color: DARK.text,
    fontSize: '22px',
    fontWeight: 700,
    marginBottom: '6px',
    margin: 0,
  },
  subtitle: {
    color: DARK.muted,
    fontSize: '14px',
    margin: '8px 0 28px',
  },
  label: {
    display: 'block',
    color: DARK.muted,
    fontSize: '12px',
    fontWeight: 600,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    marginBottom: '8px',
  },
  input: {
    width: '100%',
    background: '#18181f',
    border: `1px solid ${DARK.border}`,
    borderRadius: '8px',
    padding: '12px 14px',
    color: DARK.text,
    fontSize: '15px',
    outline: 'none',
    boxSizing: 'border-box',
    fontFamily: 'inherit',
  },
  btn: {
    width: '100%',
    background: DARK.accent,
    border: 'none',
    borderRadius: '8px',
    padding: '13px',
    color: '#fff',
    fontSize: '15px',
    fontWeight: 600,
    cursor: 'pointer',
    marginTop: '16px',
    fontFamily: 'inherit',
    transition: 'background 0.15s',
  },
  btnSecondary: {
    width: '100%',
    background: 'transparent',
    border: `1px solid ${DARK.border}`,
    borderRadius: '8px',
    padding: '12px',
    color: DARK.muted,
    fontSize: '14px',
    cursor: 'pointer',
    marginTop: '10px',
    fontFamily: 'inherit',
  },
  error: {
    color: DARK.error,
    fontSize: '13px',
    marginTop: '10px',
    padding: '10px 12px',
    background: 'rgba(236,93,138,0.08)',
    borderRadius: '6px',
    border: `1px solid rgba(236,93,138,0.2)`,
  },
  info: {
    color: DARK.muted,
    fontSize: '13px',
    marginTop: '10px',
    padding: '10px 12px',
    background: 'rgba(124,108,255,0.06)',
    borderRadius: '6px',
    border: `1px solid rgba(124,108,255,0.15)`,
  },
  divider: {
    color: DARK.muted,
    fontSize: '13px',
    textAlign: 'center',
    margin: '18px 0 8px',
  },
  link: {
    color: DARK.accent,
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontSize: '14px',
    padding: 0,
    fontFamily: 'inherit',
    textDecoration: 'underline',
    textUnderlineOffset: '3px',
  },
  qrWrap: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '12px',
    margin: '16px 0',
  },
  secret: {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: '12px',
    color: DARK.muted,
    background: '#18181f',
    border: `1px solid ${DARK.border}`,
    borderRadius: '6px',
    padding: '8px 12px',
    wordBreak: 'break-all',
    textAlign: 'center',
    width: '100%',
    boxSizing: 'border-box',
  },
  otpRow: {
    display: 'flex',
    gap: '8px',
    justifyContent: 'center',
    margin: '8px 0',
  },
  otpInput: {
    width: '42px',
    height: '52px',
    background: '#18181f',
    border: `1px solid ${DARK.border}`,
    borderRadius: '8px',
    color: DARK.text,
    fontSize: '20px',
    fontWeight: 700,
    textAlign: 'center',
    outline: 'none',
    fontFamily: "'JetBrains Mono', monospace",
  },
  biometricIcon: {
    fontSize: '52px',
    textAlign: 'center',
    margin: '16px 0 8px',
  },
  attempts: {
    color: DARK.error,
    fontSize: '12px',
    textAlign: 'center',
    marginTop: '8px',
  },
};

async function checkWebAuthnSupport() {
  if (typeof window.PublicKeyCredential === 'undefined') return false;
  if (typeof window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable !== 'function') return false;
  try {
    return await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

function OtpInputs({ value, onChange, disabled }) {
  const refs = [useRef(), useRef(), useRef(), useRef(), useRef(), useRef()];
  const digits = value.split('');

  function handleKey(i, e) {
    if (e.key === 'Backspace') {
      const next = digits.slice();
      if (next[i]) { next[i] = ''; onChange(next.join('')); }
      else if (i > 0) { next[i - 1] = ''; onChange(next.join('')); refs[i - 1].current?.focus(); }
      return;
    }
    if (!/^\d$/.test(e.key)) return;
    const next = digits.slice();
    next[i] = e.key;
    onChange(next.join(''));
    if (i < 5) refs[i + 1].current?.focus();
  }

  function handlePaste(e) {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted) { onChange(pasted.padEnd(6, '').slice(0, 6)); refs[Math.min(pasted.length, 5)].current?.focus(); }
    e.preventDefault();
  }

  return (
    <div style={styles.otpRow}>
      {[0, 1, 2, 3, 4, 5].map(i => (
        <input
          key={i}
          ref={refs[i]}
          value={digits[i] || ''}
          onChange={() => {}}
          onKeyDown={e => handleKey(i, e)}
          onPaste={handlePaste}
          maxLength={1}
          inputMode="numeric"
          disabled={disabled}
          style={{
            ...styles.otpInput,
            borderColor: digits[i] ? DARK.accent : DARK.border,
          }}
        />
      ))}
    </div>
  );
}

export default function AuthScreen() {
  const { login } = useAuth();
  const [view, setView] = useState('entry'); // entry | register-webauthn | register-totp | login-webauthn | login-totp
  const [username, setUsername] = useState('');
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [webAuthnSupported, setWebAuthnSupported] = useState(null);
  const [qrDataUrl, setQrDataUrl] = useState(null);
  const [totpSecret, setTotpSecret] = useState(null);
  const [code, setCode] = useState('');
  const [webAuthnFailures, setWebAuthnFailures] = useState(0);
  const [isNewUser, setIsNewUser] = useState(false);

  useEffect(() => {
    checkWebAuthnSupport().then(setWebAuthnSupported);
  }, []);

  function clearMessages() { setError(null); setInfo(null); }

  // ── Entry ───────────────────────────────────────────────────────────────────

  async function handleEntrySubmit(e) {
    e.preventDefault();
    clearMessages();
    const trimmed = username.trim();
    if (!/^[a-zA-Z0-9]{3,20}$/.test(trimmed)) {
      return setError('Username must be 3–20 letters and numbers only. No spaces or symbols.');
    }
    setLoading(true);
    try {
      const { hasWebAuthn } = await checkUserExists(trimmed);
      setIsNewUser(false);
      if (webAuthnSupported && hasWebAuthn) {
        setView('login-webauthn');
      } else {
        setView('login-totp');
      }
    } catch (err) {
      if (err === 'User not found' || String(err).includes('not found')) {
        // New user
        setIsNewUser(true);
        setView('register-webauthn');
      } else {
        setError(String(err));
      }
    } finally {
      setLoading(false);
    }
  }

  // ── Registration — WebAuthn ─────────────────────────────────────────────────

  async function handleRegisterBiometric() {
    clearMessages();
    setLoading(true);
    try {
      await registerWebAuthn(username.trim());
      setInfo('Biometric registered. Now set up your Authenticator app.');
      await setupTotp();
    } catch (err) {
      setError(String(err));
      setLoading(false);
    }
  }

  async function handleSkipBiometric() {
    clearMessages();
    await setupTotp();
  }

  async function setupTotp() {
    setLoading(true);
    try {
      const data = await getTotpSetup(username.trim());
      setQrDataUrl(data.qrDataUrl);
      setTotpSecret(data.secret);
      setCode('');
      setView('register-totp');
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }

  // ── Registration — TOTP verify ──────────────────────────────────────────────

  async function handleRegisterTotpVerify(e) {
    e.preventDefault();
    if (code.length < 6) return setError('Enter the 6-digit code from your Authenticator app.');
    clearMessages();
    setLoading(true);
    try {
      const data = await verifyTotpSetup(username.trim(), code);
      login(data.token, data.username);
    } catch (err) {
      setError(String(err));
      setCode('');
    } finally {
      setLoading(false);
    }
  }

  // ── Login — WebAuthn ────────────────────────────────────────────────────────

  useEffect(() => {
    if (view !== 'login-webauthn') return;
    triggerWebAuthnLogin();
  }, [view]);

  async function triggerWebAuthnLogin() {
    clearMessages();
    setLoading(true);
    try {
      const data = await authenticateWebAuthn(username.trim());
      login(data.token, data.username);
    } catch (err) {
      const fails = webAuthnFailures + 1;
      setWebAuthnFailures(fails);
      if (fails >= 3 || String(err).includes('maxAttempts')) {
        setError('Too many failed attempts.');
        setInfo('Please use your Authenticator App instead.');
      } else {
        setError(`Biometric failed (attempt ${fails}/3). Try again or use Authenticator App.`);
      }
    } finally {
      setLoading(false);
    }
  }

  // ── Login — TOTP ────────────────────────────────────────────────────────────

  async function handleLoginTotp(e) {
    e.preventDefault();
    if (code.length < 6) return setError('Enter the 6-digit code from your Authenticator app.');
    clearMessages();
    setLoading(true);
    try {
      const data = await loginTotp(username.trim(), code);
      login(data.token, data.username);
    } catch (err) {
      setError(String(err));
      setCode('');
    } finally {
      setLoading(false);
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div style={styles.page}>
      <div style={styles.card}>

        {/* ENTRY */}
        {view === 'entry' && (
          <form onSubmit={handleEntrySubmit}>
            <p style={styles.title}>Notespace</p>
            <p style={styles.subtitle}>Enter your username to continue</p>
            <label style={styles.label}>Username</label>
            <input
              style={styles.input}
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="e.g. Vishnu25"
              autoFocus
              autoComplete="username"
              spellCheck={false}
            />
            {error && <div style={styles.error}>{error}</div>}
            <button type="submit" style={styles.btn} disabled={loading}>
              {loading ? 'Checking…' : 'Continue →'}
            </button>
          </form>
        )}

        {/* REGISTER — WEBAUTHN */}
        {view === 'register-webauthn' && (
          <div>
            <p style={styles.title}>Welcome, {username}</p>
            <p style={styles.subtitle}>Set up biometric login for this device</p>
            {webAuthnSupported ? (
              <>
                <div style={styles.biometricIcon}>🔐</div>
                <p style={{ ...styles.info, textAlign: 'center' }}>
                  Your device supports fingerprint / Face ID. Register it now for instant login.
                </p>
                {error && <div style={styles.error}>{error}</div>}
                {info && <div style={{ ...styles.info, color: DARK.success }}>{info}</div>}
                <button style={styles.btn} onClick={handleRegisterBiometric} disabled={loading}>
                  {loading ? 'Registering…' : 'Register Biometric'}
                </button>
                <button style={styles.btnSecondary} onClick={handleSkipBiometric} disabled={loading}>
                  Skip — I'll use Authenticator App only
                </button>
              </>
            ) : (
              <>
                <div style={styles.info}>
                  This device doesn't have a biometric sensor. You'll use Google Authenticator for login.
                </div>
                <button style={styles.btn} onClick={handleSkipBiometric} disabled={loading}>
                  {loading ? 'Setting up…' : 'Continue →'}
                </button>
              </>
            )}
            <div style={styles.divider}>
              <button style={styles.link} onClick={() => { setView('entry'); clearMessages(); }}>
                ← Back
              </button>
            </div>
          </div>
        )}

        {/* REGISTER — TOTP */}
        {view === 'register-totp' && (
          <form onSubmit={handleRegisterTotpVerify}>
            <p style={styles.title}>Set up Authenticator</p>
            <p style={styles.subtitle}>Scan this QR code in Google Authenticator or Authy</p>
            {qrDataUrl && (
              <div style={styles.qrWrap}>
                <img src={qrDataUrl} alt="TOTP QR Code" style={{ width: 180, height: 180, borderRadius: 8 }} />
                <p style={{ ...styles.label, margin: 0 }}>Can't scan? Enter this secret manually:</p>
                <div style={styles.secret}>{totpSecret}</div>
              </div>
            )}
            <label style={styles.label}>Enter the 6-digit code to confirm</label>
            <OtpInputs value={code} onChange={setCode} disabled={loading} />
            {error && <div style={styles.error}>{error}</div>}
            <button type="submit" style={styles.btn} disabled={loading || code.length < 6}>
              {loading ? 'Verifying…' : 'Confirm & Start Using Notespace'}
            </button>
          </form>
        )}

        {/* LOGIN — WEBAUTHN */}
        {view === 'login-webauthn' && (
          <div>
            <p style={styles.title}>Welcome back</p>
            <p style={styles.subtitle}>{username}</p>
            <div style={styles.biometricIcon}>👆</div>
            <p style={{ ...styles.info, textAlign: 'center' }}>
              {loading ? 'Waiting for biometric confirmation…' : 'Use your fingerprint, Face ID, or Windows Hello to sign in.'}
            </p>
            {error && <div style={styles.error}>{error}</div>}
            {webAuthnFailures < 3 && !loading && (
              <button style={styles.btn} onClick={triggerWebAuthnLogin} disabled={loading}>
                Try Biometric Again
              </button>
            )}
            <button style={styles.btnSecondary} onClick={() => { clearMessages(); setCode(''); setView('login-totp'); }}>
              Use Authenticator App instead
            </button>
            <div style={styles.divider}>
              <button style={styles.link} onClick={() => { setView('entry'); clearMessages(); }}>
                ← Different user
              </button>
            </div>
          </div>
        )}

        {/* LOGIN — TOTP */}
        {view === 'login-totp' && (
          <form onSubmit={handleLoginTotp}>
            <p style={styles.title}>Authenticator Code</p>
            <p style={styles.subtitle}>
              Open Google Authenticator and enter the code for <strong style={{ color: DARK.text }}>{username}</strong>
            </p>
            <label style={styles.label}>6-digit code</label>
            <OtpInputs value={code} onChange={setCode} disabled={loading} />
            {error && <div style={styles.error}>{error}</div>}
            <button type="submit" style={styles.btn} disabled={loading || code.length < 6}>
              {loading ? 'Verifying…' : 'Sign In'}
            </button>
            {webAuthnSupported && !isNewUser && (
              <button type="button" style={styles.btnSecondary} onClick={() => { clearMessages(); setView('login-webauthn'); }}>
                Try Biometric Again
              </button>
            )}
            <div style={styles.divider}>
              <button type="button" style={styles.link} onClick={() => { setView('entry'); clearMessages(); setCode(''); }}>
                ← Different user
              </button>
            </div>
          </form>
        )}

      </div>
    </div>
  );
}
