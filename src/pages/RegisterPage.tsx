import { useState, type FormEvent } from 'react';

import { Link, Navigate, useNavigate } from 'react-router-dom';

import { useAuth } from '../context/AuthContext';

import { Button } from '../components/ui/Button';

import { Card } from '../components/ui/Card';

import { Input } from '../components/ui/Input';



type Tab = 'password' | 'otp';

type OtpStep = 'phone' | 'verify';



export default function RegisterPage() {

  const { user, signUpWithPhonePassword, signUpWithPhoneOtp, sendOtp } = useAuth();

  const navigate = useNavigate();

  const [tab, setTab] = useState<Tab>('password');

  const [otpStep, setOtpStep] = useState<OtpStep>('phone');

  const [nomCommerce, setNomCommerce] = useState('');

  const [phone, setPhone] = useState('');

  const [password, setPassword] = useState('');

  const [confirmPassword, setConfirmPassword] = useState('');

  const [quartier, setQuartier] = useState('');

  const [otp, setOtp] = useState('');

  const [demoCode, setDemoCode] = useState('');

  const [info, setInfo] = useState('');

  const [error, setError] = useState('');

  const [loading, setLoading] = useState(false);



  if (user) return <Navigate to="/" replace />;



  const profileInput = {

    nom_commerce: nomCommerce.trim(),

    telephone: phone,

    adresse: '',

    quartier: quartier.trim(),

  };



  const handlePasswordRegister = async (e: FormEvent) => {

    e.preventDefault();

    setError('');

    if (password !== confirmPassword) {

      setError('Les mots de passe ne correspondent pas.');

      return;

    }

    setLoading(true);

    try {

      await signUpWithPhonePassword(phone, password, profileInput);

      navigate('/');

    } catch (err) {

      setError(err instanceof Error ? err.message : 'Inscription impossible');

    } finally {

      setLoading(false);

    }

  };



  const handleSendOtp = async () => {

    setError('');

    setInfo('');

    if (!nomCommerce.trim()) {

      setError('Indiquez le nom de votre commerce.');

      return;

    }

    setLoading(true);

    try {

      const result = await sendOtp(phone);

      setOtpStep('verify');

      setInfo(result.message);

      if (result.demoCode) setDemoCode(result.demoCode);

    } catch (err) {

      setError(err instanceof Error ? err.message : 'Envoi impossible');

    } finally {

      setLoading(false);

    }

  };



  const handleOtpRegister = async (e: FormEvent) => {

    e.preventDefault();

    setError('');

    setLoading(true);

    try {

      await signUpWithPhoneOtp(phone, otp, profileInput, password || undefined);

      navigate('/');

    } catch (err) {

      setError(err instanceof Error ? err.message : 'Inscription impossible');

    } finally {

      setLoading(false);

    }

  };



  return (

    <div className="min-h-dvh bg-[#f4f6f8] px-5 py-8">

      <div className="mx-auto max-w-[420px]">

        <Card>

          <h2 className="mb-1 text-lg font-bold">Créer un compte</h2>

          <p className="mb-4 text-xs text-[#6b7280]">

            Commerçants TPME — téléphone togolais, pas d&apos;email requis.

          </p>



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

              onClick={() => { setTab('otp'); setError(''); setOtpStep('phone'); }}

            >

              Code SMS

            </button>

          </div>



          <Input

            label="Nom du commerce"

            value={nomCommerce}

            onChange={(e) => setNomCommerce(e.target.value)}

            placeholder="Ex: Épicerie Adawlato"

            required

          />



          <Input

            label="Numéro de téléphone"

            type="tel"

            value={phone}

            onChange={(e) => setPhone(e.target.value)}

            placeholder="90 12 34 56"

            required

          />

          <p className="-mt-2 mb-3 text-[10px] text-[#9ca3af]">Togo (+228)</p>



          <Input

            label="Quartier / Marché (optionnel)"

            placeholder="Adawlato, Assivito…"

            value={quartier}

            onChange={(e) => setQuartier(e.target.value)}

          />



          {tab === 'password' ? (

            <form onSubmit={handlePasswordRegister} className="mt-4 space-y-4">

              <Input

                label="Mot de passe"

                type="password"

                value={password}

                onChange={(e) => setPassword(e.target.value)}

                minLength={6}

                required

              />

              <Input

                label="Confirmer le mot de passe"

                type="password"

                value={confirmPassword}

                onChange={(e) => setConfirmPassword(e.target.value)}

                minLength={6}

                required

              />

              {error && <p className="text-sm text-red-600">{error}</p>}

              <Button type="submit" fullWidth disabled={loading}>

                {loading ? 'Création…' : 'Créer mon compte'}

              </Button>

            </form>

          ) : otpStep === 'phone' ? (

            <div className="mt-4 space-y-4">

              <p className="text-xs text-[#6b7280]">

                Nous enverrons un code à votre numéro pour confirmer l&apos;inscription.

              </p>

              {error && <p className="text-sm text-red-600">{error}</p>}

              <Button type="button" fullWidth onClick={handleSendOtp} disabled={loading}>

                Envoyer le code SMS

              </Button>

            </div>

          ) : (

            <form onSubmit={handleOtpRegister} className="mt-4 space-y-4">

              {info && (

                <div className="rounded-lg bg-blue-50 p-3 text-xs text-blue-800">

                  {info}

                  {demoCode && (

                    <p className="mt-1 font-bold text-base tracking-widest">{demoCode}</p>

                  )}

                </div>

              )}

              <Input

                label="Code SMS"

                value={otp}

                onChange={(e) => setOtp(e.target.value)}

                placeholder="6 chiffres"

                maxLength={6}

                required

              />

              <Input

                label="Mot de passe (optionnel)"

                type="password"

                value={password}

                onChange={(e) => setPassword(e.target.value)}

                placeholder="Pour se connecter sans SMS plus tard"

              />

              {error && <p className="text-sm text-red-600">{error}</p>}

              <Button type="submit" fullWidth disabled={loading}>

                {loading ? 'Validation…' : 'Terminer l\'inscription'}

              </Button>

            </form>

          )}



          <p className="mt-4 text-center text-sm text-[#6b7280]">

            Déjà un compte ?{' '}

            <Link to="/auth/connexion" className="font-semibold text-[#006d41]">

              Se connecter

            </Link>

          </p>

        </Card>

      </div>

    </div>

  );

}


