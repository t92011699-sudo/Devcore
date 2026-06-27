 const express = require('express');
const router = express.Router();
const {
  getPatients,
  addPatient,
  updatePatient,
  updatePatientStatus,
  deletePatient
} = require('../controllers/patientController');

// 🔓 بدون توثيق

router.get('/', getPatients);
router.post('/', addPatient);
router.put('/:id', updatePatient);
router.patch('/:id/status', updatePatientStatus);
router.delete('/:id', deletePatient);

module.exports = router;