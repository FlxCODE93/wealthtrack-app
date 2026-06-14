# WealthTrack — projet prêt à vibecoder

Ce dossier contient ton app WealthTrack dans un vrai projet React (Vite),
prêt à se lancer avec un aperçu en direct (les modifications s'affichent
automatiquement dès que tu sauvegardes un fichier).

## 1. Installer Node.js (une seule fois)

Télécharge et installe Node.js (version LTS) depuis https://nodejs.org
Pour vérifier que c'est installé, ouvre un terminal et tape :

    node -v

Tu dois voir un numéro de version s'afficher (ex. v20.x).

## 2. Installer les dépendances du projet (une seule fois)

Ouvre un terminal **dans ce dossier** et tape :

    npm install

## 3. Lancer l'aperçu en direct

    npm run dev

Le terminal affiche une adresse, en général :

    http://localhost:5173

Ouvre-la dans ton navigateur. Ton app s'affiche.
Modifie le fichier `src/App.jsx` et sauvegarde : la page se met à jour
toute seule, en direct. C'est ça, le « live reload ».

## Pour vibecoder avec l'IA

Ouvre ce dossier dans un éditeur assisté par IA, par exemple :
- **Cursor** (https://cursor.com) — gratuit pour démarrer
- **VS Code** + l'extension GitHub Copilot
- **Claude Code** — dans le terminal

Garde `npm run dev` qui tourne dans un terminal pendant que tu codes :
chaque changement proposé par l'IA s'affiche immédiatement dans le navigateur.

## Structure du projet

    wealthtrack-app/
    ├─ index.html          ← page HTML de base (+ Tailwind via CDN)
    ├─ package.json        ← liste des dépendances et des commandes
    ├─ vite.config.js      ← configuration du serveur de dev
    └─ src/
       ├─ main.jsx         ← point d'entrée (ne pas toucher en général)
       └─ App.jsx          ← TON application : c'est ici que tu codes

## Pour mettre en ligne plus tard

Une fois prêt : `npm run build` génère un dossier `dist/` optimisé,
que tu peux déployer gratuitement sur Vercel, Netlify ou Render.

## Note sur Tailwind

Pour rester simple, Tailwind est chargé via un script CDN dans `index.html`.
C'est parfait pour développer. Pour une vraie mise en production, on
installera Tailwind proprement (build optimisé) — dis-le-moi le moment venu.
