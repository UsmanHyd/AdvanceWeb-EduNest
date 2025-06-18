const express = require('express');
const router = express.Router();
const User = require('../models/User');
const auth = require('../middleware/auth');

module.exports = router; 