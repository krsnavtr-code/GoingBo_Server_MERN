import Contact from '../models/contact.model.js';
import { validationResult } from 'express-validator';
import { sendEmail } from '../utils/email.js';


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

    // Save to database
    const newContact = new Contact({
      name,
      email,
      subject,
      message,
    });

    await newContact.save();

    try {
      // Validate required environment variables
      if (!process.env.ADMIN_EMAIL) {
        console.error('ADMIN_EMAIL environment variable is not set');
      }

      // Send confirmation email to user
      if (email) {
        try {
          await sendEmail({
            to: email,
            subject: `Thank you for contacting us, ${name}!`,
            template: 'contactUser',
            data: { name, email, subject, message }
          });
          console.log(`Confirmation email sent to: ${email}`);
        } catch (userEmailError) {
          console.error('Error sending confirmation email to user:', userEmailError);
          // Continue with the request even if user email fails
        }
      } else {
        console.warn('No user email provided, skipping confirmation email');
      }

      // Send notification to admin
      if (process.env.ADMIN_EMAIL) {
        try {
          await sendEmail({
            to: process.env.ADMIN_EMAIL,
            subject: `New Contact Form Submission: ${subject || 'No Subject'}`,
            template: 'contactAdmin',
            data: { name, email, subject, message }
          });
          console.log(`Notification email sent to admin: ${process.env.ADMIN_EMAIL}`);
        } catch (adminEmailError) {
          console.error('Error sending notification email to admin:', adminEmailError);
          // Continue with the request even if admin email fails
        }
      } else {
        console.warn('ADMIN_EMAIL not set, skipping admin notification');
      }
    } catch (error) {
      console.error('Unexpected error in email sending process:', error);
      // Don't fail the request if email sending fails
    }

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
