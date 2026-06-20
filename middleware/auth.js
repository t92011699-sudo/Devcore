 const jwt = require('jsonwebtoken');
const supabase = require('../config/supabase');

const auth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ 
        success: false, 
        error: 'Please authenticate - No token provided' 
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    const { data: doctor, error } = await supabase
      .from('doctors')
      .select('id, name, email, specialty, phone, clinic_address')
      .eq('id', decoded.id)
      .single();

    if (error || !doctor) {
      return res.status(401).json({ 
        success: false, 
        error: 'Please authenticate - Invalid token' 
      });
    }

    req.doctor = doctor;
    next();
  } catch (error) {
    console.error('Auth error:', error);
    res.status(401).json({ 
      success: false, 
      error: 'Please authenticate' 
    });
  }
};

module.exports = auth;