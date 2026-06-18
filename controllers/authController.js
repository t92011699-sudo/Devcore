const supabase = require('../config/supabase');
const jwt = require('jsonwebtoken');

const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    const { data: doctor, error } = await supabase
      .from('doctors')
      .select('*')
      .eq('email', email)
      .single();

    if (error || !doctor || password !== doctor.password) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { id: doctor.id, email: doctor.email },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      token,
      doctor: {
        id: doctor.id,
        name: doctor.name,
        email: doctor.email,
        specialty: doctor.specialty
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const register = async (req, res) => {
  try {
    const { name, email, password, specialty } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email, and password required' });
    }

    const { data, error } = await supabase
      .from('doctors')
      .insert([{ name, email, password, specialty }])
      .select()
      .single();

    if (error) throw error;

    res.status(201).json({ success: true, message: 'Doctor registered', doctor: data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getProfile = async (req, res) => {
  res.json({ success: true, doctor: req.doctor });
};

module.exports = { login, register, getProfile };