# CRM — Salons d'Honneur Beth Menahem

CRM de gestion des réservations pour un lieu de réception : pipeline commercial, calendrier des salles (anti-double-réservation), tarification automatique, échéancier de paiement + relances, devis & contrats PDF, emails et notification WhatsApp.

## Rôles
- **Commercial** — demandes, devis, clients, pipeline
- **Régisseur** — planning & logistique (prestataires, déroulé)
- **Administratif** — finances, paiements, contrats
- **Admin** — accès complet + configuration

## Stack
Node 24 · Express · SQLite natif (`node:sqlite`, aucune compilation) · JWT · Nodemailer · node-cron · PDFKit · FullCalendar (front vanilla).

## Lancer en local
```bash
npm install
cp .env.example .env   # puis remplir
npm start
```
- Site public : http://localhost:3000
- CRM : http://localhost:3000/crm — **admin / admin123** (à changer immédiatement)

## Configuration
Tout est éditable dans le CRM (onglet **Configuration**, admin) : salles & capacités, types d'événement, plages horaires, options payantes, **grille tarifaire**, identité, acompte par défaut, CGV, relances.

## Déploiement
Voir **[DEPLOIEMENT-RAILWAY.md](DEPLOIEMENT-RAILWAY.md)**.

> ⚠️ En production, la base `data/crm.db` et le dossier `uploads/` doivent être sur un **volume persistant** (variables `DATA_DIR` / `UPLOAD_DIR`), sinon les données sont perdues à chaque redéploiement.
