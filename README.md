# efacture

**Scanner & Gérer Vos Achats au Togo**

Application web progressive (PWA) pour les commerçants de Lomé (Adawlato, Assivito, etc.) : photographier une facture, lire le texte automatiquement (OCR), valider les données et suivre dépenses, prix et fournisseurs.

> Budget cible : **0 €** — React, Supabase (gratuit), Tesseract.js (OCR dans le navigateur), Netlify (hébergement).

---

## Sommaire

- [Fonctionnalités](#fonctionnalités)
- [Stack technique](#stack-technique)
- [Architecture](#architecture)
- [Pages et navigation](#pages-et-navigation)
- [Authentification](#authentification)
- [Parcours scan d'une facture](#parcours-scan-dune-facture)
- [Prix de vente suggérés](#prix-de-vente-suggérés)
- [Mode démo vs production](#mode-démo-vs-production)
- [PWA (installation)](#pwa-installation)
- [Installation locale](#installation-locale)
- [Configuration Supabase](#configuration-supabase)
- [Déploiement Netlify](#déploiement-netlify)
- [Variables d'environnement](#variables-denvironnement)
- [Structure du projet](#structure-du-projet)
- [Sécurité](#sécurité)
- [Ce qui reste à faire](#ce-qui-reste-à-faire)

---

## Fonctionnalités

| Fonctionnalité | Description |
|----------------|-------------|
| **Inscription / Connexion** | Téléphone togolais (+228, 8 chiffres) + mot de passe |
| **Scanner** | Caméra ou import galerie → compression image → OCR |
| **Validation** | Correction fournisseur, date, lignes produits, montant |
| **Historique** | Liste des factures, recherche, filtres par statut |
| **Dashboard** | KPI du mois (dépenses, factures, inflation estimée) |
| **Stats prix** | Évolution des prix, alertes hausse |
| **Stats fournisseurs** | Dépenses par grossiste / marché |
| **Prix de vente suggérés** | Après validation, un prix de vente proposé par produit ; marge apprise par produit |
| **Profil** | Infos commerce éditables, marge habituelle, export PDF/CSV, installation PWA |
| **PWA** | Installable sur mobile et PC, cache offline, page de garde |
| **File hors-ligne** | Scan sans réseau → IndexedDB → envoi auto à la reconnexion |

---

## Stack technique

| Couche | Technologie |
|--------|-------------|
| Frontend | React 18 + Vite 6 + TypeScript |
| Styles | Tailwind CSS 4 |
| Routing | React Router 6 |
| Backend | Supabase (Auth, PostgreSQL, Storage) |
| OCR | Tesseract.js (100 % navigateur, gratuit) |
| Graphiques | Recharts |
| PWA | vite-plugin-pwa + Workbox |
| Déploiement | Netlify |

---

## Architecture

```
┌─────────────────────────────────────────┐
│  Navigateur (PWA React)                  │
│  Pages → OCR (Tesseract.js) → Supabase  │
└──────────────────┬──────────────────────┘
                   │ HTTPS
┌──────────────────▼──────────────────────┐
│  Netlify (fichiers statiques + SPA)      │
└──────────────────┬──────────────────────┘
                   │
┌──────────────────▼──────────────────────┐
│  Supabase                                │
│  Auth │ PostgreSQL │ Storage (photos)    │
└─────────────────────────────────────────┘
```

---

## Pages et navigation

| Route | Page | Accès |
|-------|------|-------|
| `/auth/connexion` | Connexion | Public |
| `/auth/inscription` | Inscription | Public |
| `/` | Dashboard (KPI) | Connecté |
| `/scanner` | Scanner facture | Connecté |
| `/factures` | Historique | Connecté |
| `/factures/:id` | Détail facture | Connecté |
| `/factures/:id/valider` | Validation OCR | Connecté |
| `/stats/prix` | Comparateur de prix | Connecté |
| `/stats/fournisseurs` | Dépenses fournisseurs | Connecté |
| `/prix-de-vente` | Prix de vente suggérés à confirmer | Connecté |
| `/profil` | Profil + install PWA | Connecté |

Navigation principale : barre du bas (Accueil, Scanner, Factures, Stats, Profil).

---

## Authentification

### Téléphone togolais

- Format attendu : **8 chiffres** commençant par **7** ou **9** (ex. `90 12 34 56`)
- Indicatif : **+228**

### Connexion

**Mot de passe** — numéro togolais + mot de passe. Pas de code SMS.

### Email interne Supabase

L'utilisateur ne voit que son numéro. Côté Supabase Auth, l'email est :

`90123456@phone.e-facture.app`

(configurable dans `src/lib/auth/phone-auth.ts`)

### Sans Supabase

Si les variables d'environnement ne sont pas configurées :

- Inscription locale (données dans le navigateur)
- Bouton **« Mode démo »** avec factures fictives

---

## Parcours scan d'une facture

```
1. Ouvrir /scanner
2. Photo (caméra) ou fichier (galerie)
3. compressFile() → JPEG optimisé
4. Tesseract.js → texte brut
5. ocr-parser.ts → fournisseur, date, total, lignes produits
6. Upload photo → Supabase Storage (bucket invoice-photos)
7. Insertion → tables invoices + invoice_items
8. Redirection → /factures/:id/valider
9. L'utilisateur corrige → statut "validated"
10. Dashboard et stats recalculés
```

---

## Prix de vente suggérés

### Principe

Après la validation d'une facture, l'application prépare en arrière-plan un prix de vente pour
chaque produit acheté. Rien n'est ajouté à l'écran de scan ni à l'écran de validation : le
commerçant traite les suggestions quand il veut, dans l'écran **Prix de vente** (`/prix-de-vente`),
signalé par un badge « N prix de vente à confirmer » sur le tableau de bord.

Ce n'est **pas** un modèle de machine learning : c'est une **suggestion adaptative à moyenne
mobile**. Aucune API externe, aucune dépendance ML. Code : `src/lib/pricing.ts` (calcul pur) et
`src/lib/productPrices.ts` (lecture/écriture démo ou Supabase).

### Formules

```
prix suggéré   = arrondi_25( prix_achat_unitaire × (1 + marge) )
marge utilisée = marge apprise du produit, sinon marge habituelle du commerçant (15 % par défaut)
marge réelle   = prix_final / prix_achat − 1
nouvelle marge = 0,7 × ancienne marge + 0,3 × marge réelle      (bornée entre 0 % et 100 %)
```

- `arrondi_25` : multiple de 25 FCFA le plus proche (1 237 → 1 225).
- Pas d'apprentissage si le prix final est inférieur au prix d'achat (autorisé, mais signalé).
- « Tout accepter » vaut une confirmation par ligne au prix suggéré.
- Plusieurs lignes du même produit sur une facture : prix unitaire moyen pondéré par la quantité.
- Produits rapprochés par un nom normalisé (« Riz parfumé 25kg » = « riz parfume 25 kg »).
- Section « À vérifier » : produits nouveaux, ou prix d'achat en hausse de plus de 10 %.

### Limites

- Le prix d'achat utilisé est le prix unitaire de la facture, **sans** les frais de transport.
- Le prix suggéré dépend uniquement de l'historique du commerçant : il ignore la concurrence,
  la demande, les pertes et la vente au détail (sac acheté, revendu au kg).
- Le rapprochement des produits repose sur le libellé : deux libellés différents pour le même
  article donnent deux produits distincts.
- La fonctionnalité **n'a pas été évaluée** auprès de commerçants réels ; aucun chiffre de
  précision ou d'impact n'est revendiqué.
- Hors ligne : une facture validée sans réseau ne génère ses suggestions qu'après synchronisation.

> **Supabase** : exécuter `supabase/migrations/005_product_prices.sql` (colonne
> `profiles.default_margin` + table `product_prices` avec RLS). Sans cette migration, la
> validation fonctionne mais aucune suggestion n'est enregistrée.

---

## Mode démo vs production

| | Mode démo | Production (Supabase) |
|---|-----------|---------------------|
| Données | Fictives, localStorage | PostgreSQL cloud |
| Photos | Placeholders SVG | Storage Supabase |
| Comptes | Locaux / session | Auth Supabase |
| Persistance | Navigateur uniquement | Multi-appareils |

---

## PWA (installation)

- **Manifest** : nom `efacture`, thème vert `#006d41`
- **Service Worker** : cache des assets, fonts, requêtes Supabase (NetworkFirst)
- **File hors-ligne** : photos et saisie dans IndexedDB (`efacture-offline`) ; `OfflineSync` envoie dès que `online` revient. Les KPI cloud n’incluent pas les scans non synchronisés.
- **Page de garde** : splash au premier lancement
- **Installation** : bannière sur connexion + profil ; iOS via « Sur l'écran d'accueil »

> La caméra mobile nécessite **HTTPS** (Netlify en production).

---

## Installation locale

### Prérequis

- Node.js 20 LTS
- npm

### Commandes

```bash
git clone https://github.com/Samuella01/efacture.git
cd efacture
npm install
copy .env.example .env.local
# Remplir VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY
npm run dev
```

Ouvrir [http://localhost:5173](http://localhost:5173)

### Accès depuis le téléphone (même Wi‑Fi)

Le serveur Vite est configuré avec `host: true`. Au lancement de `npm run dev`, utilisez l'URL **Network** affichée (ex. `http://192.168.x.x:5173`).

> Pour la caméra sur mobile, déployez sur Netlify (HTTPS).

### Build production

```bash
npm run build
npm run preview
```

---

## Configuration Supabase

1. Créer un projet sur [supabase.com](https://supabase.com)
2. Exécuter dans le SQL Editor, dans l'ordre : `001_initial.sql`, `002_transport_fee.sql`,
   `004_final_amount_supplier_link.sql`, `005_product_prices.sql` (dossier `supabase/migrations/`)
3. Créer le bucket Storage **`invoice-photos`** (privé)
4. Exécuter les policies Storage (fin du fichier SQL, section commentée)
5. **Authentication → Email** : désactiver **Confirm email**
6. Copier URL et clé **anon** dans `.env.local`

### Tables

- `profiles` — commerce, téléphone, quartier
- `suppliers` — fournisseurs
- `invoices` — factures scannées
- `invoice_items` — lignes produits
- `product_prices` — prix de vente suggérés / confirmés et marge apprise par produit

Row Level Security (RLS) : chaque utilisateur ne voit que ses données.

---

## Déploiement Netlify

1. Connecter le repo GitHub à Netlify
2. Paramètres :
   - **Build command** : `npm run build`
   - **Publish directory** : `dist`
3. Variables d'environnement (Site settings → Environment variables) :
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. Supabase → Authentication → URL Configuration :
   - Site URL : `https://votre-site.netlify.app`
   - Redirect URLs : `https://votre-site.netlify.app/**`

Le fichier `netlify.toml` inclut déjà la redirection SPA.

---

## Variables d'environnement

| Variable | Description | Où la trouver |
|----------|-------------|---------------|
| `VITE_SUPABASE_URL` | URL du projet Supabase | Supabase → Settings → API |
| `VITE_SUPABASE_ANON_KEY` | Clé publique anon | Supabase → Settings → API |

### Fichiers

| Fichier | Commit Git ? | Rôle |
|---------|--------------|------|
| `.env.example` | Oui | Modèle sans vraies clés |
| `.env.local` | **Non** | Vos clés locales |
| Variables Netlify | Dashboard | Clés en production |

---

## Structure du projet

```
efacture/
├── public/
│   ├── icons/          # Icônes PWA + logo
│   └── _redirects      # Netlify SPA
├── src/
│   ├── pages/          # Écrans (Dashboard, Scanner, …)
│   ├── components/     # UI, layout, PWA, factures
│   ├── context/        # AuthContext
│   ├── hooks/          # usePwaInstall
│   ├── lib/
│   │   ├── auth/       # Téléphone, users locaux
│   │   ├── demo/       # Mode démo
│   │   ├── ocr/        # Tesseract, parser, compression
│   │   ├── offline/    # File IndexedDB des scans hors réseau
│   │   ├── invoices.ts # CRUD + analytics + flush file hors-ligne
│   │   └── supabase.ts
│   └── types/
├── supabase/migrations/  # Schéma SQL
├── vite.config.ts      # Vite + PWA
├── netlify.toml
├── .env.example
└── README.md
```

---

## Sécurité

- **Ne jamais** commiter `.env.local` ni de clés API dans le code
- La clé **anon** Supabase est publique (côté client) ; la sécurité repose sur **RLS** PostgreSQL et les policies Storage
- Ne pas utiliser la clé **service_role** dans le frontend
- Mode local sans Supabase : mots de passe en clair dans le navigateur — **démo uniquement**

---

## Ce qui reste à faire

- [x] Configurer Supabase + `.env.local`
- [x] Déployer sur Netlify (HTTPS)
- [ ] Tester scan caméra sur téléphone (HTTPS)
- [ ] Vérifier bucket `invoice-photos` (privé) + policies Storage
- [ ] Désactiver la confirmation d'email (Auth) si besoin
- [ ] Déclarer l'URL Netlify dans Supabase (Site URL / Redirect URLs)
- [ ] Mot de passe oublié
- [x] Édition du profil
- [x] Export PDF / CSV mensuel
- [x] File d'attente offline pour scans sans réseau
- [ ] Tests auprès de commerçants

---

## Licence

Projet académique / TPME Lomé — usage libre pour apprentissage et soutenance.

---

## Auteur

[Samuella01](https://github.com/Samuella01) — efacture
