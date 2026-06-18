const jwt = require('jsonwebtoken');
const supabase = require('../config/supabase');

const auth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'Please authenticate' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const { data: doctor, error } = await supabase
      .from('doctors')
      .select('id, name, email')
      .eq('id', decoded.id)
      .single();

    if (error || !doctor) {
      return res.status(401).json({ error: 'Please authenticate' });
    }

    req.doctor = doctor;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Please authenticate' });
  }
};

module.exports = auth;