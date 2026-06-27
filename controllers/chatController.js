 const supabase = require('../config/supabase');

const DEFAULT_DOCTOR_ID = '5b075375-0b21-4e67-91c8-1ab2c709fa85';

// ==============================================
// 1. إنشاء محادثة جديدة
// ==============================================
const createChatRoom = async (req, res) => {
  try {
    const doctorId = req.body.doctor_id || DEFAULT_DOCTOR_ID;
    const { patient_name, patient_phone } = req.body;

    if (!patient_name || !patient_phone) {
      return res.status(400).json({
        success: false,
        error: 'Patient name and phone are required'
      });
    }

    console.log('📥 Creating chat room for:', { patient_name, patient_phone });

    const { data: room, error: roomError } = await supabase
      .from('chat_rooms')
      .insert([{
        doctor_id: doctorId,
        patient_name: patient_name,
        patient_phone: patient_phone,
        status: 'active'
      }])
      .select()
      .single();

    if (roomError) {
      console.error('❌ Room creation error:', roomError);
      throw roomError;
    }

    console.log('✅ Room created:', room.id);

    const autoMessage = `👋 أهلاً بك يا ${patient_name}! 
نرحب بك في عيادتنا، سنتواصل معك قريباً للمتابعة.`;

    const { data: messageData, error: msgError } = await supabase
      .from('chat_messages')
      .insert([{
        room_id: room.id,
        sender_type: 'system',
        message: autoMessage,
        is_read: false
      }])
      .select()
      .single();

    if (msgError) {
      console.error('❌ Message insertion error:', msgError);
    } else {
      console.log('✅ Auto message saved:', messageData.id);
    }

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

      const lastMessage = lastMsg?.[0] || null;
      if (lastMessage) {
        lastMessage.alignment = lastMessage.sender_type === 'patient' ? 'left' : 'right';
      }

      return {
        ...room,
        unread_count: unreadCount || 0,
        last_message: lastMessage
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

    // ✅ إضافة alignment لكل رسالة
    const messagesWithAlignment = (messages || []).map(msg => ({
      ...msg,
      alignment: msg.sender_type === 'patient' ? 'left' : 'right'
    }));

    res.json({
      success: true,
      room: {
        ...room,
        messages: messagesWithAlignment
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