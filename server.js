 const express = require('express');
const cors = require('cors');
require('dotenv').config();
const path = require('path');

const authRoutes = require('./routes/authRoutes');
const patientRoutes = require('./routes/patientRoutes');
const publicRoutes = require('./routes/publicRoutes');
const chatRoutes = require('./routes/chatRoutes');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: '*', // للتطوير، يمكنك تحديد domains معينة في الإنتاج
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ✅ خدمة الملفات الثابتة (الصفحات)
app.use(express.static(path.join(__dirname, 'public')));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/patients', patientRoutes);
app.use('/api/public', publicRoutes);
app.use('/api/chat', chatRoutes);

// Home route
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: '🏥 Clinic API is running',
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    endpoints: {
      auth: '/api/auth',
      patients: '/api/patients',
      public: '/api/public',
      chat: '/api/chat'
    },
    test_account: {
      email: 'ahmed@clinic.com',
      password: '123456'
    }
  });
});

// Health check
app.get('/health', (req, res) => {
  res.json({
    success: true,
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found'
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('❌ Error:', err.stack);
  res.status(err.status || 500).json({
    success: false,
    error: err.message || 'Internal server error'
  });
});

// تشغيل السيرفر (للتطوير المحلي)
if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`📋 Test account: ahmed@clinic.com / 123456`);
    console.log(`✅ Supabase connected`);
    console.log(`📁 Static files served from: ${path.join(__dirname, 'public')}`);
  });
}

// للـ Vercel
module.exports = app;