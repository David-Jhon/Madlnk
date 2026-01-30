const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');

const app = express();

const SESSION_SECRET = process.env.SESSION_SECRET || 'your-secret-key-change-this';

// Middleware
app.use(cookieParser(SESSION_SECRET));
app.use(express.json());

// Authentication middleware using Signed Cookies
const requireAuth = (req, res, next) => {
  if (req.signedCookies.admin_token) {
    return next();
  }

  if (req.path.startsWith('/api')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  res.redirect('/login');
};

const protectedStatic = (req, res, next) => {
  const publicPaths = [
    '/login',
    '/login.html',
    '/api/auth/login',
    '/api/auth/logout',
    '/api/auth/check'
  ];

  if (publicPaths.includes(req.path)) {
    return next();
  }

  const referer = req.get('Referer');
  if (referer && (referer.endsWith('/login') || referer.endsWith('/login.html'))) {
    return next();
  }

  if (req.path.endsWith('.css') || req.path.endsWith('.js') || req.path.endsWith('.png') || req.path.endsWith('.jpg') || req.path.endsWith('.svg')) {
    return next();
  }

  if (req.signedCookies.admin_token) {
    return next();
  }

  if (req.path.endsWith('.html') || req.path === '/') {
    return res.redirect('/login');
  }

  return res.status(401).send('Unauthorized');
};

const userModel = require('./DB/User.js');

// Health check - no auth required
app.get('/healthz', (req, res) => {
  res.status(200).send('OK');
});

const startTime = Date.now();

// Uptime - no auth required
app.get("/uptime", (req, res) => {
  const currentTime = Date.now();
  const uptimeMilliseconds = currentTime - startTime;
  const uptimeSeconds = Math.floor(uptimeMilliseconds / 1000);
  const uptimeMinutes = Math.floor(uptimeSeconds / 60);
  const uptimeHours = Math.floor(uptimeMinutes / 60);
  const uptimeDays = Math.floor(uptimeHours / 24);
  const remainingHours = uptimeHours % 24;
  const remainingMinutes = uptimeMinutes % 60;
  const remainingSeconds = uptimeSeconds % 60;

  const uptimeString = `
    <h2>Bot's Uptime:</h2>
      <p>${uptimeDays} days, ${remainingHours} hours, ${remainingMinutes} minutes, ${remainingSeconds} seconds<p>
      <p>(Started at: ${new Date(startTime).toLocaleString()})</p>
  `;

  res.set('Content-Type', 'text/html');
  res.send(uptimeString);
});

// API Routes
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const analyticsRoutes = require('./routes/analyticsRoutes');
const settingsRoutes = require('./routes/settingsRoutes');
const broadcastRoutes = require('./routes/broadcastRoutes');
const postRoutes = require('./routes/postRoutes');
const templateRoutes = require('./routes/templateRoutes');
const cronRoutes = require('./routes/cronRoutes');

app.use('/api/auth', authRoutes);

// Protected API routes
app.use('/api/users', requireAuth, userRoutes);
app.use('/api/analytics', requireAuth, analyticsRoutes);
app.use('/api/settings', requireAuth, settingsRoutes);
app.use('/api/broadcast', requireAuth, broadcastRoutes);
app.use('/api/posts', requireAuth, postRoutes);
app.use('/api/templates', requireAuth, templateRoutes);
app.use('/api/cron', requireAuth, require('./routes/cronRoutes'));

// Stats API - protected
app.get('/api/stats', requireAuth, async (req, res) => {
  try {
    const currentTime = Date.now();
    const uptimeMilliseconds = currentTime - startTime;
    const uptimeSeconds = Math.floor(uptimeMilliseconds / 1000);
    const uptimeMinutes = Math.floor(uptimeSeconds / 60);
    const uptimeHours = Math.floor(uptimeMinutes / 60);
    const uptimeDays = Math.floor(uptimeHours / 24);
    const remainingHours = uptimeHours % 24;
    const remainingMinutes = uptimeMinutes % 60;

    const userCount = await userModel.countDocuments({});
    const recentUsers = await userModel.find({})
      .sort({ joined: -1 })
      .limit(5)
      .select('firstName lastName username joined lastActivity');

    res.json({
      uptime: {
        days: uptimeDays,
        hours: remainingHours,
        minutes: remainingMinutes
      },
      users: userCount,
      recentUsers: recentUsers,
      status: 'Online'
    });
  } catch (error) {
    console.error("Error fetching stats:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.use(protectedStatic);

app.use(express.static(path.join(__dirname, 'page')));

app.get('/login', (req, res) => {
  if (req.signedCookies.admin_token) {
    return res.redirect('/');
  }
  res.sendFile(path.join(__dirname, 'page', 'login.html'));
});

app.get('/login.html', (req, res) => {
  res.redirect('/login');
});

// Root route
app.get('/', (req, res) => {
  if (req.signedCookies.admin_token) {
    res.sendFile(path.join(__dirname, 'page', 'index.html'));
  } else {
    res.redirect('/login');
  }
});

module.exports = app;
