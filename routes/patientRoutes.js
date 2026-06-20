 const express = require('express');
const router = express.Router();
const {
  getPatients,
  addPatient,
  updatePatient,
  updatePatientStatus,
  deletePatient
} = require('../controllers/patientController');

// 🔓 مؤقتاً من غير توثيق (للتجربة)
// const auth = require('../middleware/auth');
// router.use(auth);

router.get('/', getPatients);
router.post('/', addPatient);
router.put('/:id', updatePatient);
router.patch('/:id/status', updatePatientStatus);
router.delete('/:id', deletePatient);

// ============== Visits Routes ==============
const {
  getVisits,
  updateVisitStatus,
  deleteVisit
} = require('../controllers/visitController');

router.get('/visits', getVisits);
router.put('/visits/:id/status', updateVisitStatus);
router.delete('/visits/:id', deleteVisit);

module.exports = router;