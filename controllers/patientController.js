 const supabase = require('../config/supabase');

const DEFAULT_DOCTOR_ID = '5b075375-0b21-4e67-91c8-1ab2c709fa85';

// ============== جلب كل المرضى ==============
const getPatients = async (req, res) => {
  try {
    const doctorId = req.query.doctor_id || DEFAULT_DOCTOR_ID;
    const { status } = req.query; // ← جديد: فلتر حسب الحالة

    let query = supabase
      .from('patients')
      .select('*')
      .eq('doctor_id', doctorId)
      .order('created_at', { ascending: false });

    // فلتر حسب الحالة
    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;

    if (error) throw error;

    // إحصائيات الحالات
    const pending = data.filter(p => p.status === 'pending').length;
    const complete = data.filter(p => p.status === 'complete').length;

    res.json({
      success: true,
      patients: data,
      stats: {
        total: data.length,
        pending,
        complete
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// ============== إضافة مريض جديد ==============
const addPatient = async (req, res) => {
  try {
    const doctorId = req.body.doctor_id || DEFAULT_DOCTOR_ID;
    const { name, phone, email, age, gender, notes, status } = req.body;

    if (!name) {
      return res.status(400).json({ success: false, error: 'Name is required' });
    }

    const { data, error } = await supabase
      .from('patients')
      .insert([{
        doctor_id: doctorId,
        name,
        phone,
        email,
        age,
        gender,
        notes,
        status: status || 'pending' // ← جديد
      }])
      .select()
      .single();

    if (error) throw error;
    res.status(201).json({
      success: true,
      message: 'Patient added',
      patient: data
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// ============== تحديث مريض ==============
const updatePatient = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, phone, email, age, gender, notes, status } = req.body;

    const { data, error } = await supabase
      .from('patients')
      .update({
        name,
        phone,
        email,
        age,
        gender,
        notes,
        status // ← جديد
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    res.json({
      success: true,
      message: 'Patient updated',
      patient: data
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// ============== تحديث حالة المريض فقط ==============
const updatePatientStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status || !['pending', 'complete'].includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid status. Must be: pending or complete'
      });
    }

    const { data, error } = await supabase
      .from('patients')
      .update({ status })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    if (!data) {
      return res.status(404).json({
        success: false,
        error: 'Patient not found'
      });
    }

    res.json({
      success: true,
      message: `Patient status updated to ${status}`,
      patient: data
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// ============== حذف مريض ==============
const deletePatient = async (req, res) => {
  try {
    const { id } = req.params;
    const { error } = await supabase.from('patients').delete().eq('id', id);
    if (error) throw error;
    res.json({ success: true, message: 'Patient deleted' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

module.exports = {
  getPatients,
  addPatient,
  updatePatient,
  updatePatientStatus, // ← جديد
  deletePatient
};