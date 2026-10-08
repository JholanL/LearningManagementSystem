const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');
const connectDB = require('./config/db');
const { notFound, errorHandler } = require('./middleware/errorHandler');
const ApiError = require('./utils/ApiError');

const app = express();

// ---------- Security middleware ----------
app.set('trust proxy', 1); // needed for rate limiting behind Vercel / proxies
app.use(helmet()); // secure HTTP headers

const allowedOrigins = (process.env.CLIENT_URL || 'http://localhost:5173').split(',').map((o) => o.trim());
app.use(
  cors({
    origin: (origin, cb) => {
      // allow tools like Postman (no origin) and whitelisted frontends
      if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
      return cb(new ApiError(403, `CORS: ${origin} is not allowed`));
    },
  })
);

app.use(express.json({ limit: '1mb' })); // reject huge payloads
app.use(mongoSanitize()); // strips $ and . from input -> blocks NoSQL injection like { "$gt": "" }
app.use(
  '/api',
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 500,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { success: false, message: 'Too many requests. Please slow down.' },
  })
);
if (process.env.NODE_ENV === 'development') app.use(morgan('dev'));

// Make sure the database is connected before handling any API request
app.use('/api', async (_req, _res, next) => {
  try {
    await connectDB();
    next();
  } catch (err) {
    next(err);
  }
});

// ---------- Routes ----------
app.get('/api/health', (_req, res) => res.json({ success: true, message: 'VoiceLink Academy API is running' }));
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/users', require('./routes/userRoutes'));
app.use('/api/batches', require('./routes/batchRoutes'));
app.use('/api/courses', require('./routes/courseRoutes'));
app.use('/api/lessons', require('./routes/lessonRoutes'));
app.use('/api/quizzes', require('./routes/quizRoutes'));
app.use('/api/scenarios', require('./routes/scenarioRoutes'));
app.use('/api/evaluations', require('./routes/evaluationRoutes'));
app.use('/api/audit-logs', require('./routes/auditRoutes'));
app.use('/api/notifications', require('./routes/notificationRoutes'));
app.use('/api/kb', require('./routes/kbRoutes'));
app.use('/api/analytics', require('./routes/analyticsRoutes'));
app.use('/api/endorsements', require('./routes/endorsementRoutes'));
app.use('/api/drill', require('./routes/drillRoutes'));
app.use('/api', require('./routes/miscRoutes'));

// ---------- Errors ----------
app.use(notFound);
app.use(errorHandler);

module.exports = app;
