const express = require('express');
const router = express.Router();
const Task = require('../models/Task');
const Course = require('../models/Course');
const auth = require('../middleware/auth');

// Get all tasks for a course
router.get('/course/:courseId', auth, async (req, res) => {
  try {
    const tasks = await Task.find({ course: req.params.courseId })
      .populate('course', 'title')
      .populate('submissions.student', 'name email');
    res.json(tasks);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Create task (instructor only)
router.post('/', auth, async (req, res) => {
  try {
    if (req.user.role !== 'instructor') {
      return res.status(403).json({ message: 'Only instructors can create tasks' });
    }

    const { title, description, dueDate, courseId } = req.body;

    // Verify course exists and user is instructor
    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({ message: 'Course not found' });
    }

    if (course.instructor.toString() !== req.user.userId) {
      return res.status(403).json({ message: 'Not authorized to create tasks for this course' });
    }

    const task = new Task({
      title,
      description,
      dueDate,
      course: courseId
    });

    await task.save();
    res.status(201).json(task);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Submit task
router.post('/:id/submit', auth, async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    // Check if student is enrolled in the course
    const course = await Course.findById(task.course);
    if (!course.students.includes(req.user.userId)) {
      return res.status(403).json({ message: 'Not enrolled in this course' });
    }

    // Check if already submitted
    const existingSubmission = task.submissions.find(
      sub => sub.student.toString() === req.user.userId
    );

    if (existingSubmission) {
      return res.status(400).json({ message: 'Already submitted this task' });
    }

    const { content } = req.body;
    task.submissions.push({
      student: req.user.userId,
      content,
      submittedAt: Date.now()
    });

    await task.save();
    res.json({ message: 'Task submitted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Update task (instructor only)
router.put('/:id', auth, async (req, res) => {
  try {
    if (req.user.role !== 'instructor') {
      return res.status(403).json({ message: 'Only instructors can update tasks' });
    }

    const task = await Task.findById(req.params.id);
    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    // Verify instructor owns the course
    const course = await Course.findById(task.course);
    if (course.instructor.toString() !== req.user.userId) {
      return res.status(403).json({ message: 'Not authorized to update this task' });
    }

    const { title, description, dueDate } = req.body;
    task.title = title || task.title;
    task.description = description || task.description;
    task.dueDate = dueDate || task.dueDate;

    await task.save();
    res.json(task);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router; 