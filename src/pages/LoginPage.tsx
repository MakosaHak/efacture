import { useState, type FormEvent } from 'react';

import { Link, Navigate, useNavigate } from 'react-router-dom';

import { useAuth } from '../context/AuthContext';

import { Button } from '../components/ui/Button';

import { Card } from '../components/ui/Card';

import { Input } from '../components/ui/Input';

import { PwaInstallBanner } from '../components/pwa/PwaInstallBanner';
import { usePwaInstall } from '../hooks/usePwaInstall';
import { isSupabaseConfigured } from '../lib/supabase';



type Tab = 'password' | 'otp';



export default function LoginPage() {

  const { user, signInWithPhonePassword, signInWithPhoneOtp, sendOtp, signInDemo } = useAuth();
  const { canInstall, isInstalled, isIos, install } = usePwaInstall();

  const navigate = useNavigate();

  const [tab, setTab] = useState<Tab>('password');

  const [phone, setPhone] = useState('');

  const [password, setPassword] = useState('');

  const [otp, setOtp] = useState('');

  const [otpSent, setOtpSent] = useState(false);

  const [demoCode, setDemoCode] = useState('');

  const [info, setInfo] = useState('');

  const [error, setError] = useState('');

  const [loading, setLoading] = useState(false);



  if (user) return <Navigate to="/" replace />;



  const handlePasswordLogin = async (e: FormEvent) => {

    e.preventDefault();

    setError('');

    setLoading(true);

    try {

      await signInWithPhonePassword(phone, password);

      navigate('/');

    } catch (err) {

      setError(err instanceof Error ? err.message : 'Connexion impossible');

    } finally {

      setLoading(false);

    }

  };



  const handleSendOtp = async () => {

    setError('');

    setInfo('');

    setLoading(true);

    try {

      const result = await sendOtp(phone);

      setOtpSent(true);

      setInfo(result.message);

      if (result.demoCode) setDemoCode(result.demoCode);

    } catch (err) {

      setError(err instanceof Error ? err.message : 'Envoi impossible');

    } finally {

      setLoading(false);

    }

  };



  const handleOtpLogin = async (e: FormEvent) => {

    e.preventDefault();

    setError('');

    setLoading(true);

    try {

      await signInWithPhoneOtp(phone, otp);

      navigate('/');

    } catch (err) {

      setError(err instanceof Error ? err.message : 'Code invalide');

    } finally {

      setLoading(false);

    }

  };



  const handleDemo = async () => {

    setLoading(true);

    await signInDemo();

    navigate('/');

    setLoading(false);

  };



  return (

    <div className="min-h-dvh bg-[#f4f6f8] px-5 pb-8 pt-4">

      <div className="mx-auto max-w-[420px]">

        <div className="mb-6 text-center">
          <img
            src="/icons/logo.png"
            alt="efacture"
            className="mx-auto mb-4 h-20 w-auto aspect-[612/408] object-contain"
          />
          <h1 className="text-2xl font-bold tracking-tight">
            <span className="text-[#006d41]">e</span>
            <span className="text-[#1e3a5f]">facture</span>
          </h1>
          <p className="text-sm text-[#6b7280]">Scanner &amp; Gérer Vos Achats au Togo</p>
        </div>

        <div className="mb-4">
          <PwaInstallBanner
            canInstall={canInstall}
            isInstalled={isInstalled}
            isIos={isIos}
            onInstall={() => install()}
          />
        </div>



        {!isSupabaseConfigured && (

          <div className="mb-4 rounded-xl border border-[#006d41]/30 bg-[#e8f5ee] p-3 text-xs text-[#005533]">

            Pas de Supabase ? Utilisez le <strong>mode démo</strong> ou inscrivez-vous (données sur cet appareil).

          </div>

        )}



        <Card>

          <h2 className="mb-4 text-lg font-bold">Connexion</h2>



          <Button variant="demo" fullWidth className="mb-4" onClick={handleDemo} disabled={loading}>

            Mode démo (parcourir l&apos;app)

          </Button>



          <div className="mb-4 flex rounded-xl bg-[#f4f6f8] p-1">

            <button

              type="button"

              className={`flex-1 rounded-lg py-2 text-xs font-semibold ${tab === 'password' ? 'bg-white shadow text-[#006d41]' : 'text-[#6b7280]'}`}

              onClick={() => { setTab('password'); setError(''); }}

            >

              Mot de passe

            </button>

            <button

              type="button"

              className={`flex-1 rounded-lg py-2 text-xs font-semibold ${tab === 'otp' ? 'bg-white shadow text-[#006d41]' : 'text-[#6b7280]'}`}

              onClick={() => { setTab('otp'); setError(''); }}

            >

              Code SMS

            </button>

          </div>



          <Input

            label="Numéro de téléphone"

            type="tel"

            value={phone}

            onChange={(e) => setPhone(e.target.value)}

            placeholder="90 12 34 56"

            required

          />

          <p className="-mt-2 mb-3 text-[10px] text-[#9ca3af]">Togo (+228) — 8 chiffres</p>



          {tab === 'password' ? (

            <form onSubmit={handlePasswordLogin} className="space-y-4">

              <Input

                label="Mot de passe"

                type="password"

                value={password}

                onChange={(e) => setPassword(e.target.value)}

                required

              />

              {error && <p className="text-sm text-red-600">{error}</p>}

              <Button type="submit" fullWidth disabled={loading}>

                {loading ? 'Connexion…' : 'Se connecter'}

              </Button>

            </form>

          ) : (

            <form onSubmit={handleOtpLogin} className="space-y-4">

              {!otpSent ? (

                <Button type="button" fullWidth onClick={handleSendOtp} disabled={loading || !phone}>

                  Envoyer le code

                </Button>

              ) : (

                <>

                  {info && (

                    <div className="rounded-lg bg-blue-50 p-3 text-xs text-blue-800">

                      {info}

                      {demoCode && (

                        <p className="mt-1 font-bold text-base tracking-widest">{demoCode}</p>

                      )}

                    </div>

                  )}

                  <Input

                    label="Code reçu par SMS"

                    value={otp}

                    onChange={(e) => setOtp(e.target.value)}

                    placeholder="6 chiffres"

                    maxLength={6}

                    required

                  />

                  <Button type="submit" fullWidth disabled={loading}>

                    {loading ? 'Vérification…' : 'Valider le code'}

                  </Button>

                  <button type="button" className="w-full text-xs text-[#006d41]" onClick={handleSendOtp}>

                    Renvoyer le code

                  </button>

                </>

              )}

              {error && <p className="text-sm text-red-600">{error}</p>}

            </form>

          )}



          <p className="mt-4 text-center text-sm text-[#6b7280]">

            Pas encore de compte ?{' '}

            <Link to="/auth/inscription" className="font-semibold text-[#006d41]">

              S&apos;inscrire

            </Link>

          </p>

        </Card>

      </div>

    </div>

  );

}


