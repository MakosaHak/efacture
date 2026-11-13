import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppLayout, AppHeader } from '../components/layout/AppLayout';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { PwaInstallBanner } from '../components/pwa/PwaInstallBanner';
import { usePwaInstall } from '../hooks/usePwaInstall';
import { useAuth } from '../context/AuthContext';
import { flushOfflineQueue, getOfflineQueueCount, getValidatedInvoicesForMonth } from '../lib/invoices';
import { formatPhoneDisplay, loginPhoneFromInternalEmail } from '../lib/auth/phone-auth';
import { DEFAULT_MARGIN } from '../lib/pricing';
import { getDefaultMargin, setDefaultMargin } from '../lib/productPrices';
import { MarginPicker } from '../components/ui/MarginPicker';
import {
  buildMonthlyCsv,
  buildMonthlyPdf,
  downloadCsv,
  downloadPdf,
  monthLabelFr,
} from '../lib/export-pdf';

function currentMonthValue(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export default function ProfilePage() {
  const { user, profile, signOut, updateProfile, isLocalDemo } = useAuth();
  const { canInstall, isInstalled, isIos, install } = usePwaInstall();
  const navigate = useNavigate();
  const [monthValue, setMonthValue] = useState(currentMonthValue);
  const [exporting, setExporting] = useState<'pdf' | 'csv' | null>(null);
  const [exportMsg, setExportMsg] = useState('');
  const [queueCount, setQueueCount] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [nomCommerce, setNomCommerce] = useState('');
  const [telephone, setTelephone] = useState('');
  const [adresse, setAdresse] = useState('');
  const [quartier, setQuartier] = useState('');
  const [marge, setMarge] = useState(String(DEFAULT_MARGIN * 100));
  const [saving, setSaving] = useState(false);
  const [profileMsg, setProfileMsg] = useState('');
  const [profileError, setProfileError] = useState('');

  useEffect(() => {
    if (!user) return;
    getOfflineQueueCount(user.id).then(setQueueCount);
  }, [user]);

  useEffect(() => {
    setNomCommerce(profile?.nom_commerce || '');
    setTelephone(profile?.telephone ? formatPhoneDisplay(profile.telephone) : '');
    setAdresse(profile?.adresse || '');
    setQuartier(profile?.quartier || '');
  }, [profile]);

  useEffect(() => {
    if (!user) return;
    getDefaultMargin()
      .then((m) => setMarge(String(Math.round(m * 1000) / 10)))
      .catch(() => undefined);
  }, [user]);

  const handleSaveProfile = async (e: FormEvent) => {
    e.preventDefault();
    setProfileError('');
    setProfileMsg('');
    setSaving(true);
    try {
      await updateProfile({
        nom_commerce: nomCommerce,
        telephone,
        adresse,
        quartier,
      });
      await setDefaultMargin((marge.trim() === '' ? DEFAULT_MARGIN * 100 : Number(marge)) / 100);
      setProfileMsg(
        isLocalDemo
          ? 'Profil mis à jour pour cette session démo.'
          : 'Profil enregistré.',
      );
    } catch (err) {
      setProfileError(err instanceof Error ? err.message : 'Enregistrement impossible');
    } finally {
      setSaving(false);
    }
  };

  const loginPhone = loginPhoneFromInternalEmail(user?.email);

  const handleLogout = async () => {
    await signOut();
    navigate('/auth/connexion');
  };

  const parseMonth = () => {
    const [ys, ms] = monthValue.split('-');
    return { year: Number(ys), month: Number(ms) };
  };

  const handlePdf = async () => {
    if (!user) return;
    const { year, month } = parseMonth();
    setExporting('pdf');
    setExportMsg('');
    try {
      const invoices = await getValidatedInvoicesForMonth(user.id, year, month);
      const pdf = buildMonthlyPdf({ profile, year, month, invoices });
      downloadPdf(pdf, `efacture-${year}-${String(month).padStart(2, '0')}.pdf`);
      setExportMsg(
        invoices.length
          ? `PDF de ${monthLabelFr(year, month)} téléchargé (${invoices.length} facture${invoices.length > 1 ? 's' : ''}).`
          : `PDF téléchargé : aucune facture validée en ${monthLabelFr(year, month)}.`,
      );
    } catch {
      setExportMsg('Impossible de générer le PDF.');
    } finally {
      setExporting(null);
    }
  };

  const handleCsv = async () => {
    if (!user) return;
    const { year, month } = parseMonth();
    setExporting('csv');
    setExportMsg('');
    try {
      const invoices = await getValidatedInvoicesForMonth(user.id, year, month);
      downloadCsv(buildMonthlyCsv(invoices), `efacture-${year}-${String(month).padStart(2, '0')}.csv`);
      setExportMsg(
        invoices.length
          ? `CSV de ${monthLabelFr(year, month)} téléchargé.`
          : `CSV téléchargé : aucune facture validée en ${monthLabelFr(year, month)}.`,
      );
    } catch {
      setExportMsg('Impossible de générer le CSV.');
    } finally {
      setExporting(null);
    }
  };

  return (
    <AppLayout>
      <AppHeader title="Compte" backTo="/" />

      <div className="mb-6 text-center">
        <div className="relative mx-auto mb-3 flex h-20 w-20 items-center justify-center rounded-3xl border border-white/70 bg-gradient-to-br from-[#E2E8F0] to-[#CBD5E1] font-editorial text-3xl font-bold italic text-[#1E3A8A] shadow-neo-card">
          {(profile?.nom_commerce || user?.email || '?').charAt(0).toUpperCase()}
          <div className="absolute -bottom-0.5 -right-0.5 h-4 w-4 rounded-full border-2 border-[#E2E8F0] bg-[#10B981]" />
        </div>
        <h2 className="text-lg font-bold">{profile?.nom_commerce || 'Mon commerce'}</h2>
        <p className="text-sm text-[#64748B]">
          {loginPhone || (profile?.telephone ? formatPhoneDisplay(profile.telephone) : '—')}
        </p>
      </div>

      <form onSubmit={handleSaveProfile}>
        <Card className="mb-4 space-y-3">
          <p className="text-sm font-semibold">Informations du commerce</p>
          <Input
            label="Nom du commerce"
            value={nomCommerce}
            onChange={(e) => setNomCommerce(e.target.value)}
            placeholder="Ex: Épicerie Adawlato"
            required
          />
          <Input
            label="Téléphone (affiché)"
            type="tel"
            value={telephone}
            onChange={(e) => setTelephone(e.target.value)}
            placeholder="90 12 34 56"
          />
          {loginPhone && (
            <p className="text-[10px] leading-relaxed text-[#94A3B8]">
              Connexion : {loginPhone}. Modifier le téléphone ici change le contact (PDF), pas l’identifiant de
              connexion.
            </p>
          )}
          {isLocalDemo && (
            <p className="text-[10px] leading-relaxed text-[#94A3B8]">
              Mode démo : les modifications restent jusqu’à la déconnexion.
            </p>
          )}
          <Input
            label="Adresse"
            value={adresse}
            onChange={(e) => setAdresse(e.target.value)}
            placeholder="Marché Adawlato, Lomé"
          />
          <Input
            label="Quartier / Marché"
            value={quartier}
            onChange={(e) => setQuartier(e.target.value)}
            placeholder="Adawlato, Assivito…"
          />
          <MarginPicker value={marge} onChange={setMarge} title="Ma marge habituelle (%)" />
          {profileError && <p className="text-sm text-red-600">{profileError}</p>}
          {profileMsg && <p className="text-xs text-[#1E3A8A]">{profileMsg}</p>}
          <Button type="submit" fullWidth disabled={saving}>
            {saving ? 'Enregistrement…' : 'Enregistrer le profil'}
          </Button>
        </Card>
      </form>

      {queueCount > 0 && (
        <Card className="mb-4 border-cyan-200 bg-cyan-50">
          <p className="mb-2 text-sm font-semibold text-cyan-900">File hors-ligne</p>
          <p className="mb-3 text-xs text-cyan-800">
            {queueCount} facture{queueCount > 1 ? 's' : ''} enregistrée
            {queueCount > 1 ? 's' : ''} sur cet appareil. Envoi automatique dès que le réseau revient.
          </p>
          <Button
            type="button"
            variant="secondary"
            fullWidth
            disabled={syncing}
            onClick={async () => {
              if (!user) return;
              setSyncing(true);
              await flushOfflineQueue(user.id);
              const n = await getOfflineQueueCount(user.id);
              setQueueCount(n);
              setSyncing(false);
            }}
          >
            {syncing ? 'Envoi…' : 'Envoyer maintenant'}
          </Button>
        </Card>
      )}

      <Card className="mb-4">
        <p className="mb-3 text-sm font-semibold">Application</p>
        <PwaInstallBanner
          canInstall={canInstall}
          isInstalled={isInstalled}
          isIos={isIos}
          onInstall={() => install()}
        />
      </Card>

      <Card className="mb-4 space-y-3">
        <p className="text-sm font-semibold">Export mensuel</p>
        <p className="text-xs text-[#64748B]">
          Factures validées du mois : totaux, fournisseurs et lignes produits. Utile pour un expert-comptable.
        </p>
        <Input label="Mois" type="month" value={monthValue} onChange={(e) => setMonthValue(e.target.value)} />
        <Button type="button" fullWidth disabled={exporting !== null} onClick={handlePdf}>
          {exporting === 'pdf' ? 'Préparation…' : 'Télécharger le PDF'}
        </Button>
        <Button type="button" variant="secondary" fullWidth disabled={exporting !== null} onClick={handleCsv}>
          {exporting === 'csv' ? 'Préparation…' : 'Télécharger le CSV'}
        </Button>
        {exportMsg && <p className="text-xs text-[#1E3A8A]">{exportMsg}</p>}
      </Card>

      <Button variant="danger" fullWidth onClick={handleLogout}>
        Se déconnecter
      </Button>
    </AppLayout>
  );
}
