const express = require('express');
const router = express.Router();
const {
  createChatRoom,
  getChatRooms,
  getChatRoom,
  sendMessage,
  updateChatRoomStatus,
  deleteChatRoom
} = require('../controllers/chatController');

// ===== Chat Rooms =====
router.post('/rooms', createChatRoom);
router.get('/rooms', getChatRooms);
router.get('/rooms/:roomId', getChatRoom);
router.put('/rooms/:roomId/status', updateChatRoomStatus);
router.delete('/rooms/:roomId', deleteChatRoom);

// ===== Chat Messages =====
router.post('/messages', sendMessage);

module.exports = router;