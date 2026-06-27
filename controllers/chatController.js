 const supabase = require('../config/supabase');

const DEFAULT_DOCTOR_ID = '5b075375-0b21-4e67-91c8-1ab2c709fa85';

// ==============================================
// 1. إنشاء محادثة جديدة
// ==============================================
const createChatRoom = async (req, res) => {
  try {
    const doctorId = req.body.doctor_id || DEFAULT_DOCTOR_ID;

    const { data: room, error: roomError } = await supabase
      .from('chat_rooms')
      .insert([{
        doctor_id: doctorId,
        patient_name: 'Guest',
        patient_phone: null,
        status: 'active'
      }])
      .select()
      .single();

    if (roomError) throw roomError;

    const autoMessage = `👋 أهلاً بك! 
نرجو أن تخبرنا باسمك ورقم تليفونك للمتابعة.`;

    await supabase
      .from('chat_messages')
      .insert([{
        room_id: room.id,
        sender_type: 'system',
        message: autoMessage,
        is_read: false
      }]);

    res.status(201).json({
      success: true,
      message: 'Chat room created successfully',
      room: room,
      autoMessage: autoMessage
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

    const { data: rooms, error: roomsError } = await supabase
      .from('chat_rooms')
      .select('*')
      .eq('doctor_id', doctorId)
      .order('updated_at', { ascending: false });

    if (roomsError) throw roomsError;

    const roomsWithMessages = await Promise.all(rooms.map(async (room) => {
      const { data: lastMsg } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('room_id', room.id)
        .order('created_at', { ascending: false })
        .limit(1);

      const { count: unreadCount } = await supabase
        .from('chat_messages')
        .select('*', { count: 'exact', head: true })
        .eq('room_id', room.id)
        .eq('sender_type', 'patient')
        .eq('is_read', false);

      return {
        ...room,
        unread_count: unreadCount || 0,
        last_message: lastMsg?.[0] || null
      };
    }));

    res.json({
      success: true,
      rooms: roomsWithMessages,
      count: roomsWithMessages.length
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
// 3. جلب محادثة معينة (مع رسائلها)
// ==============================================
const getChatRoom = async (req, res) => {
  try {
    const { roomId } = req.params;

    const { data: room, error: roomError } = await supabase
      .from('chat_rooms')
      .select('*')
      .eq('id', roomId)
      .single();

    if (roomError || !room) {
      return res.status(404).json({
        success: false,
        error: 'Chat room not found'
      });
    }

    const { data: messages, error: msgError } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('room_id', roomId)
      .order('created_at', { ascending: true });

    if (msgError) {
      console.error('❌ Messages error:', msgError);
    }

    await supabase
      .from('chat_messages')
      .update({ is_read: true })
      .eq('room_id', roomId)
      .eq('sender_type', 'patient')
      .eq('is_read', false);

    res.json({
      success: true,
      room: {
        ...room,
        messages: messages || []
      }
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

    await supabase
      .from('chat_rooms')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', roomId);

    // استخراج الاسم والرقم
    if (senderType === 'patient') {
      const cleanMessage = message.trim();
      const phoneMatch = cleanMessage.match(/(01\d{9})/);
      let patientPhone = null;
      if (phoneMatch && phoneMatch[1]) {
        patientPhone = phoneMatch[1].trim();
      }

      let patientName = null;
      if (phoneMatch) {
        const textBeforePhone = cleanMessage.substring(0, phoneMatch.index).trim();
        const textAfterPhone = cleanMessage.substring(phoneMatch.index + phoneMatch[0].length).trim();
        let fullNameText = textBeforePhone;
        if (textAfterPhone) {
          fullNameText = fullNameText + ' ' + textAfterPhone;
        }
        if (fullNameText) {
          patientName = fullNameText
            .replace(/^(اسمي|الاسم|أنا|اسمى|اسم)\s*/i, '')
            .replace(/رقم\s*/i, '')
            .replace(/تلفون\s*/i, '')
            .replace(/phone\s*/i, '')
            .replace(/متابعة\s*/i, '')
            .trim();
        }
      }

      if (!patientName || patientName.length < 2) {
        const words = cleanMessage.split(/\s+/);
        const filteredWords = words.filter(w => 
          !['اسمي', 'الاسم', 'أنا', 'اسمى', 'اسم', 'رقم', 'تلفون', 'phone', 'متابعة'].includes(w.toLowerCase())
        );
        const nonPhoneWords = filteredWords.filter(w => !/^01\d{9}$/.test(w));
        if (nonPhoneWords.length >= 2) {
          patientName = nonPhoneWords.slice(0, 2).join(' ').trim();
        } else if (nonPhoneWords.length === 1) {
          patientName = nonPhoneWords[0].trim();
        }
      }

      if (!patientName || patientName.length < 1) {
        patientName = 'مريض';
      }
      if (patientName && patientName.length > 50) {
        patientName = patientName.substring(0, 50);
      }

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