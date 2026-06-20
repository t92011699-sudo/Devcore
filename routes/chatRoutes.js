const express = require('express');
const router = express.Router();
const {
  createChatRoom,
  getChatRooms,
  getChatRoom,
  updateChatRoomStatus,
  deleteChatRoom
} = require('../controllers/chatController');

// 🔓 بدون توثيق - للاختبار
// ملاحظة: لو عايز تحميها، هاتفعل auth بعدين

router.post('/rooms', createChatRoom);
router.get('/rooms', getChatRooms);
router.get('/rooms/:roomId', getChatRoom);
router.put('/rooms/:roomId/status', updateChatRoomStatus);
router.delete('/rooms/:roomId', deleteChatRoom);

module.exports = router;