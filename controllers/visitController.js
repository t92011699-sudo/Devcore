 const supabase = require('../config/supabase');

// جلب الحجوزات
const getVisits = async (req, res) => {
  try {
    const doctorId = req.query.doctor_id || '5b075375-0b21-4e67-91c8-1ab2c709fa85';
    const { status } = req.query;

    let query = supabase
      .from('patient_visits')
      .select('*')
      .eq('doctor_id', doctorId)
      .order('visit_date', { ascending: true });

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;

    if (error) throw error;

    res.json({
      success: true,
      visits: data,
      count: data.length
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// تحديث حالة الحجز
const updateVisitStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status || !['pending', 'confirmed', 'cancelled', 'completed'].includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid status'
      });
    }

    const { data, error } = await supabase
      .from('patient_visits')
      .update({ status })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    res.json({
      success: true,
      message: `Visit ${status} successfully`,
      visit: data
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// حذف حجز
const deleteVisit = async (req, res) => {
  try {
    const { id } = req.params;
    const { error } = await supabase
      .from('patient_visits')
      .delete()
      .eq('id', id);

    if (error) throw error;

    res.json({
      success: true,
      message: 'Visit deleted successfully'
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

module.exports = {
  getVisits,
  updateVisitStatus,
  deleteVisit
};