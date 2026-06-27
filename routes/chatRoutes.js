const express = require('express');
const router = express.Router();
const {
  createChatRoom,
  getChatRooms,
  getChatRoom,
  updatePatientFromChat,
  sendMessage,
  updateChatRoomStatus,
  deleteChatRoom
} = require('../controllers/chatController');

// 🔓 بدون توثيق للاختبار

// ===== Chat Rooms =====
router.post('/rooms', createChatRoom);                      // إنشاء محادثة (للمريض)
router.get('/rooms', getChatRooms);                          // جلب كل المحادثات
router.get('/rooms/:roomId', getChatRoom);                   // جلب محادثة معينة
router.put('/rooms/:roomId/status', updateChatRoomStatus);   // تحديث حالة المحادثة
router.delete('/rooms/:roomId', deleteChatRoom);             // حذف محادثة

// ===== Chat Messages =====
router.post('/messages', sendMessage);                      // إرسال رسالة

// ===== Update Patient =====
router.put('/rooms/:roomId/patient', updatePatientFromChat); // تحديث بيانات المريض

module.exports = router;