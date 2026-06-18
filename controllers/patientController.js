const supabase = require('../config/supabase');

const DEFAULT_DOCTOR_ID = '5b075375-0b21-4e67-91c8-1ab2c709fa85';

const getPatients = async (req, res) => {
  try {
    const doctorId = req.query.doctor_id || DEFAULT_DOCTOR_ID;
    const { data, error } = await supabase
      .from('patients')
      .select('*')
      .eq('doctor_id', doctorId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json({ success: true, patients: data, count: data.length });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

const addPatient = async (req, res) => {
  try {
    const doctorId = req.body.doctor_id || DEFAULT_DOCTOR_ID;
    const { name, phone, email, age, gender, notes } = req.body;

    if (!name) {
      return res.status(400).json({ success: false, error: 'Name is required' });
    }

    const { data, error } = await supabase
      .from('patients')
      .insert([{ doctor_id: doctorId, name, phone, email, age, gender, notes }])
      .select()
      .single();

    if (error) throw error;
    res.status(201).json({ success: true, message: 'Patient added', patient: data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

const updatePatient = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, phone, email, age, gender, notes } = req.body;

    const { data, error } = await supabase
      .from('patients')
      .update({ name, phone, email, age, gender, notes })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    res.json({ success: true, message: 'Patient updated', patient: data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

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

module.exports = { getPatients, addPatient, updatePatient, deletePatient };