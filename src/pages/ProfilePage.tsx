import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, ChevronUp, Download, HardDrive, KeyRound, LogOut } from 'lucide-react';
import { AppLayout, AppHeader } from '../components/layout/AppLayout';
import { Card, SectionTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Notice } from '../components/ui/Feedback';
import { PwaInstallBanner } from '../components/pwa/PwaInstallBanner';
import { usePwaInstall } from '../hooks/usePwaInstall';
import { useAuth } from '../context/AuthContext';
import { getValidatedInvoicesForMonth } from '../lib/invoices';
import { formatPhoneDisplay } from '../lib/auth/phone-auth';
import { DEFAULT_MARGIN } from '../lib/pricing';
import { getDefaultMargin, setDefaultMargin } from '../lib/productPrices';
import { MarginPicker } from '../components/ui/MarginPicker';
import { buildMonthlyCsv, buildMonthlyPdf, downloadCsv, downloadPdf, monthLabelFr } from '../lib/export-pdf';

function currentMonthValue(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export default function ProfilePage() {
  const { user, profile, signOut, updateProfile, changePassword, isDemo } = useAuth();
  const { canInstall, isInstalled, isIos, install } = usePwaInstall();
  const navigate = useNavigate();
  const [monthValue, setMonthValue] = useState(currentMonthValue);
  const [exporting, setExporting] = useState<'pdf' | 'csv' | null>(null);
  const [exportMsg, setExportMsg] = useState('');
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

  const handleSaveProfile = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setProfileError('');
    setProfileMsg('');
    setSaving(true);
    try {
      await updateProfile({ nom_commerce: nomCommerce, telephone, adresse, quartier });
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

  const runExport = async (kind: 'pdf' | 'csv') => {
    if (!user) return;
    const { year, month } = parseMonth();
    setExporting(kind);
    setExportMsg('');
    try {
      const invoices = await getValidatedInvoicesForMonth(user.id, year, month);
      const name = `efacture-${year}-${String(month).padStart(2, '0')}`;
      if (kind === 'pdf') downloadPdf(buildMonthlyPdf({ profile, year, month, invoices }), `${name}.pdf`);
      else downloadCsv(buildMonthlyCsv(invoices), `${name}.csv`);
      setExportMsg(
        invoices.length
          ? `${kind.toUpperCase()} de ${monthLabelFr(year, month)} téléchargé (${invoices.length} reçu${invoices.length > 1 ? 's' : ''}).`
          : `Aucun reçu validé en ${monthLabelFr(year, month)} : fichier vide téléchargé.`,
      );
    } catch {
      setExportMsg('Impossible de générer le fichier.');
    } finally {
      setExporting(null);
    }
  };

  const initial = (profile?.nom_commerce || '?').trim().charAt(0).toUpperCase();

  return (
    <AppLayout>
      <AppHeader title="Mon compte" backTo="/" />

      <div className="mb-5 flex items-center gap-4">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary-soft text-xl font-bold text-primary-ink">
          {initial}
        </div>
        <div className="min-w-0">
          <h2 className="truncate text-lg font-semibold text-ink">{profile?.nom_commerce || 'Mon commerce'}</h2>
          <p className="text-[13px] text-muted">{user ? formatPhoneDisplay(user.phone) : ''}</p>
        </div>
      </div>

      {isDemo && (
        <Notice tone="info" className="mb-4">
          Compte de démonstration avec des données d’exemple. Créez votre propre compte pour vos vrais reçus.
        </Notice>
      )}

      <form onSubmit={handleSaveProfile} className="mb-4">
        <SectionTitle>Mon commerce</SectionTitle>
        <Card className="space-y-3">
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
        <SectionTitle>Export mensuel</SectionTitle>
        <Card className="space-y-3">
          <p className="text-[13px] leading-relaxed text-muted">Reçus validés du mois avec totaux, fournisseurs et articles. Pratique pour un comptable.</p>
          <Input label="Mois" type="month" value={monthValue} onChange={(e) => setMonthValue(e.target.value)} />
          <div className="grid grid-cols-2 gap-2">
            <Button type="button" variant="secondary" loading={exporting === 'pdf'} disabled={exporting !== null} onClick={() => runExport('pdf')}>
              <Download size={16} />
              PDF
            </Button>
            <Button type="button" variant="secondary" loading={exporting === 'csv'} disabled={exporting !== null} onClick={() => runExport('csv')}>
              <Download size={16} />
              CSV
            </Button>
          </div>
          {exportMsg && <Notice tone="neutral">{exportMsg}</Notice>}
        </Card>
      </section>

      <section className="mb-4">
        <SectionTitle>Sécurité</SectionTitle>
        <Card padding="none">
          <button type="button" onClick={() => setShowPassword((v) => !v)} className="flex w-full items-center gap-3 px-4 py-3 text-left" aria-expanded={showPassword}>
            <div className="flex h-10 w-10 items-center justify-center rounded-[10px] bg-surface-2 text-ink-2">
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
          <Notice tone="neutral">
            <span className="flex items-start gap-2">
              <HardDrive size={16} className="mt-0.5 shrink-0" />
              <span>Vos reçus, photos et prix sont enregistrés sur cet appareil uniquement. Pensez à exporter chaque mois.</span>
            </span>
          </Notice>
        </div>
      </section>

      <Button variant="danger" fullWidth onClick={handleLogout}>
        <LogOut size={18} />
        Se déconnecter
      </Button>
    </AppLayout>
  );
}
