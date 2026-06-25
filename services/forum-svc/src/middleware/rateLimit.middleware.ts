import rateLimit from 'express-rate-limit';

export const forumPostLimiter = rateLimit({
  windowMs: 30 * 1000,
  max: 2,
  // Rate-limit per authenticated user, not per IP (shared carrier NATs share an IP)
  keyGenerator: (req: any) => req.user?.sub ?? req.ip,
  message: {
    success: false,
    message: 'Too many requests. Please wait 30 seconds before posting again.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});
