// ─── Authentification & permissions (4 rôles métier) ─────────────────────────
const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'beth-menahem-change-me';

// Rôles : admin | commercial | regisseur | administratif
const ROLE_LABELS = {
  admin:          'Administrateur',
  commercial:     'Commercial',
  regisseur:      'Régisseur',
  administratif:  'Administratif',
};

function sign(user) {
  return jwt.sign(
    { id: user.id, email: user.email, nom: user.nom, role: user.role, mcp: !!user.must_change_password },
    JWT_SECRET,
    { expiresIn: '12h' }
  );
}

function requireAuth(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Non autorisé' });
  try { req.user = jwt.verify(token, JWT_SECRET); next(); }
  catch { res.status(401).json({ error: 'Session expirée, reconnectez-vous.' }); }
}

// Restreint l'accès à certains rôles (admin a toujours accès)
function requireRole(...roles) {
  return (req, res, next) => {
    if (req.user?.role === 'admin' || roles.includes(req.user?.role)) return next();
    res.status(403).json({ error: 'Action non autorisée pour votre rôle.' });
  };
}

module.exports = { JWT_SECRET, ROLE_LABELS, sign, requireAuth, requireRole };
