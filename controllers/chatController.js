const supabase = require('../config/supabase');

// ============== إنشاء محادثة ==============
const createChatRoom = async (req, res) => {
  try {
    const doctorId = req.doctor.id;
    const { patient_id, patient_name, patient_phone } = req.body;

    if (!patient_id || !patient_name) {
      return res.status(400).json({
        success: false,
        error: 'Patient ID and name are required'
      });
    }

    // التأكد من وجود المريض
    const { data: patient, error: patientError } = await supabase
      .from('patients')
      .select('id, name, phone')
      .eq('id', patient_id)
      .eq('doctor_id', doctorId)
      .single();

    if (patientError || !patient) {
      return res.status(404).json({
        success: false,
        error: 'Patient not found or not authorized'
      });
    }

    // التأكد من عدم وجود محادثة مكررة
    const { data: existing, error: checkError } = await supabase
      .from('chat_rooms')
      .select('id, status')
      .eq('doctor_id', doctorId)
      .eq('patient_id', patient_id)
      .neq('status', 'archived')
      .single();

    if (existing) {
      return res.json({
        success: true,
        message: 'Chat room already exists',
        room: existing,
        isNew: false
      });
    }

    // إنشاء محادثة جديدة
    const { data, error } = await supabase
      .from('chat_rooms')
      .insert([{
        doctor_id: doctorId,
        patient_id: patient_id,
        patient_name: patient.name || patient_name,
        patient_phone: patient.phone || patient_phone,
        status: 'active'
      }])
      .select()
      .single();

    if (error) throw error;

    res.status(201).json({
      success: true,
      message: 'Chat room created successfully',
      room: data,
      isNew: true
    });

  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// ============== جلب كل المحادثات ==============
const getChatRooms = async (req, res) => {
  try {
    const doctorId = req.doctor.id;
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
          is_read,
          message_type,
          file_url
        )
      `)
      .eq('doctor_id', doctorId)
      .order('updated_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;

    if (error) throw error;

    // حساب الرسائل غير المقروءة
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
    res.status(500).json({ success: false, error: error.message });
  }
};

// ============== جلب محادثة معينة ==============
const getChatRoom = async (req, res) => {
  try {
    const { roomId } = req.params;
    const doctorId = req.doctor.id;

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
      .eq('doctor_id', doctorId)
      .single();

    if (error || !room) {
      return res.status(404).json({
        success: false,
        error: 'Chat room not found or not authorized'
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
      room: room
    });

  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// ============== تحديث حالة المحادثة ==============
const updateChatRoomStatus = async (req, res) => {
  try {
    const { roomId } = req.params;
    const { status } = req.body;
    const doctorId = req.doctor.id;

    if (!status || !['active', 'closed', 'archived'].includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid status. Must be: active, closed, archived'
      });
    }

    const { data, error } = await supabase
      .from('chat_rooms')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', roomId)
      .eq('doctor_id', doctorId)
      .select()
      .single();

    if (error || !data) {
      return res.status(404).json({
        success: false,
        error: 'Chat room not found or not authorized'
      });
    }

    res.json({
      success: true,
      message: `Chat room ${status} successfully`,
      room: data
    });

  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// ============== حذف محادثة ==============
const deleteChatRoom = async (req, res) => {
  try {
    const { roomId } = req.params;
    const doctorId = req.doctor.id;

    const { data: existing, error: checkError } = await supabase
      .from('chat_rooms')
      .select('id')
      .eq('id', roomId)
      .eq('doctor_id', doctorId)
      .single();

    if (checkError || !existing) {
      return res.status(404).json({
        success: false,
        error: 'Chat room not found or not authorized'
      });
    }

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
    res.status(500).json({ success: false, error: error.message });
  }
};

module.exports = {
  createChatRoom,
  getChatRooms,
  getChatRoom,
  updateChatRoomStatus,
  deleteChatRoom
};