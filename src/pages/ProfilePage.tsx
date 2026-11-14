import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Camera, ChevronDown, ChevronUp, CloudOff, Cloud, Download, HardDrive, KeyRound, LogOut, RefreshCw, Trash2 } from 'lucide-react';
import { AppLayout, AppHeader } from '../components/layout/AppLayout';
import { Card, SectionTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Notice } from '../components/ui/Feedback';
import { Avatar } from '../components/ui/Avatar';
import { PwaInstallBanner } from '../components/pwa/PwaInstallBanner';
import { usePwaInstall } from '../hooks/usePwaInstall';
import { useAuth } from '../context/AuthContext';
import { getValidatedInvoicesForMonth } from '../lib/invoices';
import { formatPhoneDisplay } from '../lib/auth/phone-auth';
import { DEFAULT_MARGIN } from '../lib/pricing';
import { getDefaultMargin, setDefaultMargin } from '../lib/productPrices';
import { compressFile } from '../lib/ocr/image-utils';
import { MarginPicker } from '../components/ui/MarginPicker';
import { buildMonthlyPdf, downloadPdf, monthLabelFr } from '../lib/export-pdf';

function currentMonthValue(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export default function ProfilePage() {
  const { user, profile, signOut, updateProfile, updateAvatar, removeAvatar, changePassword, sync, cloudEnabled, syncNow } = useAuth();
  const { canInstall, isInstalled, isIos, install } = usePwaInstall();
  const navigate = useNavigate();
  const avatarInput = useRef<HTMLInputElement>(null);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [avatarMsg, setAvatarMsg] = useState('');
  const [monthValue, setMonthValue] = useState(currentMonthValue);
  const [exporting, setExporting] = useState(false);
  const [exportMsg, setExportMsg] = useState('');
  const [nomPersonne, setNomPersonne] = useState('');
  const [nomCommerce, setNomCommerce] = useState('');
  const [telephone, setTelephone] = useState('');
  const [adresse, setAdresse] = useState('');
  const [quartier, setQuartier] = useState('');
  const [marge, setMarge] = useState(String(DEFAULT_MARGIN * 100));
  const [saving, setSaving] = useState(false);
  const [profileMsg, setProfileMsg] = useState('');
  const [profileError, setProfileError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [pwdCurrent, setPwdCurrent] = useState('');
  const [pwdNext, setPwdNext] = useState('');
  const [pwdMsg, setPwdMsg] = useState('');
  const [pwdError, setPwdError] = useState('');
  const [pwdSaving, setPwdSaving] = useState(false);

  useEffect(() => {
    setNomPersonne(profile?.nom_personne || '');
    setNomCommerce(profile?.nom_commerce || '');
    setTelephone(profile?.telephone ? formatPhoneDisplay(profile.telephone) : '');
    setAdresse(profile?.adresse || '');
    setQuartier(profile?.quartier || '');
  }, [profile]);

  useEffect(() => {
    if (!user) return;
    getDefaultMargin(user.id)
      .then((m) => setMarge(String(Math.round(m * 1000) / 10)))
      .catch(() => undefined);
  }, [user]);

  const handleAvatarFile = async (file: File) => {
    setAvatarMsg('');
    setAvatarBusy(true);
    try {
      const small = await compressFile(file, 512, 0.85);
      await updateAvatar(small);
      setAvatarMsg('Photo de profil mise à jour.');
    } catch (err) {
      setAvatarMsg(err instanceof Error ? err.message : 'Photo impossible à enregistrer.');
    } finally {
      setAvatarBusy(false);
    }
  };

  const handleSaveProfile = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setProfileError('');
    setProfileMsg('');
    setSaving(true);
    try {
      await updateProfile({ nom_personne: nomPersonne, nom_commerce: nomCommerce, telephone, adresse, quartier });
      await setDefaultMargin(user.id, (marge.trim() === '' ? DEFAULT_MARGIN * 100 : Number(marge)) / 100);
      setProfileMsg('Modifications enregistrées.');
    } catch (err) {
      setProfileError(err instanceof Error ? err.message : 'Enregistrement impossible');
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async (e: FormEvent) => {
    e.preventDefault();
    setPwdError('');
    setPwdMsg('');
    setPwdSaving(true);
    try {
      await changePassword(pwdCurrent, pwdNext);
      setPwdMsg('Mot de passe modifié.');
      setPwdCurrent('');
      setPwdNext('');
    } catch (err) {
      setPwdError(err instanceof Error ? err.message : 'Modification impossible');
    } finally {
      setPwdSaving(false);
    }
  };

  const handleLogout = async () => {
    await signOut();
    navigate('/auth/connexion', { replace: true });
  };

  const parseMonth = () => {
    const [ys, ms] = monthValue.split('-');
    return { year: Number(ys), month: Number(ms) };
  };

  const runExport = async () => {
    if (!user) return;
    const { year, month } = parseMonth();
    setExporting(true);
    setExportMsg('');
    try {
      const invoices = await getValidatedInvoicesForMonth(user.id, year, month);
      downloadPdf(buildMonthlyPdf({ profile, year, month, invoices }), `efacture-${year}-${String(month).padStart(2, '0')}.pdf`);
      setExportMsg(
        invoices.length
          ? `Relevé de ${monthLabelFr(year, month)} téléchargé (${invoices.length} reçu${invoices.length > 1 ? 's' : ''}).`
          : `Aucun reçu validé en ${monthLabelFr(year, month)} : relevé vide téléchargé.`,
      );
    } catch {
      setExportMsg('Impossible de générer le PDF.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <AppLayout>
      <AppHeader title="Mon compte" backTo="/" />

      <Card className="mb-4">
        <div className="flex items-center gap-4">
          <div className="relative shrink-0">
            <Avatar path={profile?.avatar_path} name={profile?.nom_personne || profile?.nom_commerce} size={72} />
            <button
              type="button"
              onClick={() => avatarInput.current?.click()}
              disabled={avatarBusy}
              className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full border-2 border-surface bg-primary text-white shadow-card disabled:opacity-60"
              aria-label="Changer la photo de profil"
            >
              <Camera size={15} />
            </button>
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-lg font-semibold text-ink">{profile?.nom_personne || profile?.nom_commerce || 'Mon compte'}</h2>
            {profile?.nom_personne && <p className="truncate text-[13px] text-ink-2">{profile.nom_commerce}</p>}
            <p className="text-[13px] text-muted">{user ? formatPhoneDisplay(user.phone) : ''}</p>
            <div className="mt-2 flex gap-3 text-[13px] font-medium">
              <button type="button" className="text-primary" onClick={() => avatarInput.current?.click()} disabled={avatarBusy}>
                {profile?.avatar_path ? 'Changer la photo' : 'Ajouter une photo'}
              </button>
              {profile?.avatar_path && (
                <button type="button" className="inline-flex items-center gap-1 text-muted" onClick={() => removeAvatar()} disabled={avatarBusy}>
                  <Trash2 size={13} /> Retirer
                </button>
              )}
            </div>
          </div>
        </div>
        {avatarMsg && (
          <Notice tone={/impossible/i.test(avatarMsg) ? 'danger' : 'success'} className="mt-3">
            {avatarMsg}
          </Notice>
        )}
        <input
          ref={avatarInput}
          type="file"
          accept="image/*"
          capture="user"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (f) void handleAvatarFile(f);
          }}
        />
      </Card>

      <form onSubmit={handleSaveProfile} className="mb-4">
        <SectionTitle>Mon commerce</SectionTitle>
        <Card className="space-y-3">
          <Input label="Votre nom" value={nomPersonne} onChange={(e) => setNomPersonne(e.target.value)} placeholder="Ex. : Afi KOUMAKO" autoComplete="name" />
          <Input label="Nom du commerce" value={nomCommerce} onChange={(e) => setNomCommerce(e.target.value)} placeholder="Ex. : Épicerie Adawlato" required />
          <Input label="Téléphone affiché sur les exports" type="tel" inputMode="numeric" value={telephone} onChange={(e) => setTelephone(e.target.value)} placeholder="90 12 34 56" />
          <Input label="Adresse" value={adresse} onChange={(e) => setAdresse(e.target.value)} placeholder="Marché Adawlato, Lomé" />
          <Input label="Quartier ou marché" value={quartier} onChange={(e) => setQuartier(e.target.value)} placeholder="Adawlato, Assivito…" />
          <div className="border-t border-line pt-3">
            <MarginPicker value={marge} onChange={setMarge} title="Ma marge habituelle" />
          </div>
          {profileError && <Notice tone="danger">{profileError}</Notice>}
          {profileMsg && <Notice tone="success">{profileMsg}</Notice>}
          <Button type="submit" fullWidth loading={saving}>
            Enregistrer
          </Button>
        </Card>
      </form>

      <section className="mb-4">
        <SectionTitle>Relevé mensuel</SectionTitle>
        <Card className="space-y-3">
          <p className="text-[13px] leading-relaxed text-muted">Un PDF des reçus validés du mois : totaux, fournisseurs et articles. Pratique à garder ou à montrer à un comptable.</p>
          <Input label="Mois" type="month" value={monthValue} onChange={(e) => setMonthValue(e.target.value)} />
          <Button type="button" fullWidth loading={exporting} onClick={runExport}>
            <Download size={16} />
            Télécharger le PDF
          </Button>
          {exportMsg && <Notice tone="neutral">{exportMsg}</Notice>}
        </Card>
      </section>

      <section className="mb-4">
        <SectionTitle>Sécurité</SectionTitle>
        <Card padding="none">
          <button type="button" onClick={() => setShowPassword((v) => !v)} className="flex w-full items-center gap-3 px-4 py-3 text-left" aria-expanded={showPassword}>
            <div className="flex h-10 w-10 items-center justify-center rounded-[12px] bg-violet-soft text-violet">
              <KeyRound size={18} />
            </div>
            <span className="flex-1 text-[15px] font-medium text-ink">Changer le mot de passe</span>
            {showPassword ? <ChevronUp size={18} className="text-faint" /> : <ChevronDown size={18} className="text-faint" />}
          </button>
          {showPassword && (
            <form onSubmit={handleChangePassword} className="space-y-3 border-t border-line px-4 py-4">
              <Input label="Mot de passe actuel" type="password" autoComplete="current-password" value={pwdCurrent} onChange={(e) => setPwdCurrent(e.target.value)} required />
              <Input label="Nouveau mot de passe" type="password" autoComplete="new-password" minLength={6} value={pwdNext} onChange={(e) => setPwdNext(e.target.value)} hint="6 caractères minimum" required />
              {pwdError && <Notice tone="danger">{pwdError}</Notice>}
              {pwdMsg && <Notice tone="success">{pwdMsg}</Notice>}
              <Button type="submit" variant="secondary" fullWidth loading={pwdSaving}>
                Modifier
              </Button>
            </form>
          )}
        </Card>
      </section>

      <section className="mb-4">
        <SectionTitle>Application</SectionTitle>
        <div className="space-y-2">
          <PwaInstallBanner canInstall={canInstall} isInstalled={isInstalled} isIos={isIos} onInstall={() => install()} />
          {cloudEnabled ? (
            <Card padding="sm" className="flex items-center gap-3">
              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] ${sync.status === 'error' ? 'bg-danger-soft text-danger' : sync.status === 'offline' ? 'bg-amber-soft text-amber' : 'bg-success-soft text-success'}`}>
                {sync.status === 'offline' ? <CloudOff size={18} /> : <Cloud size={18} />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-medium text-ink">
                  {sync.status === 'syncing'
                    ? 'Synchronisation en cours…'
                    : sync.status === 'offline'
                      ? 'Hors connexion'
                      : sync.status === 'error'
                        ? 'Synchronisation en erreur'
                        : sync.pending > 0
                          ? `${sync.pending} élément${sync.pending > 1 ? 's' : ''} à envoyer`
                          : 'Synchronisé avec le cloud'}
                </p>
                <p className="truncate text-xs text-muted">
                  {sync.status === 'error' && sync.error
                    ? sync.error
                    : sync.lastSyncAt
                      ? `Dernière synchronisation : ${new Date(sync.lastSyncAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`
                      : 'Vos données sont aussi sauvegardées en ligne et retrouvées sur vos autres appareils.'}
                </p>
              </div>
              <button type="button" onClick={() => void syncNow()} className="flex h-9 w-9 items-center justify-center rounded-full text-muted hover:bg-surface-2" aria-label="Synchroniser maintenant" disabled={sync.status === 'syncing'}>
                <RefreshCw size={16} className={sync.status === 'syncing' ? 'animate-spin' : ''} />
              </button>
            </Card>
          ) : (
            <Notice tone="neutral">
              <span className="flex items-start gap-2">
                <HardDrive size={16} className="mt-0.5 shrink-0" />
                <span>Vos reçus, photos et prix sont enregistrés sur cet appareil uniquement. Pensez à exporter chaque mois.</span>
              </span>
            </Notice>
          )}
        </div>
      </section>

      <Button variant="danger" fullWidth onClick={handleLogout}>
        <LogOut size={18} />
        Se déconnecter
      </Button>
    </AppLayout>
  );
}
