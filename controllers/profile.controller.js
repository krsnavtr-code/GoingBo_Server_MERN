import Profile from '../models/profile.model.js';
import AppError from '../utils/appError.js';
import catchAsync from '../utils/catchAsync.js';

export const getProfile = catchAsync(async (req, res, next) => {
  // Initialize profile if it doesn't exist
  await Profile.initializeProfile();
  
  const profile = await Profile.findOne();
  
  res.status(200).json({
    success: true,
    data: profile
  });
});

export const getPublicProfile = catchAsync(async (req, res, next) => {
  // Initialize profile if it doesn't exist
  await Profile.initializeProfile();
  
  const profile = await Profile.findOne().select('-__v -createdAt -updatedAt');
  
  if (!profile) {
    return next(new AppError('No profile found', 404));
  }

  res.status(200).json(profile);
});

export const updateProfile = catchAsync(async (req, res, next) => {
  const updates = {
    image: req.body.image,
    role: req.body.role,
    name: req.body.name,
    description: req.body.description,
    sortDescription: req.body.sortDescription,
    experience: parseFloat(req.body.experience) || 0,
    projects: parseInt(req.body.projects) || 0,
    cvPdf: req.body.cvPdf
  };

  // Check if profile exists
  let profile = await Profile.findOne();
  
  if (!profile) {
    // Create a new profile if it doesn't exist
    profile = await Profile.create(updates);
  } else {
    // Update existing profile
    profile = await Profile.findOneAndUpdate(
      {},
      { $set: updates },
      { new: true, runValidators: true }
    );
  }

  res.status(200).json({
    success: true,
    data: profile
  });
});
