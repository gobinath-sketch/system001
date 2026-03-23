const express = require('express');
const router = express.Router();
const { recommendCourses, getAllCourses } = require('../controllers/courseController');

router.get('/recommend', recommendCourses);
router.get('/', getAllCourses);

module.exports = router;
