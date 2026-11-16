# efacture

**Scanner et gérer vos achats**

Application web progressive (PWA) pour les commerçants de Lomé : photographier un reçu, lire le texte automatiquement (OCR dans le navigateur), vérifier les montants, puis suivre dépenses, prix d'achat, fournisseurs et prix de vente conseillés.

> **Reprise du projet :** le fichier [PASSATION.md](PASSATION.md) explique l'architecture, les services utilisés, les choix faits et l'historique des correctifs.

> **Local d'abord, cloud en plus.** Comptes, reçus, photos et prix sont enregistrés dans le navigateur (IndexedDB) : l'application fonctionne sans réseau une fois installée. Si un projet Supabase est configuré, les mêmes données sont synchronisées en ligne et retrouvées sur les autres appareils du même compte.

---

## Sommaire

- [Fonctionnalités](#fonctionnalités)
- [Stack technique](#stack-technique)
- [Stockage local](#stockage-local)
- [Synchronisation Supabase](#synchronisation-supabase)
- [Lecture des reçus par IA](#lecture-des-reçus-par-ia)
- [Pages et navigation](#pages-et-navigation)
- [Authentification](#authentification)
- [Parcours scan d'un reçu](#parcours-scan-dun-reçu)
- [Prix de vente suggérés](#prix-de-vente-suggérés)
- [Compte d'exemple « Chez Afi »](#compte-dexemple--chez-afi-)
- [PWA (installation)](#pwa-installation)
- [Installation locale](#installation-locale)
- [Déploiement](#déploiement)
- [Structure du projet](#structure-du-projet)
- [Limites et pistes](#limites-et-pistes)

---

## Fonctionnalités

| Fonctionnalité | Description |
|----------------|-------------|
| **Inscription / Connexion** | Téléphone togolais (+228, 8 chiffres) + mot de passe, stockés sur l'appareil (mot de passe haché) |
| **Scanner** | Caméra ou import galerie, compression de l'image, OCR Tesseract.js |
| **Vérification** | Correction du fournisseur, de la date, des articles, du montant et du transport |
| **Reçus** | Liste, recherche, filtres par statut, photo conservée en local |
| **Tableau de bord** | Dépenses du jour, de la semaine, du mois ; derniers achats ; alertes de hausse |
| **Prix de vente** | Suggestion par article d'après le prix d'achat et la marge apprise |
| **Analyses** | Évolution des prix, budget du mois prochain, comparaison des fournisseurs |
| **Export** | PDF et CSV mensuels des reçus validés |
| **PWA** | Installable sur Android, iOS et ordinateur ; fonctionne hors ligne |

---

## Stack technique

- **React 18 + TypeScript + Vite 6**
- **Tailwind CSS v4** (design sobre : une couleur d'accent, surfaces blanches, bordures fines)
- **lucide-react** pour les icônes, illustrations vectorielles maison (`src/components/ui/Illustration.tsx`)
- **IndexedDB** (API native, sans dépendance) pour toutes les données
- **Tesseract.js** pour l'OCR dans le navigateur
- **Recharts** pour les courbes
- **vite-plugin-pwa** (service worker, manifeste, installation)

---

## Stockage local

Base IndexedDB `efacture`, cinq magasins :

| Magasin | Contenu |
|---------|---------|
| `users` | Comptes : téléphone, mot de passe haché (SHA-256 salé), profil du commerce |
| `invoices` | Reçus avec leurs lignes d'articles (objet complet), indexés par propriétaire |
| `photos` | Photos des reçus sous forme de `Blob` |
| `product_prices` | Prix de vente suggérés / confirmés et marge apprise par produit |
| `settings` | Réglages internes par compte (date du dernier rapatriement) |

Chaque donnée est liée à un `owner_id` : plusieurs comptes peuvent coexister sur le même appareil sans voir les données des autres. Au démarrage, l'application demande au navigateur un **stockage persistant** pour éviter toute purge automatique.

Code : `src/lib/db/local-db.ts` (ouverture, transactions) et `src/lib/db/repo.ts` (accès par entité).

---

## Synchronisation Supabase

Facultative. Sans les deux variables ci-dessous, l'application est 100 % locale.

### Mise en place

1. Créer un projet sur [supabase.com](https://supabase.com) (offre gratuite).
2. **SQL Editor** : coller `supabase/schema.sql` et exécuter. Cela crée les tables `profiles`, `invoices`, `product_prices` (format JSON, sécurité par utilisateur), le bucket privé `receipt-photos` et active le temps réel.
3. **Authentication → Sign In / Providers** : désactiver **Confirm email** (le téléphone sert d'identifiant, aucun e-mail n'est envoyé).
4. Copier `.env.example` en `.env` et renseigner `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY` (*Project Settings → API Keys*).
5. Relancer `npm run dev` ou refaire `npm run build`. Si l'hébergeur construit lui-même l'application (Netlify depuis GitHub), déclarer ces deux variables dans ses réglages de build.

### Fonctionnement

- Les comptes sont créés dans Supabase Auth (e-mail interne `<téléphone>@phone.e-facture.app`) ; l'identifiant local est l'identifiant Supabase, ce qui permet les règles de sécurité par ligne.
- Chaque écriture locale (reçu, prix, profil, photo) est notée dans une file `outbox` puis envoyée dès qu'il y a du réseau. Les photos vont dans le stockage Supabase, chemin `<uid>/<photoId>`.
- Au démarrage et toutes les minutes, l'application rapatrie ce qui a changé côté cloud (autres appareils). Le temps réel applique les changements au fil de l'eau. Les photos manquantes sont téléchargées à la demande.
- Conflit : la dernière modification gagne (`updated_at`). Suppression : marque `deleted` côté cloud, propagée aux autres appareils.
- Hors connexion : tout continue de fonctionner ; la première connexion d'un compte sur un nouvel appareil demande le réseau.

Code : `src/lib/supabase.ts`, `src/lib/sync/cloud-sync.ts`, `src/lib/auth/local-auth.ts`.

---

## Lecture des reçus par IA

Tesseract lit bien les tickets imprimés mais saute des lignes et ne lit pas l'écriture manuscrite. L'application essaie donc d'abord une **lecture par IA (Gemini)**, puis retombe sur Tesseract si l'IA est indisponible (hors connexion, quota atteint, clé absente).

### Fonctionnement

- La photo est réduite (800 px) et envoyée à la fonction serveur `POST /api/ocr` (`netlify/functions/ocr.mts`) avec le jeton de connexion Supabase de l'utilisatrice : sans jeton valide, la fonction refuse (le quota gratuit n'est pas utilisable par des inconnus).
- La fonction appelle Gemini avec la clé gardée côté serveur (`GEMINI_API_KEY`), modèle `gemini-flash-lite-latest` (3 à 5 s par reçu), et renvoie fournisseur, date, total et lignes prêts pour l'écran de vérification.
- En développement, `vite.config.ts` reproduit la même route avec les variables du `.env`.

### Mise en place

1. Créer une clé sur [aistudio.google.com/apikey](https://aistudio.google.com/apikey) (compte Google, niveau gratuit ; le quota exact s'affiche dans la console AI Studio).
2. En local : `GEMINI_API_KEY=...` dans `.env`.
3. Sur Netlify : *Site settings → Environment variables*, ajouter `GEMINI_API_KEY` (et `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` pour la vérification du jeton).
4. Déployer **avec la fonction** : le glisser-déposer du dossier `dist` ne l'inclut pas. Utiliser `npm run deploy` (Netlify CLI, connexion une seule fois avec `npx netlify-cli login`), ou relier le site à GitHub.

`VITE_AI_OCR=off` désactive l'appel IA côté application (Tesseract seul).

---

## Pages et navigation

| Route | Page |
|-------|------|
| `/auth/connexion`, `/auth/inscription` | Connexion, création de compte |
| `/` | Tableau de bord |
| `/scanner` | Prise de photo / import, OCR |
| `/factures` | Liste des reçus |
| `/factures/:id` | Détail d'un reçu |
| `/factures/:id/valider` | Vérification avant validation |
| `/prix-de-vente` | Prix de vente à confirmer et prix confirmés |
| `/stats/prix` | Évolution des prix, dépenses par fournisseur |
| `/stats/previsions` | Budget du mois prochain |
| `/stats/optimisation` | Conseil d'achat |
| `/stats/fournisseurs` | Fournisseurs |
| `/profil` | Compte, marge, export, mot de passe, installation |

Navigation basse : Accueil, Reçus, **Scanner** (bouton central), Prix, Compte.

---

## Authentification

- Identifiant : numéro togolais à 8 chiffres (commence par 7 ou 9), saisi avec ou sans `+228`.
- Mot de passe : 6 caractères minimum, haché avec un sel aléatoire (WebCrypto SHA-256) avant stockage.
- Session mémorisée dans `localStorage` : l'application installée reste connectée.
- Changement de mot de passe depuis la page Compte.

Code : `src/lib/auth/local-auth.ts`, `src/context/AuthContext.tsx`.

---

## Parcours scan d'un reçu

1. **Photo** : caméra arrière (HD) ou import depuis la galerie, puis compression.
2. **OCR** : Tesseract.js lit l'image en français ; `ocr-parser.ts` extrait fournisseur, date, total et lignes.
3. **Enregistrement** : la photo (version allégée) et le reçu sont écrits dans IndexedDB, statut *À vérifier*.
4. **Vérification** : l'utilisateur corrige les champs ; un écart entre le total lu et la somme des articles est signalé.
5. **Validation** : statut *Validé*, le reçu entre dans les statistiques et génère des suggestions de prix de vente.

---

## Prix de vente suggérés

### Principe

Pour chaque article d'un reçu validé : `prix de vente = prix d'achat × (1 + marge)`, arrondi au multiple de 25 FCFA. La marge utilisée est la marge apprise du produit, sinon une marge de départ de 15 %. Rien à régler : l'application apprend des prix confirmés.

### Apprentissage

À chaque confirmation, la marge du produit devient `0,7 × ancienne + 0,3 × marge réellement choisie`. Un prix de vente inférieur au prix d'achat est accepté mais n'entraîne pas d'apprentissage.

### Mise en avant

Un produit nouveau, ou dont le prix d'achat a augmenté de plus de 10 %, apparaît dans **À vérifier**.

Code : `src/lib/pricing.ts` (calculs purs), `src/lib/productPrices.ts` (persistance).

---

## Compte d'exemple « Chez Afi »

L'application est livrée avec le compte d'une vraie boutique d'exemple, **Chez Afi, Alimentation Générale** (marché d'Assivito, Lomé), tenue par Afi KOUMAKO : quatre mois d'achats chez quatre fournisseurs, un reçu à vérifier, un reçu rejeté, des prix de vente confirmés et d'autres à confirmer, et une photo de profil modifiable depuis la page Compte.

| | |
|---|---|
| Téléphone | `71 79 50 74` |
| Mot de passe | `12345678` |

Elle se connecte comme n'importe quelle utilisatrice. À sa première connexion, le compte est créé (côté Supabase si configuré) et ses reçus d'exemple sont insérés une seule fois ; ensuite tout est conservé comme pour n'importe quel compte.

---

## PWA (installation)

- Android / Chrome : bannière « Installer efacture » ou menu du navigateur.
- iPhone : Safari, **Partager**, puis **Sur l'écran d'accueil**.
- Ordinateur : icône d'installation dans la barre d'adresse.

La caméra nécessite **HTTPS** (ou `localhost`). Le service worker met en cache l'application pour un usage hors ligne.

---

## Installation locale

### Prérequis

Node.js 20 ou plus récent.

### Commandes

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # dossier dist/
npm run preview    # prévisualiser le build
```

### Accès depuis le téléphone (même Wi-Fi)

Le serveur écoute sur toutes les interfaces : ouvrez l'adresse « Network » affichée au lancement. Pour la caméra en HTTPS local, un certificat mkcert dans `~/.vite-plugin-mkcert` est détecté automatiquement.

---

## Déploiement

Netlify (plan gratuit suffisant). `netlify.toml` déclare le dossier de publication `dist`, les fonctions (`netlify/functions`) et les redirections (`/api/ocr` vers la fonction, le reste vers `index.html`).

```bash
npx netlify-cli login     # une seule fois
npm run deploy            # build + envoi du site et de la fonction
```

Les clés Supabase du `.env` local sont intégrées au build ; `GEMINI_API_KEY` doit être déclarée dans les variables d'environnement du site Netlify (ou via `npx netlify-cli env:set GEMINI_API_KEY ...`).

---

## Structure du projet

```
src/
  components/
    invoices/      vignette et badge de statut
    layout/        coque de l'app, en-tête, navigation basse
    pwa/           bannière d'installation, mise à jour, écran de démarrage
    ui/            Button, Card, Input, Select, Notice, Badge, EmptyState…
  context/         AuthContext (session locale)
  lib/
    auth/          authentification locale, format téléphone
    db/            IndexedDB (local-db.ts) et accès par entité (repo.ts)
    demo/          jeu de données du compte d'exemple « Chez Afi »
    ocr/           lecture IA (ai-ocr.ts), Tesseract.js, prétraitement image, analyse du texte
netlify/functions/ fonction serveur /api/ocr (Gemini) et son code partagé
    invoices.ts    CRUD reçus + indicateurs, prévisions, optimisation
    productPrices.ts prix de vente suggérés
    pricing.ts     formules (pures)
    export-pdf.ts  export PDF / CSV
  pages/           une page par route
  types/           types TypeScript
```

---

## Limites et pistes

- Sans Supabase, les données sont liées à l'appareil : pensez aux exports mensuels.
- Pas de récupération de mot de passe par e-mail (le téléphone sert d'identifiant) : à prévoir si besoin.
- La lecture IA dépend du réseau et du quota gratuit Gemini ; Tesseract prend le relais sinon, avec une qualité moindre sur le manuscrit.

---

## Licence

Projet académique / TPME Lomé, usage libre pour l'apprentissage et la soutenance.
