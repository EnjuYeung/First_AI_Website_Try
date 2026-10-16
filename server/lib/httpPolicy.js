const securityHeaders = {
  'Content-Security-Policy': "default-src 'self'; base-uri 'self'; connect-src 'self'; font-src 'self' data:; form-action 'self'; frame-ancestors 'none'; img-src 'self' data: https:; object-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'",
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Permissions-Policy': 'camera=(), geolocation=(), microphone=()',
};

export const applyHttpPolicy = (req, res, next) => {
  for (const [name, value] of Object.entries(securityHeaders)) res.setHeader(name, value);
  if (/^\/api\//i.test(req.path) && !/^\/api\/uploads\//i.test(req.path)) {
    res.setHeader('Cache-Control', 'private, no-store');
  }
  next();
};
