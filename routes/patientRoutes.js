 const express = require('express');
const router = express.Router();
const {
  getPatients,
  addPatient,
  updatePatient,
  updatePatientStatus, // ← جديد
  deletePatient
} = require('../controllers/patientController');

router.get('/', getPatients);
router.post('/', addPatient);
router.put('/:id', updatePatient);
router.patch('/:id/status', updatePatientStatus); // ← جديد (تحديث الحالة فقط)
router.delete('/:id', deletePatient);

module.exports = router;