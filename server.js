 const express = require('express');
const cors = require('cors');
require('dotenv').config();

const authRoutes = require('./routes/authRoutes');
const patientRoutes = require('./routes/patientRoutes');
const publicRoutes = require('./routes/publicRoutes');
const chatRoutes = require('./routes/chatRoutes');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api/auth', authRoutes);
app.use('/api/patients', patientRoutes);
app.use('/api/public', publicRoutes);
app.use('/api/chat', chatRoutes); // ✅ Chat routes

app.get('/', (req, res) => {
  res.json({
    success: true,
    message: '🏥 Clinic API with Chat',
    test_account: {
      email: 'ahmed@clinic.com',
      password: '123456'
    }
  });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    error: err.message || 'Something went wrong!'
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📋 Test account: ahmed@clinic.com / 123456`);
  console.log(`✅ Supabase connected`);
});