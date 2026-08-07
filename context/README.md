# CONTEXTE DU PROJET — efacture

> **Document de mémoire / historique de développement**  
> À lire en premier quand vous ouvrez le projet sur un **nouvel ordinateur**, un **nouveau téléphone** ou un **autre éditeur** (Cursor, VS Code, etc.).  
> Ce fichier permet à vous **et** à l’assistant IA de reprendre exactement là où vous vous êtes arrêté.

**Dernière mise à jour :** 7 août 2026  
**Auteur du projet :** Samuella01  
**Dépôt GitHub :** https://github.com/Samuella01/efacture.git

---

## 1. De quoi parle ce projet ?

**efacture** est une **PWA** (Progressive Web App) pour les **commerçants de Lomé** (marchés Adawlato, Assivito, etc.).

**Objectif :** scanner des factures papier, lire le texte automatiquement (OCR), corriger les données, puis suivre dépenses, prix et fournisseurs.

**Slogan / branding :** *Scanner & Gérer Vos Achats au Togo*

**Contrainte budget :** 0 € — pas d’API payante, pas d’hébergement payant si possible.

---

## 2. Deux projets sur le même bureau (IMPORTANT)

Sur le PC, il y a **deux codebases** dans le dossier parent :

| Dossier | Techno | Statut |
|---------|--------|--------|
| `C:\Users\User\Desktop\mon_projet_pwa\` | **Django** (Python) | **Ancien prototype** — référence seulement |
| `C:\Users\User\Desktop\mon_projet_pwa\e-facture\` | **React + Vite + Supabase** | **Application active** — c’est celle-ci qu’on développe |

> **Ne pas confondre.** Le README à la racine `mon_projet_pwa/README.md` parle du vieux Django.  
> L’application actuelle est dans **`e-facture/`**.

---

## 3. Historique chronologique (ce qu’on a fait)

### Phase 1 — Conception
- Projet initial : PWA Django pour marchés de Lomé
- Rejet des solutions payantes (Google Document AI, EasyOCR cloud, etc.)
- Décision : **React + Supabase + Netlify + Tesseract.js** (100 % gratuit)
- Rédaction du guide maître : `GUIDE_CONSTRUCTION_REACT.md` (1251 lignes) à la racine `mon_projet_pwa/`

### Phase 2 — Construction de l’app React (`e-facture/`)
- Scaffold **Vite 6 + React 18 + TypeScript + Tailwind 4**
- 10 pages : auth, dashboard, scanner, factures, validation, stats, profil
- Portage OCR depuis Django : `image-utils.ts`, `ocr-parser.ts`, `tesseract-runner.ts`
- Client Supabase + CRUD factures + analytics
- Migration SQL : `supabase/migrations/001_initial.sql`
- Config Netlify : `netlify.toml`, `public/_redirects`

### Phase 3 — Mode démo (sans Supabase)
- Parcours complet possible **sans backend** : bouton « Mode démo »
- 3 factures fictives, KPI, stats
- Comptes locaux en `localStorage` si Supabase non configuré

### Phase 4 — Authentification téléphone (Togo)
- **Plus d’email visible** pour l’utilisateur
- Numéro togolais : +228, 8 chiffres (commence par 7 ou 9)
- Connexion : **mot de passe** OU **code OTP**
- Email interne Supabase : `90123456@phone.e-facture.app` (invisible pour l’utilisateur)
- OTP **simulé** : le code s’affiche à l’écran (pas de vrai SMS sans Twilio payant)

### Phase 5 — PWA installable
- `vite-plugin-pwa` + Workbox (cache offline)
- Page de garde (splash) efacture au lancement
- Bannière d’installation (PC + Android + instructions iPhone)
- Icônes dans `public/icons/`
- Logo large (`logo.png`) pour l’UI ; icônes carrées (`icon-192.png`, `icon-512.png`) pour l’installation
- Problème résolu : logo trop petit / écrasé → regénération en mode « cover » (plein carré)

### Phase 6 — Documentation & GitHub
- README complet dans `e-facture/README.md`
- `.gitignore` sécurisé (`.env.local` jamais commité)
- `.env.example` pour modèle de variables
- Git initialisé dans `e-facture/`, commit local fait
- Remote : `https://github.com/Samuella01/efacture.git`
- **Push GitHub : en attente** — la machine était connectée au compte `MakosaHak`, pas `Samuella01`

---

## 4. Où en est le développement MAINTENANT ?

### ✅ Terminé et fonctionnel (mode démo local)

| Élément | État |
|---------|------|
| Interface complète (10 routes) | ✅ |
| Scanner + OCR Tesseract.js | ✅ |
| Validation facture + lignes produits | ✅ |
| Historique, recherche, filtres | ✅ |
| Dashboard KPI | ✅ |
| Stats prix + fournisseurs (Recharts) | ✅ |
| Auth téléphone + mot de passe | ✅ |
| OTP simulé | ✅ |
| Mode démo sans Supabase | ✅ |
| PWA installable + cache | ✅ |
| Splash / page de garde | ✅ |
| README + structure Git | ✅ |

### ⏳ Pas encore fait (production réelle)

| Élément | État | Priorité |
|---------|------|----------|
| Créer projet Supabase | ❌ | **Haute** |
| Remplir `.env.local` | ❌ | **Haute** |
| Exécuter SQL + bucket Storage | ❌ | **Haute** |
| Désactiver « Confirm email » Supabase | ❌ | **Haute** |
| Push GitHub (compte Samuella01) | ❌ | **Haute** |
| Déployer Netlify (HTTPS) | ❌ | **Haute** |
| Tester caméra mobile en prod | ❌ | Moyenne |
| SMS OTP réel (Twilio) | ❌ | Basse (payant) |
| Mot de passe oublié | ❌ | Basse |
| Édition profil | ❌ | Basse |
| Export PDF mensuel | ❌ | Basse |

---

## 5. Stack technique utilisée

```
Frontend    : React 18, Vite 6, TypeScript, Tailwind CSS 4, React Router 6
Backend     : Supabase (Auth + PostgreSQL + Storage) — pas encore branché
OCR         : Tesseract.js 5 (dans le navigateur, gratuit)
Graphiques  : Recharts
PWA         : vite-plugin-pwa, Workbox
Déploiement : Netlify (prévu)
Éditeur     : Cursor
OS dev      : Windows 10/11
```

### Versions clés (`package.json`)
- `vite`: ^6.0.3
- `react`: ^18.3.1
- `@supabase/supabase-js`: ^2.49.1
- `tesseract.js`: ^5.1.1
- `vite-plugin-pwa`: ^0.21.1
- `tailwindcss`: ^4.0.6

---

## 6. Architecture du code

```
e-facture/
├── public/icons/          → logo.png (UI), icon-512/192 (PWA install)
├── src/
│   ├── pages/             → 10 écrans
│   ├── components/
│   │   ├── layout/        → AppLayout, BottomNav, ProtectedRoute
│   │   ├── pwa/           → SplashScreen, PwaInstallBanner, PwaUpdateToast
│   │   ├── ui/            → Button, Card, Input
│   │   └── invoices/      → InvoiceThumbnail, InvoiceStatusBadge
│   ├── context/
│   │   └── AuthContext.tsx    → auth centrale (phone, demo, supabase)
│   ├── hooks/
│   │   └── usePwaInstall.ts
│   ├── lib/
│   │   ├── supabase.ts
│   │   ├── invoices.ts        → CRUD + analytics (bascule demo/supabase)
│   │   ├── auth/
│   │   │   ├── phone-auth.ts
│   │   │   ├── otp-service.ts
│   │   │   └── local-phone-users.ts
│   │   ├── demo/
│   │   │   ├── demo-mode.ts
│   │   │   └── demo-store.ts
│   │   └── ocr/
│   │       ├── image-utils.ts
│   │       ├── ocr-parser.ts
│   │       └── tesseract-runner.ts
│   └── types/invoice.ts
├── supabase/migrations/001_initial.sql
├── context/README.md      → CE FICHIER (mémoire du projet)
├── vite.config.ts         → PWA + server host:true
├── netlify.toml
├── .env.example           → modèle (sans vraies clés)
└── README.md              → doc publique GitHub
```

---

## 7. Routes de l’application

| URL | Page |
|-----|------|
| `/auth/connexion` | Connexion |
| `/auth/inscription` | Inscription |
| `/` | Dashboard |
| `/scanner` | Scanner facture |
| `/factures` | Liste factures |
| `/factures/:id` | Détail |
| `/factures/:id/valider` | Validation OCR |
| `/stats/prix` | Comparateur prix |
| `/stats/fournisseurs` | Stats fournisseurs |
| `/profil` | Profil + install PWA |

---

## 8. Authentification — comment ça marche

### Avec Supabase (production)
1. User entre `90 12 34 56` + mot de passe
2. App convertit en email interne : `90123456@phone.e-facture.app`
3. `supabase.auth.signUp` / `signInWithPassword`
4. Profil inséré dans table `profiles`

### Sans Supabase (développement)
1. Comptes stockés en clair dans `localStorage` (`efacture-local-users`)
2. Session dans `sessionStorage`
3. Bouton « Mode démo » → données fictives, pas de compte requis

### OTP
- Code généré côté client, affiché à l’écran
- Stocké temporairement en `sessionStorage`
- **Pas de vrai SMS** pour l’instant

---

## 9. Parcours scan facture

```
/scanner → photo/galerie
  → compressFile() (JPEG optimisé)
  → runTesseract() (Tesseract.js)
  → parseReceiptText() (ocr-parser.ts)
  → saveScannedInvoice() → Supabase Storage + DB (ou demo-store)
  → /factures/:id/valider
  → utilisateur corrige → validateInvoice()
  → dashboard/stats mis à jour
```

---

## 10. PWA — ce qui est configuré

- **Manifest** : nom `efacture`, theme `#006d41`, background `#ffffff`
- **Service Worker** : precache assets, CacheFirst fonts, NetworkFirst Supabase
- **Splash** : HTML instantané (`index.html`) + React (`SplashScreen.tsx`)
- **Install** : `usePwaInstall.ts` + `PwaInstallBanner.tsx`
- **Mises à jour** : `PwaUpdateToast.tsx`
- **Dev PWA** : `devOptions.enabled: true` dans `vite.config.ts`
- **Caméra mobile** : nécessite **HTTPS** → Netlify obligatoire pour test téléphone réel

### Icônes
| Fichier | Usage |
|---------|-------|
| `public/icons/logo.png` | Affichage UI (splash, login) — ratio 3:2 |
| `public/icons/icon-512.png` | Installation PWA (512×512 carré) |
| `public/icons/icon-192.png` | Installation PWA (192×192) |
| `public/icons/apple-touch-icon.png` | iPhone (180×180) |
| `public/favicon.png` | Favicon navigateur |

---

## 11. Variables d’environnement

### Fichiers
| Fichier | Commit Git ? | Rôle |
|---------|--------------|------|
| `.env.example` | ✅ Oui | Modèle |
| `.env.local` | ❌ **Jamais** | Vos clés locales |
| Netlify dashboard | — | Clés production |

### Variables requises
```env
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

Copier `.env.example` → `.env.local` puis remplir.

---

## 12. Commandes essentielles

```powershell
# Aller dans le projet actif
cd C:\Users\User\Desktop\mon_projet_pwa\e-facture

# Installer les dépendances
npm install

# Lancer en dev (PC + réseau local téléphone)
npm run dev
# → http://localhost:5173
# → http://172.x.x.x:5173 (Network, même Wi-Fi)

# Build production
npm run build
npm run preview

# Git — pousser sur GitHub (compte Samuella01)
git push -u origin main
```

### Problème npm SSL (réseau campus / Wi-Fi)
Le fichier `.npmrc` contient `strict-ssl=false` pour contourner les certificats réseau locaux.

---

## 13. Supabase — étapes à faire (pas encore fait)

1. Créer projet sur https://supabase.com
2. SQL Editor → exécuter `supabase/migrations/001_initial.sql`
3. Storage → bucket `invoice-photos` (privé)
4. Exécuter les 3 policies Storage (fin du fichier SQL, section commentée)
5. Auth → Email → **désactiver Confirm email**
6. Copier URL + clé anon dans `.env.local`
7. Auth → URL Configuration → ajouter localhost + URL Netlify

---

## 14. Netlify — étapes à faire (pas encore fait)

1. Connecter repo GitHub `Samuella01/efacture`
2. Build : `npm run build` | Publish : `dist`
3. Variables : `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
4. Tester HTTPS sur téléphone (caméra)

---

## 15. Git / GitHub — état actuel

```
Dossier git  : e-facture/ (pas mon_projet_pwa/)
Branche      : main
Dernier commit : e4006b0 — "docs: add README and prepare GitHub repository"
Remote       : https://github.com/Samuella01/efacture.git
Push         : EN ATTENTE (auth MakosaHak vs Samuella01)
```

Pour pousser :
```powershell
cd e-facture
gh auth login   # ou git credential manager avec Samuella01
git push -u origin main
```

---

## 16. Décisions importantes (ne pas revenir en arrière sans raison)

| Décision | Pourquoi |
|----------|----------|
| React au lieu de Django | Déploiement gratuit Netlify, pas de serveur Python |
| Tesseract.js dans le navigateur | OCR gratuit, pas de serveur OCR |
| Supabase | Auth + DB + Storage gratuit |
| Auth par téléphone | Commerçants togolais n’utilisent pas l’email |
| Email interne pour Supabase | Supabase Auth exige un email ; contournement propre |
| OTP simulé | SMS réel = Twilio payant |
| Mode démo local | Permet soutenance / tests sans config Supabase |
| PWA | Installable comme une app native, pas besoin Play Store |
| Logo wide + icônes carrées | UI proportionnée + install OS conforme |

---

## 17. Problèmes connus et solutions

| Problème | Solution |
|----------|----------|
| npm install échoue (SSL) | `.npmrc` avec `strict-ssl=false` |
| Logo écrasé en UI | `aspect-[612/408]` + `object-contain` sur `logo.png` |
| Icône install trop petite | Icônes carrées regénérées en mode cover |
| Caméra ne marche pas sur tel | Utiliser Netlify HTTPS, pas IP locale |
| Bannière « Pas de Supabase » | Créer `.env.local` avec les clés |
| Push GitHub 403 | Se connecter avec compte Samuella01 |
| Ancienne icône après install | Désinstaller PWA et réinstaller |

---

## 18. Documents de référence

| Fichier | Contenu |
|---------|---------|
| `e-facture/README.md` | Doc publique GitHub |
| `e-facture/context/README.md` | **Ce fichier** — mémoire / historique |
| `mon_projet_pwa/GUIDE_CONSTRUCTION_REACT.md` | Guide construction complet (1251 lignes) |
| `mon_projet_pwa/README.md` | Ancien projet Django (ne pas utiliser) |
| `e-facture/supabase/migrations/001_initial.sql` | Schéma base de données |

---

## 19. Prochaines actions (dans l’ordre)

```
1. [ ] git push avec compte Samuella01
2. [ ] Créer projet Supabase
3. [ ] .env.local + SQL + bucket Storage
4. [ ] Tester inscription + scan avec Supabase en local
5. [ ] Déployer Netlify + variables d'env
6. [ ] Tester install PWA + caméra sur téléphone
7. [ ] Préparer soutenance / démo
```

---

## 20. Message pour l’assistant IA (nouvel éditeur)

Si vous ouvrez ce projet dans Cursor ou un autre éditeur avec IA, copiez ceci :

> **Projet actif :** `e-facture/` (React PWA, pas Django).  
> **Objectif :** app efacture pour commerçants Lomé — scan factures, OCR Tesseract.js, Supabase.  
> **État :** UI + PWA + mode démo **terminés**. Supabase + Netlify + push GitHub **pas encore faits**.  
> **Auth :** téléphone Togo (+228), OTP simulé.  
> **Lire :** `context/README.md` et `e-facture/README.md` avant toute modification.

---

*Fichier créé pour conserver la mémoire du projet lors du changement d’ordinateur ou d’éditeur.*
