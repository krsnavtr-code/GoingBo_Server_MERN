import User from '../models/user.model.js';
import Contact from '../models/contact.model.js';
import AppError from '../utils/appError.js';
import catchAsync from '../utils/catchAsync.js';

// Contact Form Submissions
export const getAllContacts = catchAsync(async (req, res, next) => {
  const { status } = req.query;
  const filter = {};
  
  if (status) {
    filter.status = status;
  }

  const contacts = await Contact.find(filter)
    .sort({ createdAt: -1 });

  res.status(200).json({
    status: 'success',
    results: contacts.length,
    data: {
      contacts
    }
  });
});

export const getContact = catchAsync(async (req, res, next) => {
  const contact = await Contact.findById(req.params.id);
  
  if (!contact) {
    return next(new AppError('No contact form submission found with that ID', 404));
  }
  
  res.status(200).json({
    status: 'success',
    data: {
      contact
    }
  });
});

export const updateContactStatus = catchAsync(async (req, res, next) => {
  const { status } = req.body;
  
  if (!['new', 'read', 'replied', 'archived'].includes(status)) {
    return next(new AppError('Invalid status value', 400));
  }
  
  const contact = await Contact.findByIdAndUpdate(
    req.params.id,
    { status },
    {
      new: true,
      runValidators: true
    }
  );

  if (!contact) {
    return next(new AppError('No contact form submission found with that ID', 404));
  }

  res.status(200).json({
    status: 'success',
    data: {
      contact
    }
  });
});

export const getContactStats = catchAsync(async (req, res, next) => {
  const stats = await Contact.aggregate([
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 }
      }
    },
    {
      $group: {
        _id: null,
        total: { $sum: '$count' },
        byStatus: {
          $push: {
            status: '$_id',
            count: '$count'
          }
        }
      }
    },
    {
      $project: {
        _id: 0,
        total: 1,
        byStatus: 1
      }
    }
  ]);

  res.status(200).json({
    status: 'success',
    data: {
      stats: stats[0] || { total: 0, byStatus: [] }
    }
  });
});

export const getDashboardStats = catchAsync(async (req, res, next) => {
  const stats = await User.aggregate([
    {
      $group: {
        _id: null,
        totalUsers: { $sum: 1 },
        activeUsers: {
          $sum: { $cond: [{ $eq: ['$active', true] }, 1, 0] }
        },
        admins: {
          $sum: { $cond: [{ $eq: ['$role', 'admin'] }, 1, 0] }
        }
      }
    }
  ]);

  res.status(200).json({
    status: 'success',
    data: {
      stats: stats[0] || { totalUsers: 0, activeUsers: 0, admins: 0 }
    }
  });
});

export const getAllUsers = catchAsync(async (req, res, next) => {
  const users = await User.find().select('-__v -passwordChangedAt');
  
  res.status(200).json({
    status: 'success',
    results: users.length,
    data: {
      users
    }
  });
});

export const getUser = catchAsync(async (req, res, next) => {
  const user = await User.findById(req.params.id).select('-__v -passwordChangedAt');
  
  if (!user) {
    return next(new AppError('No user found with that ID', 404));
  }
  
  res.status(200).json({
    status: 'success',
    data: {
      user
    }
  });
});

export const updateUser = catchAsync(async (req, res, next) => {
  // 1) Create error if user POSTs password data
  if (req.body.password || req.body.passwordConfirm) {
    return next(
      new AppError(
        'This route is not for password updates. Please use /updateMyPassword.',
        400
      )
    );
  }

  // 2) Filtered out unwanted fields names that are not allowed to be updated
  const filteredBody = {};
  const allowedFields = ['name', 'email', 'role', 'active', 'gender', 'phone', 'country'];
  
  Object.keys(req.body).forEach(el => {
    if (allowedFields.includes(el)) filteredBody[el] = req.body[el];
  });

  // 3) Update user document
  const updatedUser = await User.findByIdAndUpdate(
    req.params.id,
    filteredBody,
    {
      new: true,
      runValidators: true
    }
  );

  res.status(200).json({
    status: 'success',
    data: {
      user: updatedUser
    }
  });
});

export const deleteUser = catchAsync(async (req, res, next) => {
  const user = await User.findByIdAndDelete(req.params.id);

  if (!user) {
    return next(new AppError('No user found with that ID', 404));
  }

  res.status(204).json({
    status: 'success',
    data: null
  });
});
