import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
dotenv.config();

// Create a reusable transporter object using the default SMTP transport
const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com', // Hardcoded to ensure it's not using localhost
    port: 587,
    secure: false,
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD,
    },
    tls: {
        rejectUnauthorized: false
    }
});

// Test the connection
transporter.verify((error, success) => {
    if (error) {
        console.error('SMTP Connection Error:', {
            error: error.message,
            code: error.code,
            host: 'smtp.gmail.com',
            port: 587,
            user: process.env.EMAIL_USER ? 'Set' : 'Not Set'
        });
    } else {
        console.log('Server is ready to take our messages');
    }
});

// Email templates
const templates = {
    
    contactUser: (data) => `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
      <h2 style="color: #4a5568;">Thank You for Contacting Us</h2>
      <p>Dear ${data.name || 'Valued Customer'},</p>
      <p>Thank you for reaching out to us. We have received your message and will get back to you as soon as possible.</p>
      <p>Here's a summary of your submission:</p>
      <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 15px 0;">
        <p><strong>Name:</strong> ${data.name || 'Not provided'}</p>
        <p><strong>Email:</strong> ${data.email || 'Not provided'}</p>
        <p><strong>Subject:</strong> ${data.subject || 'No Subject'}</p>
        <p><strong>Message:</strong><br>${data.message || 'No message provided'}</p>
      </div>
      <p>We appreciate your interest and will respond within 24-48 hours.</p>
      <p>Best regards,<br>${process.env.EMAIL_FROM_NAME || 'Your Portfolio Team'}</p>
    </div>
  `,
    contactAdmin: (data) => `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
      <h2 style="color: #4a5568;">New Contact Form Submission</h2>
      <p>You have received a new contact form submission with the following details:</p>
      <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 15px 0;">
        <p><strong>Name:</strong> ${data.name}</p>
        <p><strong>Email:</strong> ${data.email}</p>
        <p><strong>Subject:</strong> ${data.subject}</p>
        <p><strong>Message:</strong><br>${data.message}</p>
        <p><strong>Submitted on:</strong> ${new Date().toLocaleString()}</p>
      </div>
      <p>Please respond to this inquiry at your earliest convenience.</p>
    </div>
  `,
};

/**
 * Send an email
 * @param {Object} options - Email options
 * @param {string} options.to - Recipient email address
 * @param {string} options.subject - Email subject
 * @param {string} options.template - Template name
 * @param {Object} options.data - Data to be used in the template
 * @returns {Promise}
 */
const sendEmail = async ({ to, subject, template, data = {} }) => {
    try {
        // Validate recipient email
        if (!to) {
            throw new Error('No recipient email address provided');
        }

        // Get the template and replace placeholders
        let html = templates[template];
        if (!html) {
            throw new Error(`Template '${template}' not found`);
        }
        
        if (typeof html === 'function') {
            html = html(data);
        }

        // Replace any remaining placeholders in the template
        Object.entries(data).forEach(([key, value]) => {
            const regex = new RegExp(`{{${key}}}`, 'g');
            html = html.replace(regex, value || '');
        });

        // Ensure from email is set
        const fromEmail = process.env.EMAIL_FROM;
        if (!fromEmail) {
            throw new Error('EMAIL_FROM environment variable is not set');
        }

        // Define email options
        const mailOptions = {
            from: `"${process.env.EMAIL_FROM_NAME || 'Portfolio'}" <${fromEmail}>`,
            to: to,
            subject: subject || 'No Subject',
            html,
            text: html.replace(/<[^>]*>/g, ''), // Fallback text version
        };

        console.log('Sending email:', {
            to: mailOptions.to,
            subject: mailOptions.subject,
            from: mailOptions.from
        });

        // Send email
        const info = await transporter.sendMail(mailOptions);
        console.log('Email sent:', info.messageId);
        return { success: true, messageId: info.messageId };
    } catch (error) {
        console.error('Error sending email:', {
            error: error.message,
            to,
            subject,
            template
        });
        throw new Error(`Failed to send email: ${error.message}`);
    }
};

export { sendEmail };