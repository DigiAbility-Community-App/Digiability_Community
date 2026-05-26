import rateLimit from 'express-rate-limit';

export const forumPostLimiter = rateLimit({
  windowMs: 30 * 1000, // 30 seconds window
  max: 2, // limit each IP or user to 2 post creations per window
  message: {
    success: false,
    message: 'Too many requests. Please wait 30 seconds before posting again.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});
