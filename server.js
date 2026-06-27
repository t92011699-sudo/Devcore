 const express = require('express');
const cors = require('cors');
require('dotenv').config();
const http = require('http');
const socketIo = require('socket.io');

const authRoutes = require('./routes/authRoutes');
const patientRoutes = require('./routes/patientRoutes');
const publicRoutes = require('./routes/publicRoutes');
const chatRoutes = require('./routes/chatRoutes');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/patients', patientRoutes);
app.use('/api/public', publicRoutes);
app.use('/api/chat', chatRoutes);

// Home
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: '🏥 Clinic API is running with WebSocket',
    version: '1.0.0',
    test_account: {
      email: 'ahmed@clinic.com',
      password: '123456'
    }
  });
});

// ==============================================
// 🔌 WebSocket Events
// ==============================================
const doctorSockets = {};
const patientSockets = {};

io.on('connection', (socket) => {
  console.log('🟢 New client connected:', socket.id);

  // 1️⃣ انضمام للغرفة
  socket.on('join_room', (data) => {
    const { roomId, userId, userType } = data;
    socket.join(roomId);
    
    if (userType === 'doctor') {
      doctorSockets[userId] = socket.id;
    } else if (userType === 'patient') {
      patientSockets[userId] = socket.id;
    }

    console.log(`📌 Client joined room: ${roomId}`);
  });

  // 2️⃣ إرسال رسالة
  socket.on('send_message', async (data) => {
    try {
      const { roomId, senderId, senderType, message, messageType, fileUrl } = data;
      
      const supabase = require('./config/supabase');
      
      const { data: savedMessage, error } = await supabase
        .from('messages')
        .insert([{
          room_id: roomId,
          sender_type: senderType,
          sender_id: senderId,
          message: message || '',
          message_type: messageType || 'text',
          file_url: fileUrl || null,
          is_read: false
        }])
        .select()
        .single();

      if (error) {
        console.error('Error saving message:', error);
        socket.emit('message_error', { error: 'Failed to save message' });
        return;
      }

      // تحديث وقت آخر تحديث
      await supabase
        .from('chat_rooms')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', roomId);

      // إرسال الرسالة لكل الغرفة
      io.to(roomId).emit('new_message', savedMessage);

      // إشعار للمستخدم الآخر
      const roomData = await supabase
        .from('chat_rooms')
        .select('doctor_id, patient_id')
        .eq('id', roomId)
        .single();

      if (roomData.data) {
        const { doctor_id, patient_id } = roomData.data;
        const targetId = senderType === 'doctor' ? patient_id : doctor_id;
        const targetType = senderType === 'doctor' ? 'patient' : 'doctor';
        
        const targetSocketId = targetType === 'doctor' 
          ? doctorSockets[targetId] 
          : patientSockets[targetId];
        
        if (targetSocketId) {
          io.to(targetSocketId).emit('new_message_notification', {
            roomId,
            message: savedMessage,
            senderName: senderType === 'doctor' ? 'Doctor' : 'Patient'
          });
        }
      }

    } catch (error) {
      console.error('WebSocket error:', error);
      socket.emit('message_error', { error: 'Failed to send message' });
    }
  });

  // 3️⃣ مؤشر الكتابة
  socket.on('typing', (data) => {
    const { roomId, isTyping } = data;
    socket.to(roomId).emit('user_typing', { roomId, isTyping });
  });

  // 4️⃣ تحديث المقروء
  socket.on('mark_read', async (data) => {
    const { roomId, userId } = data;
    try {
      const supabase = require('./config/supabase');
      await supabase
        .from('messages')
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq('room_id', roomId)
        .neq('sender_id', userId)
        .eq('is_read', false);

      io.to(roomId).emit('messages_read', { roomId });
    } catch (error) {
      console.error('Error marking messages as read:', error);
    }
  });

  // 5️⃣ مغادرة الغرفة
  socket.on('leave_room', (data) => {
    const { roomId } = data;
    socket.leave(roomId);
    console.log(`📌 Client left room: ${roomId}`);
  });

  // 6️⃣ قطع الاتصال
  socket.on('disconnect', () => {
    console.log('🔴 Client disconnected:', socket.id);
  });
});

// Error handling
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    error: err.message || 'Something went wrong!'
  });
});

server.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📋 Test account: ahmed@clinic.com / 123456`);
  console.log(`✅ Supabase connected`);
  console.log(`🔌 WebSocket ready`);
});