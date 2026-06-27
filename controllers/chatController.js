 const supabase = require('../config/supabase');

const DEFAULT_DOCTOR_ID = '5b075375-0b21-4e67-91c8-1ab2c709fa85';

// ==============================================
// 1. إنشاء محادثة جديدة
// ==============================================
const createChatRoom = async (req, res) => {
  try {
    console.log('📥 Received body:', req.body);

    const doctorId = req.body.doctor_id || DEFAULT_DOCTOR_ID;
    const { patient_name, patient_phone } = req.body;

    if (!patient_name || !patient_phone) {
      return res.status(400).json({
        success: false,
        error: 'Patient name and phone are required'
      });
    }

    let patientId = null;
    const { data: existingPatient } = await supabase
      .from('patients')
      .select('id')
      .eq('phone', patient_phone)
      .eq('doctor_id', doctorId)
      .maybeSingle();

    if (existingPatient) {
      patientId = existingPatient.id;
    } else {
      const { data: newPatient, error: createError } = await supabase
        .from('patients')
        .insert([{
          doctor_id: doctorId,
          name: patient_name,
          phone: patient_phone,
          status: 'pending'
        }])
        .select()
        .single();

      if (createError) {
        console.error('❌ Create patient error:', createError);
        return res.status(500).json({
          success: false,
          error: 'Failed to create patient: ' + createError.message
        });
      }
      patientId = newPatient.id;
    }

    const { data: newRoom, error: roomError } = await supabase
      .from('chat_rooms')
      .insert([{
        doctor_id: doctorId,
        patient_id: patientId,
        patient_name: patient_name,
        patient_phone: patient_phone,
        status: 'active'
      }])
      .select()
      .single();

    if (roomError) {
      console.error('❌ Create room error:', roomError);
      return res.status(500).json({
        success: false,
        error: 'Failed to create chat room: ' + roomError.message
      });
    }

    const autoMessage = `👋 مرحباً بك! 
أنا الدكتور، يرجى إدخال اسمك الكامل ورقم التليفون الخاص بك لتأكيد الحجز.`;

    const { data: messageData, error: msgError } = await supabase
      .from('messages')
      .insert([{
        room_id: newRoom.id,
        sender_type: 'doctor',
        sender_id: doctorId,
        message: autoMessage,
        message_type: 'text',
        is_read: false
      }])
      .select()
      .single();

    if (msgError) {
      console.error('⚠️ Auto message error:', msgError);
    }

    res.status(201).json({
      success: true,
      message: 'Chat room created successfully',
      room: newRoom,
      autoMessage: messageData || null,
      isNew: true
    });

  } catch (error) {
    console.error('❌ Create chat room error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Internal server error'
    });
  }
};

// ==============================================
// 2. جلب كل المحادثات
// ==============================================
const getChatRooms = async (req, res) => {
  try {
    const doctorId = req.query.doctor_id || DEFAULT_DOCTOR_ID;
    const { status } = req.query;

    let query = supabase
      .from('chat_rooms')
      .select(`
        *,
        messages:messages(
          id,
          message,
          sender_type,
          created_at,
          is_read
        )
      `)
      .eq('doctor_id', doctorId)
      .order('updated_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;

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
// 3. جلب محادثة معينة (مع رسائلها)
// ==============================================
const getChatRoom = async (req, res) => {
  try {
    const { roomId } = req.params;
    console.log('📌 Fetching room:', roomId);

    const { data: room, error: roomError } = await supabase
      .from('chat_rooms')
      .select('*')
      .eq('id', roomId)
      .single();

    if (roomError) {
      console.error('❌ Room error:', roomError);
      return res.status(404).json({
        success: false,
        error: 'Chat room not found: ' + roomError.message
      });
    }

    if (!room) {
      return res.status(404).json({
        success: false,
        error: 'Chat room not found'
      });
    }

    const { data: messages, error: msgError } = await supabase
      .from('messages')
      .select('*')
      .eq('room_id', roomId)
      .order('created_at', { ascending: true });

    if (msgError) {
      console.error('❌ Messages error:', msgError);
    }

    await supabase
      .from('messages')
      .update({ is_read: true, read_at: new Date().toISOString() })
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
      error: error.message || 'Internal server error'
    });
  }
};

// ==============================================
// 4. إرسال رسالة (مع استخراج الاسم والرقم)
// ==============================================
const sendMessage = async (req, res) => {
  try {
    const { roomId, message, senderType, senderId, messageType, fileUrl } = req.body;
    
    console.log('📥 Received:', { roomId, message, senderType, senderId });

    // 1. التحقق من البيانات
    if (!roomId || !message) {
      return res.status(400).json({
        success: false,
        error: 'Room ID and message are required'
      });
    }

    // 2. جلب المحادثة
    const { data: room, error: roomError } = await supabase
      .from('chat_rooms')
      .select('*')
      .eq('id', roomId)
      .single();

    if (roomError || !room) {
      console.error('❌ Room error:', roomError);
      return res.status(404).json({
        success: false,
        error: 'Chat room not found'
      });
    }

    // 3. حفظ الرسالة
    const { data: savedMessage, error: msgError } = await supabase
      .from('messages')
      .insert([{
        room_id: roomId,
        sender_type: senderType || 'patient',
        sender_id: senderId || room.patient_id || 'unknown',
        message: message,
        message_type: messageType || 'text',
        file_url: fileUrl || null,
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

    // 4. تحديث وقت المحادثة
    await supabase
      .from('chat_rooms')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', roomId);

    // 5. استخراج الاسم والرقم من الرسالة
    const cleanMessage = message.trim();
    const phoneMatch = cleanMessage.match(/(01\d{9})/);
    const nameMatch = cleanMessage.match(/اسمي\s+([^\d]+)/i) || 
                      cleanMessage.match(/الاسم\s+([^\d]+)/i) ||
                      cleanMessage.match(/أنا\s+([^\d]+)/i);

    let patientName = null;
    let patientPhone = null;

    if (nameMatch && nameMatch[1]) {
      patientName = nameMatch[1]
        .replace(/\d/g, '')
        .replace(/رقم\s*:/i, '')
        .replace(/تلفون\s*:/i, '')
        .trim();
    }
    if (phoneMatch && phoneMatch[1]) {
      patientPhone = phoneMatch[1].trim();
    }

    // 6. تحديث بيانات المريض لو اتوجدت
    if (patientName && patientPhone && senderType === 'patient') {
      await supabase
        .from('chat_rooms')
        .update({
          patient_name: patientName,
          patient_phone: patientPhone
        })
        .eq('id', roomId);

      await supabase
        .from('patients')
        .update({
          name: patientName,
          phone: patientPhone
        })
        .eq('id', room.patient_id);
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
      error: error.message || 'Internal server error'
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
        error: 'Invalid status. Must be: active, closed, archived'
      });
    }

    const { data, error } = await supabase
      .from('chat_rooms')
      .update({
        status,
        updated_at: new Date().toISOString()
      })
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

// ==============================================
// 7. تحديث بيانات المريض من المحادثة
// ==============================================
const updatePatientFromChat = async (req, res) => {
  try {
    const { roomId } = req.params;
    const { patient_name, patient_phone } = req.body;

    if (!patient_name || !patient_phone) {
      return res.status(400).json({
        success: false,
        error: 'Patient name and phone are required'
      });
    }

    const { data: room, error: roomError } = await supabase
      .from('chat_rooms')
      .select('patient_id')
      .eq('id', roomId)
      .single();

    if (roomError || !room) {
      return res.status(404).json({
        success: false,
        error: 'Chat room not found'
      });
    }

    const { data: patient, error: patientError } = await supabase
      .from('patients')
      .update({
        name: patient_name,
        phone: patient_phone
      })
      .eq('id', room.patient_id)
      .select()
      .single();

    if (patientError) throw patientError;

    const { data: updatedRoom, error: updateError } = await supabase
      .from('chat_rooms')
      .update({
        patient_name: patient_name,
        patient_phone: patient_phone
      })
      .eq('id', roomId)
      .select()
      .single();

    if (updateError) throw updateError;

    res.json({
      success: true,
      message: 'Patient info updated successfully',
      patient: patient,
      room: updatedRoom
    });

  } catch (error) {
    console.error('❌ Update patient from chat error:', error);
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
  deleteChatRoom,
  updatePatientFromChat
};