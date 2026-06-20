 const supabase = require('../config/supabase');

// 🔓 استخدم doctor_id ثابت للتجربة
const DEFAULT_DOCTOR_ID = '5b075375-0b21-4e67-91c8-1ab2c709fa85';

// ==============================================
// 1. إنشاء محادثة جديدة
// ==============================================
const createChatRoom = async (req, res) => {
  try {
    const doctorId = req.body.doctor_id || DEFAULT_DOCTOR_ID;
    const { patient_id, patient_name, patient_phone } = req.body;

    // التحقق من البيانات
    if (!patient_id || !patient_name) {
      return res.status(400).json({
        success: false,
        error: 'Patient ID and name are required'
      });
    }

    // التحقق من وجود المريض
    const { data: patient, error: patientError } = await supabase
      .from('patients')
      .select('id, name, phone')
      .eq('id', patient_id)
      .single();

    if (patientError || !patient) {
      return res.status(404).json({
        success: false,
        error: 'Patient not found'
      });
    }

    // التحقق من عدم وجود محادثة مكررة
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

    // إنشاء المحادثة
    const { data, error } = await supabase
      .from('chat_rooms')
      .insert([{
        doctor_id: doctorId,
        patient_id: patient_id,
        patient_name: patient.name || patient_name,
        patient_phone: patient.phone || patient_phone || '',
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
    console.error('Create chat room error:', error);
    res.status(500).json({
      success: false,
      error: error.message
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
      .select('*')
      .eq('doctor_id', doctorId)
      .order('updated_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;

    if (error) throw error;

    res.json({
      success: true,
      rooms: data,
      count: data.length
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
// 3. جلب محادثة معينة مع رسائلها
// ==============================================
const getChatRoom = async (req, res) => {
  try {
    const { roomId } = req.params;

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

    res.json({
      success: true,
      room: room
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
// 4. تحديث حالة المحادثة
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
    console.error('Update chat room error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// ==============================================
// 5. حذف محادثة
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
    console.error('Delete chat room error:', error);
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
  updateChatRoomStatus,
  deleteChatRoom
};