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

// remember=true → 30 jours, sinon 12h
function sign(user, remember = false) {
  return jwt.sign(
    { id: user.id, email: user.email, nom: user.nom, role: user.role, mcp: !!user.must_change_password },
    JWT_SECRET,
    { expiresIn: remember ? '30d' : '12h' }
  );
}

// Token à usage unique pour reset de mot de passe (1h)
function signResetToken(userId) {
  return jwt.sign({ sub: userId, purpose: 'reset' }, JWT_SECRET, { expiresIn: '1h' });
}

function verifyResetToken(token) {
  const decoded = jwt.verify(token, JWT_SECRET);
  if (decoded.purpose !== 'reset') throw new Error('Token invalide');
  return decoded.sub;
}

// Token de signature électronique pour un devis (7 jours)
function signSignatureToken(reservationId, role = 'client') {
  return jwt.sign({ sub: reservationId, purpose: 'signature', role }, JWT_SECRET, { expiresIn: '7d' });
}

function verifySignatureToken(token) {
  const decoded = jwt.verify(token, JWT_SECRET);
  if (decoded.purpose !== 'signature') throw new Error('Token invalide');
  return decoded;
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

module.exports = { JWT_SECRET, ROLE_LABELS, sign, signResetToken, verifyResetToken, signSignatureToken, verifySignatureToken, requireAuth, requireRole };
