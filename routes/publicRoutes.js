const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');

router.get('/doctor/:doctorId', async (req, res) => {
  try {
    const { doctorId } = req.params;
    const { data, error } = await supabase
      .from('doctors')
      .select('id, name, specialty, phone, clinic_address')
      .eq('id', doctorId)
      .single();

    if (error || !data) {
      return res.status(404).json({ success: false, error: 'Doctor not found' });
    }
    res.json({ success: true, doctor: data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/book-visit', async (req, res) => {
  try {
    const { doctor_id, patient_name, patient_phone, visit_date, visit_time, notes } = req.body;
    
    if (!doctor_id || !patient_name || !visit_date || !visit_time) {
      return res.status(400).json({ success: false, error: 'Missing required fields' });
    }

    const { data, error } = await supabase
      .from('patient_visits')
      .insert([{ doctor_id, patient_name, patient_phone, visit_date, visit_time, notes, status: 'pending' }])
      .select()
      .single();

    if (error) throw error;
    res.status(201).json({ success: true, message: 'Visit booked successfully!', visit: data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;