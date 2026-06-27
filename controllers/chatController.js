 const supabase = require('../config/supabase');

const DEFAULT_DOCTOR_ID = '5b075375-0b21-4e67-91c8-1ab2c709fa85';

// ==============================================
// 1. إنشاء محادثة جديدة (للمريض من الصفحة العامة)
// ==============================================
const createChatRoom = async (req, res) => {
  try {
    const doctorId = req.body.doctor_id || DEFAULT_DOCTOR_ID;
    const { patient_name, patient_phone } = req.body;

    // التحقق من البيانات
    if (!patient_name || !patient_phone) {
      return res.status(400).json({
        success: false,
        error: 'Patient name and phone are required'
      });
    }

    // البحث عن مريض بنفس الرقم
    let patientId = null;
    const { data: existingPatient, error: patientError } = await supabase
      .from('patients')
      .select('id')
      .eq('phone', patient_phone)
      .eq('doctor_id', doctorId)
      .single();

    if (!patientError && existingPatient) {
      patientId = existingPatient.id;
    } else {
      // إنشاء مريض جديد
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

      if (createError) throw createError;
      patientId = newPatient.id;
    }

    // التحقق من وجود محادثة مكررة
    const { data: existingRoom, error: checkError } = await supabase
      .from('chat_rooms')
      .select('id, status')
      .eq('doctor_id', doctorId)
      .eq('patient_id', patientId)
      .neq('status', 'archived')
      .single();

    if (existingRoom) {
      return res.json({
        success: true,
        message: 'Chat room already exists',
        room: existingRoom,
        isNew: false
      });
    }

    // إنشاء المحادثة
    const { data, error } = await supabase
      .from('chat_rooms')
      .insert([{
        doctor_id: doctorId,
        patient_id: patientId,
        patient_name: 'Guest',
        patient_phone: patient_phone,
        status: 'active'
      }])
      .select()
      .single();

    if (error) throw error;

    // إرسال رسالة تلقائية من الدكتور تطلب الاسم ورقم التليفون
    const autoMessage = `👋 مرحباً بك! 
أنا الدكتور، يرجى إدخال اسمك الكامل ورقم التليفون الخاص بك لتأكيد الحجز.`;

    const { data: messageData, error: msgError } = await supabase
      .from('messages')
      .insert([{
        room_id: data.id,
        sender_type: 'doctor',
        sender_id: doctorId,
        message: autoMessage,
        message_type: 'text',
        is_read: false
      }])
      .select()
      .single();

    if (msgError) throw msgError;

    res.status(201).json({
      success: true,
      message: 'Chat room created successfully',
      room: data,
      autoMessage: messageData,
      isNew: true
    });

  } catch (error) {
    console.error('Create chat room error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// ==============================================
// 2. تحديث بيانات المريض من المحادثة
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

    // جلب المحادثة
    const { data: room, error: roomError } = await supabase
      .from('chat_rooms')
      .select('patient_id, doctor_id')
      .eq('id', roomId)
      .single();

    if (roomError || !room) {
      return res.status(404).json({
        success: false,
        error: 'Chat room not found'
      });
    }

    // تحديث المريض
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

    // تحديث المحادثة باسم المريض
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
    console.error('Update patient from chat error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// ==============================================
// 3. جلب كل المحادثات (مع فرز حسب الحالة)
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

    // حساب عدد الرسائل غير المقروءة
    const roomsWithUnread = data.map(room => {
      const unreadCount = room.messages?.filter(
        m => m.sender_type === 'patient' && !m.is_read
      ).length || 0;
      
      const lastMessage = room.messages?.[room.messages.length - 1] || null;

      return {
        ...room,
        unread_count: unreadCount,
        last_message: lastMessage,
        is_guest: room.patient_name === 'Guest' // ← تحديد إذا كان ضيف
      };
    });

    res.json({
      success: true,
      rooms: roomsWithUnread,
      count: roomsWithUnread.length
    });

  } catch (error) {
    console.error('Get chat rooms error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// ==============================================
// 4. جلب محادثة معينة (مع تحديث المقروء)
// ==============================================
const getChatRoom = async (req, res) => {
  try {
    const { roomId } = req.params;
    const doctorId = req.query.doctor_id || DEFAULT_DOCTOR_ID;

    const { data: room, error } = await supabase
      .from('chat_rooms')
      .select(`
        *,
        messages:messages(
          id,
          message,
          sender_type,
          sender_id,
          created_at,
          is_read,
          message_type,
          file_url
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
      .from('messages')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('room_id', roomId)
      .eq('sender_type', 'patient')
      .eq('is_read', false);

    res.json({
      success: true,
      room: room,
      is_guest: room.patient_name === 'Guest'
    });

  } catch (error) {
    console.error('Get chat room error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// ==============================================
// 5. إرسال رسالة (مع تحديث المحادثة)
// ==============================================
const sendMessage = async (req, res) => {
  try {
    const { roomId, message, senderType, senderId, messageType, fileUrl } = req.body;

    if (!roomId || !message) {
      return res.status(400).json({
        success: false,
        error: 'Room ID and message are required'
      });
    }

    // جلب المحادثة
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

    // حفظ الرسالة
    const { data: savedMessage, error: msgError } = await supabase
      .from('messages')
      .insert([{
        room_id: roomId,
        sender_type: senderType || 'patient',
        sender_id: senderId || room.patient_id,
        message: message,
        message_type: messageType || 'text',
        file_url: fileUrl || null,
        is_read: false
      }])
      .select()
      .single();

    if (msgError) throw msgError;

    // تحديث وقت المحادثة
    await supabase
      .from('chat_rooms')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', roomId);

    // ==========================================
    // 🔍 التحقق من الرسالة: هل فيها اسم ورقم؟
    // ==========================================
    const nameMatch = message.match(/اسمي\s+([^\d]+)/i) || 
                      message.match(/الاسم\s+([^\d]+)/i) ||
                      message.match(/أنا\s+([^\d]+)/i);
    const phoneMatch = message.match(/(01\d{9})/);

    let patientName = null;
    let patientPhone = null;

    if (nameMatch && nameMatch[1]) {
      patientName = nameMatch[1].trim();
    }

    if (phoneMatch && phoneMatch[1]) {
      patientPhone = phoneMatch[1].trim();
    }

    // لو تم العثور على الاسم والرقم، نحدث المحادثة
    if (patientName && patientPhone && senderType === 'patient') {
      const { data: updatedRoom, error: updateError } = await supabase
        .from('chat_rooms')
        .update({
          patient_name: patientName,
          patient_phone: patientPhone
        })
        .eq('id', roomId)
        .select()
        .single();

      if (!updateError) {
        // تحديث المريض في جدول patients
        await supabase
          .from('patients')
          .update({
            name: patientName,
            phone: patientPhone
          })
          .eq('id', room.patient_id);
      }
    }

    res.status(201).json({
      success: true,
      message: 'Message sent successfully',
      data: savedMessage,
      patient_updated: !!(patientName && patientPhone)
    });

  } catch (error) {
    console.error('Send message error:', error);
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
  updatePatientFromChat,
  sendMessage,
  updateChatRoomStatus,
  deleteChatRoom
};