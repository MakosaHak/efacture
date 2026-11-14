# efacture

**Scanner et gérer vos achats**

Application web progressive (PWA) pour les commerçants de Lomé : photographier un reçu, lire le texte automatiquement (OCR dans le navigateur), vérifier les montants, puis suivre dépenses, prix d'achat, fournisseurs et prix de vente conseillés.

> **Tout est local.** Comptes, reçus, photos et prix sont enregistrés dans le navigateur (IndexedDB). Aucun serveur, aucune base de données externe, aucune clé à configurer. L'application fonctionne sans réseau une fois installée.

---

## Sommaire

- [Fonctionnalités](#fonctionnalités)
- [Stack technique](#stack-technique)
- [Stockage local](#stockage-local)
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
- **lucide-react** pour les icônes
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
| `settings` | Réglages par compte (marge par défaut) |

Chaque donnée est liée à un `owner_id` : plusieurs comptes peuvent coexister sur le même appareil sans voir les données des autres. Au démarrage, l'application demande au navigateur un **stockage persistant** pour éviter toute purge automatique.

Code : `src/lib/db/local-db.ts` (ouverture, transactions) et `src/lib/db/repo.ts` (accès par entité).

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

Pour chaque article d'un reçu validé : `prix de vente = prix d'achat × (1 + marge)`, arrondi au multiple de 25 FCFA. La marge utilisée est la marge apprise du produit, sinon la marge habituelle du commerce (choisie dans Compte).

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
| Téléphone | `90 45 12 78` |
| Mot de passe | `afi2026` |

Sur l'écran de connexion, **Ouvrir la boutique « Chez Afi »** crée ce compte sur l'appareil (une seule fois) et l'ouvre. Les modifications faites ensuite sont conservées comme pour n'importe quel compte.

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
npm run test:rules # vérification des règles de prix et de l'OCR
```

### Accès depuis le téléphone (même Wi-Fi)

Le serveur écoute sur toutes les interfaces : ouvrez l'adresse « Network » affichée au lancement. Pour la caméra en HTTPS local, un certificat mkcert dans `~/.vite-plugin-mkcert` est détecté automatiquement.

---

## Déploiement

Hébergement statique (Netlify, Vercel, GitHub Pages…). Le fichier `netlify.toml` et `public/_redirects` renvoient toutes les routes vers `index.html`. Aucune variable d'environnement n'est nécessaire.

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
    ocr/           Tesseract.js, prétraitement image, analyse du texte
    invoices.ts    CRUD reçus + indicateurs, prévisions, optimisation
    productPrices.ts prix de vente suggérés
    pricing.ts     formules (pures)
    export-pdf.ts  export PDF / CSV
  pages/           une page par route
  types/           types TypeScript
```

---

## Limites et pistes

- Les données sont liées à l'appareil et au navigateur : pensez aux exports mensuels. Une sauvegarde / restauration complète (fichier) serait une suite naturelle.
- Pas de récupération de mot de passe (aucun serveur) : un mot de passe oublié impose de recréer un compte.
- L'OCR dépend de la qualité de la photo : reçu à plat, bien éclairé, cadré en entier.

---

## Licence

Projet académique / TPME Lomé, usage libre pour l'apprentissage et la soutenance.
