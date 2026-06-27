const supabase = require('../config/supabase');

const DEFAULT_DOCTOR_ID = '5b075375-0b21-4e67-91c8-1ab2c709fa85';

// ==============================================
// 1. إنشاء محادثة جديدة
// ==============================================
const createChatRoom = async (req, res) => {
  try {
    const doctorId = req.body.doctor_id || DEFAULT_DOCTOR_ID;

    const { data, error } = await supabase
      .from('chat_rooms')
      .insert([{
        doctor_id: doctorId,
        patient_name: 'Guest',
        patient_phone: null,
        status: 'active'
      }])
      .select()
      .single();

    if (error) throw error;

    // رسالة ترحيب مثبتة من الدكتور
    const autoMessage = `👋 مرحباً بك! 
أنا الدكتور، يرجى إدخال اسمك الكامل ورقم التليفون الخاص بك لتأكيد الحجز.`;

    await supabase
      .from('chat_messages')
      .insert([{
        room_id: data.id,
        sender_type: 'doctor',
        message: autoMessage,
        is_read: false
      }]);

    res.status(201).json({
      success: true,
      message: 'Chat room created successfully',
      room: data
    });

  } catch (error) {
    console.error('❌ Create chat room error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// ==============================================
// 2. جلب كل المحادثات (للدكتور)
// ==============================================
const getChatRooms = async (req, res) => {
  try {
    const doctorId = req.query.doctor_id || DEFAULT_DOCTOR_ID;

    const { data, error } = await supabase
      .from('chat_rooms')
      .select(`
        *,
        messages:chat_messages(
          id,
          message,
          sender_type,
          created_at,
          is_read
        )
      `)
      .eq('doctor_id', doctorId)
      .order('updated_at', { ascending: false });

    if (error) throw error;

    const roomsWithUnread = data.map(room => {
      const unreadCount = room.messages?.filter(
        m => m.sender_type === 'patient' && !m.is_read
      ).length || 0;
      
      const lastMessage = room.messages?.[room.messages.length - 1] || null;

      return {
        ...room,
        unread_count: unreadCount,
        last_message: lastMessage
      };
    });

    res.json({
      success: true,
      rooms: roomsWithUnread,
      count: roomsWithUnread.length
    });

  } catch (error) {
    console.error('❌ Get chat rooms error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// ==============================================
// 3. جلب محادثة معينة
// ==============================================
const getChatRoom = async (req, res) => {
  try {
    const { roomId } = req.params;

    const { data: room, error } = await supabase
      .from('chat_rooms')
      .select(`
        *,
        messages:chat_messages(
          id,
          message,
          sender_type,
          created_at,
          is_read
        )
      `)
      .eq('id', roomId)
      .single();

    if (error || !room) {
      return res.status(404).json({
        success: false,
        error: 'Chat room not found'
      });
    }

    // تحديث الرسائل غير المقروءة
    await supabase
      .from('chat_messages')
      .update({ is_read: true })
      .eq('room_id', roomId)
      .eq('sender_type', 'patient')
      .eq('is_read', false);

    res.json({
      success: true,
      room: room
    });

  } catch (error) {
    console.error('❌ Get chat room error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// ==============================================
// 4. إرسال رسالة
// ==============================================
const sendMessage = async (req, res) => {
  try {
    const { roomId, senderType, message } = req.body;

    if (!roomId || !message) {
      return res.status(400).json({
        success: false,
        error: 'Room ID and message are required'
      });
    }

    // حفظ الرسالة
    const { data: savedMessage, error: msgError } = await supabase
      .from('chat_messages')
      .insert([{
        room_id: roomId,
        sender_type: senderType || 'patient',
        message: message,
        is_read: false
      }])
      .select()
      .single();

    if (msgError) {
      console.error('❌ Message error:', msgError);
      return res.status(500).json({
        success: false,
        error: 'Failed to save message: ' + msgError.message
      });
    }

    // تحديث وقت المحادثة
    await supabase
      .from('chat_rooms')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', roomId);

    // ==========================================
    // 🔍 استخراج الاسم والرقم من رسالة المريض
    // ==========================================
    if (senderType === 'patient') {
      const cleanMessage = message.trim();
      const phoneMatch = cleanMessage.match(/(01\d{9})/);
      const nameMatch = cleanMessage.match(/اسمي\s+([^\d]+)/i) || 
                        cleanMessage.match(/الاسم\s+([^\d]+)/i) ||
                        cleanMessage.match(/أنا\s+([^\d]+)/i);

      let patientName = null;
      let patientPhone = null;

      if (nameMatch && nameMatch[1]) {
        patientName = nameMatch[1].replace(/\d/g, '').trim();
      }
      if (phoneMatch && phoneMatch[1]) {
        patientPhone = phoneMatch[1].trim();
      }

      // لو لقينا الاسم والرقم، نحدث المحادثة
      if (patientName && patientPhone) {
        await supabase
          .from('chat_rooms')
          .update({
            patient_name: patientName,
            patient_phone: patientPhone
          })
          .eq('id', roomId);
      }
    }

    res.status(201).json({
      success: true,
      message: 'Message sent successfully',
      data: savedMessage
    });

  } catch (error) {
    console.error('❌ Send message error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// ==============================================
// 5. تحديث حالة المحادثة
// ==============================================
const updateChatRoomStatus = async (req, res) => {
  try {
    const { roomId } = req.params;
    const { status } = req.body;

    if (!status || !['active', 'closed', 'archived'].includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid status'
      });
    }

    const { data, error } = await supabase
      .from('chat_rooms')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', roomId)
      .select()
      .single();

    if (error || !data) {
      return res.status(404).json({
        success: false,
        error: 'Chat room not found'
      });
    }

    res.json({
      success: true,
      message: `Chat room ${status} successfully`,
      room: data
    });

  } catch (error) {
    console.error('❌ Update chat room error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// ==============================================
// 6. حذف محادثة
// ==============================================
const deleteChatRoom = async (req, res) => {
  try {
    const { roomId } = req.params;

    const { error } = await supabase
      .from('chat_rooms')
      .delete()
      .eq('id', roomId);

    if (error) throw error;

    res.json({
      success: true,
      message: 'Chat room deleted successfully'
    });

  } catch (error) {
    console.error('❌ Delete chat room error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

module.exports = {
  createChatRoom,
  getChatRooms,
  getChatRoom,
  sendMessage,
  updateChatRoomStatus,
  deleteChatRoom
};