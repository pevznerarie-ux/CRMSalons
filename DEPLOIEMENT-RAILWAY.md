# 🚂 Déployer le CRM sur Railway

Guide pas-à-pas. Le code est déjà prêt (config `railway.json`, base et uploads paramétrables par variables d'environnement).

---

## 1. Créer le projet sur Railway
1. Va sur https://railway.app et connecte-toi (avec GitHub, c'est le plus simple).
2. **New Project** → **Deploy from GitHub repo** → choisis le dépôt **`CRMSalons`**.
3. Railway détecte Node automatiquement et lance le build. Laisse-le finir.

## 2. ⚠️ Ajouter un volume persistant (ÉTAPE CRUCIALE)
Sans ça, **toutes les réservations sont effacées à chaque mise à jour.**
1. Dans le service, onglet **Variables** → **+ New Volume** (ou onglet **Settings → Volumes**).
2. Monte le volume sur le chemin : **`/data`**
3. Va dans **Variables** et ajoute :
   - `DATA_DIR` = `/data/db`
   - `UPLOAD_DIR` = `/data/uploads`

## 3. Variables d'environnement
Dans **Variables**, ajoute (Raw Editor possible) :

```
JWT_SECRET=<une longue chaîne aléatoire>
SERVER_URL=https://<ton-domaine>.up.railway.app
ADMIN_EMAIL=admin

# Emails (Gmail → "mot de passe d'application")
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=ton.email@gmail.com
SMTP_PASS=ton_mot_de_passe_application
MANAGER_EMAIL=responsable@bethmenahem.fr

# WhatsApp régisseur (international, sans + ni espaces)
REGISSEUR_WHATSAPP=33612345678

# HelloAsso (optionnel — paiement en ligne)
HELLOASSO_CLIENT_ID=
HELLOASSO_CLIENT_SECRET=
HELLOASSO_ORG_SLUG=
```

> `PORT` est fourni automatiquement par Railway — ne pas le définir.

## 4. Générer le domaine public
1. Onglet **Settings → Networking → Generate Domain**.
2. Copie l'URL (`https://...up.railway.app`) et reporte-la dans la variable `SERVER_URL`, puis **redeploy**.

## 5. Première connexion
- CRM : `https://<ton-domaine>.up.railway.app/crm`
- Identifiants : **admin / admin123** → **change le mot de passe immédiatement** (onglet *Mon compte*).
- Crée les comptes de l'équipe (Commercial / Régisseur / Administratif) dans **Utilisateurs**.
- Renseigne tes vraies salles, options et tarifs dans **Configuration**.

## 6. Mises à jour
À chaque `git push` sur la branche connectée, Railway redéploie automatiquement. Le volume `/data` conserve la base et les documents.

---

### Webhook HelloAsso (si paiement en ligne utilisé)
Dans HelloAsso, configure l'URL de notification sur :
`https://<ton-domaine>.up.railway.app/api/webhooks/helloasso`
