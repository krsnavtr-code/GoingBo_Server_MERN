import Contact from '../models/contact.model.js';
import { validationResult } from 'express-validator';

export const submitContactForm = async (req, res) => {
  try {
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false, 
        errors: errors.array() 
      });
    }

    const { name, email, subject, message } = req.body;

    // Create new contact
    const newContact = new Contact({
      name,
      email,
      subject,
      message,
    });

    // Save to database
    await newContact.save();

    // Send success response
    res.status(201).json({
      success: true,
      message: 'Your message has been sent successfully!',
      data: {
        id: newContact._id,
        name: newContact.name,
        email: newContact.email,
      },
    });
  } catch (error) {
    console.error('Error submitting contact form:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred while processing your request',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

export const getContactSubmissions = async (req, res) => {
  try {
    // Only allow admins to view all submissions
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized access',
      });
    }

    const { status, page = 1, limit = 10 } = req.query;
    const query = {};
    
    if (status) {
      query.status = status;
    }

    const submissions = await Contact.find(query)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .exec();

    const count = await Contact.countDocuments(query);

    res.status(200).json({
      success: true,
      data: submissions,
      totalPages: Math.ceil(count / limit),
      currentPage: page,
    });
  } catch (error) {
    console.error('Error fetching contact submissions:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching contact submissions',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};
