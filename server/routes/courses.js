const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const Course = require('../models/Course');
const Task = require('../models/Task');
const auth = require('../middleware/auth');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, '..', 'uploads');
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});

const fileFilter = (req, file, cb) => {
  // Accept all file types for now
  cb(null, true);
};

const upload = multer({ 
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
});

// Get all courses
router.get('/', async (req, res) => {
  try {
    const courses = await Course.find()
      .populate('instructor', 'name email')
      .populate('students', 'name email')
      .populate('tasks');
    res.json(courses);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Get single course
router.get('/:id', async (req, res) => {
  try {
    const course = await Course.findById(req.params.id)
      .populate('instructor', 'name email')
      .populate('students', 'name email')
      .populate('tasks');
    
    if (!course) {
      return res.status(404).json({ message: 'Course not found' });
    }
    
    res.json(course);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Create course (instructor only)
router.post('/', auth, async (req, res) => {
  try {
    if (req.user.role !== 'instructor') {
      return res.status(403).json({ message: 'Only instructors can create courses' });
    }

    const { title, description, category } = req.body;
    
    const course = new Course({
      title,
      description,
      category,
      instructor: req.user.userId
    });

    await course.save();
    res.status(201).json(course);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Enroll in course
router.post('/:id/enroll', auth, async (req, res) => {
  try {
    const course = await Course.findById(req.params.id);
    
    if (!course) {
      return res.status(404).json({ message: 'Course not found' });
    }

    // Check if already enrolled
    if (course.students.includes(req.user.userId)) {
      return res.status(400).json({ message: 'Already enrolled in this course' });
    }

    course.students.push(req.user.userId);
    await course.save();

    res.json({ message: 'Successfully enrolled in course' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Update course (instructor only)
router.put('/:id', auth, async (req, res) => {
  try {
    const course = await Course.findById(req.params.id);
    
    if (!course) {
      return res.status(404).json({ message: 'Course not found' });
    }

    if (course.instructor.toString() !== req.user.userId) {
      return res.status(403).json({ message: 'Not authorized to update this course' });
    }

    const { title, description } = req.body;
    
    course.title = title || course.title;
    course.description = description || course.description;

    await course.save();
    res.json(course);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Add task to course (instructor only)
router.post('/:id/tasks', auth, upload.single('file'), async (req, res) => {
  try {
    console.log('Received task creation request:', {
      courseId: req.params.id,
      body: req.body,
      file: req.file
    });

    const course = await Course.findById(req.params.id);
    
    if (!course) {
      console.log('Course not found:', req.params.id);
      return res.status(404).json({ message: 'Course not found' });
    }

    if (course.instructor.toString() !== req.user.userId) {
      console.log('Unauthorized access attempt:', {
        courseInstructor: course.instructor,
        requestingUser: req.user.userId
      });
      return res.status(403).json({ message: 'Not authorized to add tasks to this course' });
    }

    const { title, description, dueDate } = req.body;
    
    console.log('Creating new task with data:', {
      title,
      description,
      dueDate,
      courseId: course._id,
      instructorId: req.user.userId,
      file: req.file
    });

    const task = new Task({
      title,
      description,
      dueDate,
      course: course._id,
      instructor: req.user.userId,
      file: req.file ? {
        filename: req.file.filename,
        originalname: req.file.originalname,
        path: req.file.path,
        mimetype: req.file.mimetype
      } : null
    });

    await task.save();
    console.log('Task saved successfully:', task);
    
    // Add task to course's tasks array
    course.tasks = course.tasks || [];
    course.tasks.push(task._id);
    await course.save();
    console.log('Course updated with new task');

    res.status(201).json(task);
  } catch (error) {
    console.error('Error adding task:', error);
    res.status(500).json({ message: 'Server error: ' + error.message });
  }
});

module.exports = router; 