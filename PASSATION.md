# Efacture — Document de passation

Ce document explique l'application telle qu'elle est aujourd'hui, les choix faits, les services externes utilisés et la marche à suivre pour la reprendre, la corriger ou la faire évoluer. Il complète le `README.md` (présentation et installation) sans le répéter.

Dernière mise à jour : 16 novembre 2026.

---

## 1. En une page

**Efacture** est une application web progressive (PWA, installable sur téléphone) pour les commerçantes de Lomé. Elle permet de photographier un reçu, d'en lire le contenu automatiquement, de le vérifier, puis de suivre ses dépenses, ses fournisseurs, l'évolution des prix d'achat et des prix de vente conseillés.

Principes d'architecture, dans l'ordre d'importance :

1. **Local d'abord.** Toutes les données (comptes, reçus, photos, prix) sont stockées dans le navigateur, dans IndexedDB. L'application fonctionne sans réseau.
2. **Cloud en plus.** Si Supabase est configuré, les mêmes données sont synchronisées en ligne, par compte, et retrouvées sur les autres appareils. Le cloud n'est jamais indispensable pour utiliser l'application.
3. **Lecture des reçus par IA avec repli.** La photo est d'abord envoyée à Gemini (via une petite fonction serveur Netlify qui garde la clé). Si l'IA n'est pas disponible, Tesseract.js lit l'image dans le navigateur.
4. **Interface mobile sobre.** Une police (Nunito), une couleur d'accent, des illustrations plutôt que des paragraphes, pas d'émoji.

| Élément | Valeur |
|---|---|
| Dépôt GitHub | MakosaHak/efacture, branche `main` |
| Site en ligne | https://efactur.netlify.app (nom Netlify : `efactur`, sans e final) |
| Hébergement | Netlify, plan gratuit, compte personnel (équipe « MksTeam »), déploiement par l'outil en ligne de commande |
| Base cloud | Supabase, projet `efacture` (réf. `joenmlrolzpuieiffvyu`, région Francfort), plan gratuit, organisation « FacilRESA » |
| Lecture IA | Google AI Studio, projet « efacture », clé API gratuite, modèle `gemini-flash-lite-latest` |
| Compte de démonstration | Mme Afi KOUMAKO, boutique « Chez Afi, Alimentation Générale », téléphone 71 79 50 74, mot de passe 12345678 |

---

## 2. Pile technique

| Rôle | Choix | Pourquoi |
|---|---|---|
| Interface | React 18, TypeScript, Vite 6 | déjà en place, build rapide |
| Styles | Tailwind CSS v4 (plugin Vite), jetons dans `src/index.css` | une seule source pour les couleurs et rayons |
| Icônes | lucide-react | vraies icônes vectorielles, remplace les émojis |
| Illustrations | SVG maison dans `src/components/ui/Illustration.tsx` | pas de dépendance, palette cohérente |
| Stockage local | IndexedDB natif, sans bibliothèque | contrôle total, zéro dépendance |
| Cloud | @supabase/supabase-js (Auth, Postgres, Storage, Realtime) | gratuit, temps réel inclus |
| OCR local | tesseract.js 5 | gratuit, hors ligne |
| OCR IA | API Gemini via fonction Netlify (`@netlify/functions`) | lit les tableaux et le manuscrit |
| Graphiques | recharts | déjà en place |
| PWA | vite-plugin-pwa (service worker Workbox, manifeste) | installation, cache hors ligne |
| Export | générateur PDF maison dans `src/lib/export-pdf.ts` | pas de dépendance lourde |

Aucun framework serveur : le seul code côté serveur est la fonction `netlify/functions/ocr.mts`.

---

## 3. Structure du code

```
netlify/functions/
  ocr.mts                 fonction serveur POST /api/ocr (point d'entrée Netlify)
  lib/gemini-ocr.ts       appel Gemini, vérification du jeton, normalisation du résultat
src/
  main.tsx, App.tsx       démarrage, routes
  index.css               jetons de design (couleurs, rayons, ombres), police
  components/
    layout/               AppLayout (coque mobile), AppHeader, BottomNav, ProtectedRoute
    ui/                   Button, Card, Input/Select, Feedback (Notice, Badge, Spinner, EmptyState, ListRow), Avatar, Illustration
    dashboard/            AnalysisWheel (roue à trois parts cliquables)
    invoices/             InvoiceThumbnail / InvoicePhoto (photos depuis IndexedDB), InvoiceStatusBadge
    pwa/                  bannière d'installation, mise à jour, écran de démarrage
  context/AuthContext.tsx session, profil, synchronisation (exposé par useAuth)
  lib/
    db/local-db.ts        ouverture IndexedDB, transactions génériques
    db/repo.ts            accès par entité + file d'envoi (outbox) + repli photo cloud
    auth/local-auth.ts    inscription/connexion locale et Supabase Auth, session
    auth/phone-auth.ts    format et validation du numéro togolais
    sync/cloud-sync.ts    moteur de synchronisation local ↔ Supabase
    demo/seed.ts          jeu de données du compte de démonstration
    invoices.ts           CRUD reçus + tous les calculs (KPI, prévisions, optimisation)
    productPrices.ts      prix de vente suggérés (persistance)
    pricing.ts            formules pures (marge, arrondi, regroupement)
    predict.ts            régression linéaire, taux de croissance
    landed-cost.ts        répartition du transport sur les lignes
    export-pdf.ts         relevé mensuel PDF
    ocr/ai-ocr.ts         appel client de la fonction IA
    ocr/tesseract-runner.ts, image-utils.ts, ocr-parser.ts   OCR local et analyse du texte
    supabase.ts           client Supabase (ou null si non configuré)
  pages/                  une page par écran (voir § 5)
  types/                  types TypeScript (invoice.ts, auth.ts)
supabase/schema.sql       schéma de la base cloud (tables, sécurité, bucket, temps réel)
netlify.toml              publication, fonctions, redirections
```

---

## 4. Données

### 4.1 Stockage local (IndexedDB, base `efacture`, version 2)

| Magasin | Clé | Contenu |
|---|---|---|
| `users` | `id` (index unique `phone`) | compte : téléphone, mot de passe haché (SHA-256 + sel), profil |
| `invoices` | `id` (index `owner_id`) | reçu complet, lignes d'articles incluses dans l'objet |
| `photos` | `id` | photo en `Blob` (reçus et photo de profil) |
| `product_prices` | `id` = `owner:product_key` (index `owner_id`) | prix de vente par produit |
| `settings` | `id` = `owner:clé` | réglages internes (date du dernier rapatriement) |
| `outbox` | `id` = `kind:ref` (index `owner_id`) | écritures à envoyer au cloud |

Règle : toute donnée porte un `owner_id`. Plusieurs comptes peuvent coexister sur un appareil sans se voir. Pour un compte synchronisé, `owner_id` est l'identifiant Supabase de l'utilisateur.

Le chemin d'une photo est `local:<id>`. La fonction `getPhotoBlob` lit d'abord localement ; si la photo manque et que la synchronisation est active, elle la télécharge depuis le cloud et la met en cache.

Pour faire évoluer la structure : incrémenter `DB_VERSION` dans `local-db.ts` et ajouter la création du nouveau magasin dans `onupgradeneeded`.

### 4.2 Cloud (Supabase)

Schéma complet dans `supabase/schema.sql`, à exécuter dans l'éditeur SQL du projet. Format volontairement simple, identique au local :

| Table | Colonnes | Remarques |
|---|---|---|
| `profiles` | `id uuid` (= auth.users.id), `data jsonb`, `updated_at` | un profil par utilisateur |
| `invoices` | `id text`, `owner_id uuid`, `data jsonb`, `deleted bool`, `updated_at` | `deleted` = tombstone de suppression |
| `product_prices` | `id text`, `owner_id uuid`, `data jsonb`, `updated_at` | |

- Sécurité par ligne (RLS) : chaque utilisateur ne voit que ses lignes (`owner_id = auth.uid()`).
- Un déclencheur met `updated_at` à jour à chaque écriture ; il sert au rapatriement incrémental.
- Temps réel activé sur les trois tables.
- Bucket Storage privé `receipt-photos`, chemin `<uid>/<photoId>`, règles d'accès par dossier.
- Authentification : fournisseur e-mail avec **confirmation d'e-mail désactivée**. Le téléphone sert d'identifiant ; l'e-mail interne est `<8 chiffres>@phone.e-facture.app`.

Limites du plan gratuit : 2 projets par compte (le second est FacilRESA), 500 Mo de base, 1 Go de fichiers, mise en pause après 7 jours sans activité (à réveiller depuis le tableau de bord avant une démonstration).

---

## 5. Écrans et parcours

| Route | Page | Rôle |
|---|---|---|
| `/auth/connexion` | LoginPage | téléphone + mot de passe |
| `/auth/inscription` | RegisterPage | nom, commerce, téléphone, quartier, mot de passe |
| `/` | DashboardPage | dépenses du mois, raccourcis « à vérifier », derniers achats, roue d'analyses, hausses de prix |
| `/scanner` | ScannerPage | caméra ou import, lecture IA puis Tesseract, enregistrement |
| `/factures` | InvoiceListPage | liste par mois, recherche, filtres par statut |
| `/factures/:id` | InvoiceDetailPage | photo, montants, articles, fournisseur modifiable, suppression |
| `/factures/:id/valider` | ValidateInvoicePage | correction des champs lus, écart total/lignes, validation ou rejet |
| `/prix-de-vente` | SellingPricesPage | prix suggérés à confirmer, prix confirmés |
| `/stats/prix` | PriceComparePage | courbe d'un produit, dépenses par fournisseur |
| `/stats/previsions` | ForecastPage | budget du mois prochain, prix attendus |
| `/stats/optimisation` | OptimizePage | économies possibles, conseils, détail par produit |
| `/stats/fournisseurs` | SuppliersPage | dépenses par fournisseur |
| `/profil` | ProfilePage | photo de profil, informations, relevé PDF, mot de passe, état de synchronisation |

### Parcours d'un reçu

1. **Photo** : caméra arrière (HD) ou import. Compression côté client (`image-utils.ts`).
2. **Lecture IA** (`ai-ocr.ts`) : image réduite à 800 px, envoyée à `/api/ocr` avec le jeton Supabase. Délai client 20 s.
3. **Repli Tesseract** (`tesseract-runner.ts`) si l'IA échoue : prétraitement, deux passes (bloc puis colonne), puis `ocr-parser.ts` extrait fournisseur, date, total et lignes.
4. **Enregistrement** local (`saveScannedInvoice`), statut *À vérifier*, photo stockée ; mise en file pour le cloud.
5. **Vérification** : l'écran affiche « Lu par l'assistant » ou « Lecture automatique » avec la confiance ; écart signalé si total ≠ somme des lignes.
6. **Validation** : statut *Validé*, entrée dans les statistiques, création des suggestions de prix de vente.

### Prix de vente

`prix de vente = prix d'achat × (1 + marge)`, arrondi au multiple de 25 FCFA. Marge de départ 15 % ; à chaque confirmation, la marge du produit devient `0,7 × ancienne + 0,3 × marge choisie`. Un produit nouveau ou dont le prix d'achat a augmenté de plus de 10 % est mis « À vérifier ». Le choix manuel de la marge a été retiré de l'interface (novembre 2026) : tout est appris des prix confirmés.

---

## 6. Authentification et session

Fichier : `src/lib/auth/local-auth.ts`, orchestré par `AuthContext.tsx`.

- **Sans Supabase** : compte local (identifiant aléatoire), mot de passe haché avec sel aléatoire, session dans `localStorage` (`efacture-session`).
- **Avec Supabase** : inscription et connexion passent par Supabase Auth ; l'identifiant local est l'identifiant Supabase. Le hachage local est réaligné à chaque connexion (mot de passe peut-être changé ailleurs). Hors connexion, repli sur le compte local s'il existe déjà sur l'appareil.
- **Compte de démonstration** : si le téléphone et le mot de passe correspondent à `SAMPLE_ACCOUNT`, le compte est créé à la première connexion (cloud puis local) et `seed.ts` insère ses reçus d'exemple une seule fois, en arrière-plan. Un marqueur `is_demo` l'identifie.
- Changement de mot de passe : Supabase puis local.
- L'écran s'affiche dès l'identité vérifiée ; la synchronisation ne bloque jamais la connexion (point corrigé le 15 novembre : la connexion prenait 18 s).

---

## 7. Synchronisation local ↔ cloud

Fichier : `src/lib/sync/cloud-sync.ts`. Démarrée par `startSync(ownerId)` à la connexion ou à la restauration de session, arrêtée à la déconnexion.

- **Envoi** : chaque écriture locale passe par `repo.ts`, qui note une entrée `outbox` (`invoice`, `delete_invoice`, `price`, `profile`, `photo`, `delete_photo`). `flush()` les envoie dans l'ordre, dès que le réseau est là ; en cas d'échec réseau, elles restent en file.
- **Rapatriement** : `pull()` lit ce qui a changé depuis le dernier `updated_at` connu (par compte), au démarrage, à la reconnexion et toutes les minutes. Les données reçues sont écrites localement sous `withRemote(...)`, qui empêche de les renvoyer.
- **Temps réel** : abonnement aux trois tables filtré par propriétaire ; chaque événement est appliqué comme un rapatriement.
- **Conflits** : la dernière modification gagne, comparée sur `updated_at` de l'objet.
- **Suppressions** : tombstone `deleted = true` côté cloud ; les autres appareils suppriment la ligne et sa photo.
- **Interface** : `AuthContext` expose `dataVersion` (incrémenté quand des données arrivent du cloud ; les pages le mettent dans leurs dépendances d'effet) et `sync` (statut, nombre en attente, dernière synchronisation), affiché dans la page Compte.

Test de référence effectué : connexion sur deux origines différentes, 17 reçus et 18 photos rapatriés sans doublon, insertion côté serveur visible sans rechargement, suppression propagée.

---

## 8. Lecture des reçus par IA

- **Pourquoi** : sur une vraie facture imprimée, Tesseract a sauté une ligne et perdu la colonne des quantités ; sur du manuscrit il ne lit rien. Gemini lit l'ensemble correctement.
- **Fonction** `netlify/functions/ocr.mts` → `lib/gemini-ocr.ts` : vérifie le jeton Supabase (`/auth/v1/user`), appelle `generateContent` avec la photo en ligne et un prompt demandant un JSON strict, normalise la réponse (nombres, unités, date), répond en JSON.
- **Modèles** : `gemini-flash-lite-latest` en premier, puis `gemini-3.5-flash-lite`, `gemini-3.1-flash-lite`, `gemini-2.5-flash`. Mesures du 16 novembre : lite ≈ 3 à 5 s sur une image de 800 px ; les modèles « flash » standard mettent 1 à 2 minutes (phase de réflexion) et dépassent la limite de 10 s des fonctions Netlify gratuites. Ne pas revenir à un modèle standard sans mesurer.
- **Développement local** : `vite.config.ts` contient un petit plugin qui sert la même route `/api/ocr` avec les variables du `.env`.
- **Variables** : `GEMINI_API_KEY` (secrète, serveur seulement), `GEMINI_MODEL` (facultatif), `VITE_AI_OCR=off` pour désactiver côté client.
- **Quota** : niveau gratuit de l'API Gemini, plafond quotidien visible dans Google AI Studio. En cas de dépassement, l'application retombe sur Tesseract automatiquement.

---

## 9. Services, comptes et secrets

| Service | Où | Ce qu'il faut savoir |
|---|---|---|
| GitHub | MakosaHak/efacture | code uniquement, jamais de clés (`.env` ignoré) |
| Supabase | organisation FacilRESA, projet `efacture` | URL et clé anonyme publique dans `.env` local et dans les variables Netlify ; schéma dans `supabase/schema.sql` ; confirmation d'e-mail désactivée |
| Google AI Studio | projet « efacture » | clé API `GEMINI_API_KEY` dans `.env` local et en variable secrète Netlify (contexte production) |
| Netlify | compte personnel, équipe MksTeam, site `efactur` | déploiement par CLI ; le dossier est lié au site (`.netlify/`, ignoré par git) |

Le fichier `.env` (non versionné) contient aujourd'hui : `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `GEMINI_API_KEY`. Modèle dans `.env.example`.

Si une clé doit être remplacée : la régénérer dans le service, la mettre dans `.env`, puis `npx netlify-cli env:set NOM valeur --secret --context production`, puis redéployer.

---

## 10. Développer et déployer

```bash
npm install
npm run dev          # http://localhost:5173, /api/ocr servi localement
npm run build        # dist/ (tsc puis vite build + service worker)
npm run deploy       # build + envoi du site ET de la fonction sur Netlify
```

- Première fois sur une nouvelle machine : `npx netlify-cli login` (autoriser avec le compte MksTeam), puis `npx netlify-cli link --id 5c0f9914-c4cf-47fd-8e99-ce7c4147a998`.
- Le glisser-déposer du dossier `dist` sur Netlify n'inclut pas la fonction IA : ne plus l'utiliser pour Efacture.
- Test rapide de la fonction en production : un `POST https://efactur.netlify.app/api/ocr` sans jeton doit répondre `401 {"error":"Connexion requise."}`.
- La caméra exige HTTPS (ou localhost). Pour tester sur téléphone en local, le projet détecte un certificat mkcert dans `~/.vite-plugin-mkcert`.

---

## 11. Diagnostic et pièges connus

- **Données locales d'une ancienne version** : si un écran reste vide ou incohérent sur un navigateur qui a connu une version antérieure, effacer les données du site (ou la base IndexedDB `efacture`) et se reconnecter.
- **Connexion lente** : la première connexion sur un appareil fait un aller-retour Supabase (quelques secondes) ; tout le reste est en arrière-plan.
- **Projet Supabase en pause** : après 7 jours sans activité, les appels échouent jusqu'à réveil depuis le tableau de bord ; l'application continue en local.
- **Deux comptes Netlify sur le PC de développement** : les sites efactur et facilresa sont dans le compte personnel (MksTeam), pas dans le compte de l'école. `npx netlify-cli status` indique le compte courant.
- **Ancien compte de test** : le compte 90 45 12 78 a été supprimé de Supabase ; seul 71 79 50 74 existe.
- **Fichiers de téléchargement** : les PDF exportés pendant les tests atterrissent parfois dans le dossier du projet ; ils sont ignorés par git (`efacture-*.pdf`).

---

## 12. Journal des modifications (novembre 2026)

Travail réalisé entre le 14 et le 16 novembre 2026, dans l'ordre :

1. **Application 100 % locale** (`15f1700`) : abandon de Supabase et du mode démo en mémoire, nouvelle couche IndexedDB (photos en blob), authentification locale, design system sobre, icônes lucide, refonte des 13 écrans.
2. **Compte d'exemple réaliste** (`8efc3af`) : « Chez Afi », photo de profil modifiable, nom de la personne, salutation par le prénom, touches de couleur.
3. **Roue d'analyses, PDF, Reçus** (`6449ea5`, `cc4d0b4`) : trois analyses en parts de cercle cliquables, relevé mensuel PDF simplifié (CSV retiré), page Reçus avec total, mois et statuts colorés.
4. **Synchronisation Supabase** (`ba1bbc9`) : nouveau projet cloud, comptes Supabase Auth, file d'envoi, rapatriement incrémental, temps réel, photos en Storage, tombstones ; carte d'état dans Compte.
5. **Identifiants d'Afi** (`7f2fed3`, `2a6b836`) : connexion normale au 71 79 50 74, données créées à la première connexion, bouton de démonstration retiré.
6. **Nettoyage et refonte** (`8bec95f`) : suppression des scripts, fichiers et exports morts ; retrait du choix de marge ; police Nunito, illustrations, textes réduits ; connexion non bloquante.
7. **Analyseur OCR** (`46851f8`) : lignes de tableau sans quantité reconstituées, fournisseur pris sur « Entreprise : ».
8. **Lecture IA** (`6208cd1`) : fonction Netlify Gemini, repli Tesseract, script de déploiement CLI, variables Netlify, déploiement en production vérifié.

Chaque commit porte un message détaillé ; `git log` reste la référence fine.

---

## 13. Pistes d'évolution

- Sauvegarde et restauration complètes en un fichier (utile sans cloud).
- Récupération de mot de passe (par SMS ou code, le téléphone étant l'identifiant).
- Catégories de produits et budget par catégorie.
- Gestion des unités (sac, carton, kg) dans les analyses de prix.
- Mise en file de la lecture IA quand le réseau revient (aujourd'hui, un scan hors ligne est lu par Tesseract et peut être revérifié).
