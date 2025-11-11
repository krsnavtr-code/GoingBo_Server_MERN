import CabOwner from '../models/cabOwner.model.js';
import Cab from '../models/cab.model.js';
import AppError from '../utils/appError.js';
import catchAsync from '../utils/catchAsync.js';
import APIFeatures from '../utils/apiFeatures.js';

export const registerCabOwner = catchAsync(async (req, res, next) => {
  const {
    companyName,
    contactPerson,
    address,
    document,
    bankDetails,
    commissionRate = 15
  } = req.body;

  // Check if user is already registered as a cab owner
  const existingOwner = await CabOwner.findOne({ user: req.user.id });
  if (existingOwner) {
    return next(new AppError('You are already registered as a cab owner', 400));
  }

  // Create new cab owner
  const newOwner = await CabOwner.create({
    user: req.user.id,
    companyName,
    contactPerson,
    address,
    document,
    bankDetails,
    commissionRate
  });

  // Update user role to include 'cabOwner'
  req.user.roles.push('cabOwner');
  await req.user.save({ validateBeforeSave: false });

  res.status(201).json({
    status: 'success',
    data: {
      owner: newOwner
    }
  });
});

export const getOwnerProfile = catchAsync(async (req, res, next) => {
  const owner = await CabOwner.findOne({ user: req.user.id })
    .populate('cabs')
    .populate({
      path: 'bookings',
      options: { sort: { createdAt: -1 }, limit: 5 }
    });

  if (!owner) {
    return next(new AppError('No cab owner found with that ID', 404));
  }

  res.status(200).json({
    status: 'success',
    data: {
      owner
    }
  });
});

export const updateOwnerProfile = catchAsync(async (req, res, next) => {
  const { companyName, contactPerson, address, document, bankDetails, commissionRate } = req.body;
  
  const owner = await CabOwner.findOneAndUpdate(
    { user: req.user.id },
    {
      companyName,
      contactPerson,
      address,
      document,
      bankDetails,
      commissionRate
    },
    {
      new: true,
      runValidators: true
    }
  );

  if (!owner) {
    return next(new AppError('No cab owner found with that ID', 404));
  }

  res.status(200).json({
    status: 'success',
    data: {
      owner
    }
  });
});

export const getOwnerDashboard = catchAsync(async (req, res, next) => {
  const owner = await CabOwner.findOne({ user: req.user.id });
  
  if (!owner) {
    return next(new AppError('No cab owner found', 404));
  }

  // Get cab statistics
  const stats = await Cab.aggregate([
    { $match: { owner: owner._id } },
    {
      $group: {
        _id: '$type',
        count: { $sum: 1 },
        available: {
          $sum: { $cond: [{ $eq: ['$isAvailable', true] }, 1, 0] }
        },
        averageRating: { $avg: '$rating' }
      }
    }
  ]);

  // Get booking statistics
  const bookingStats = await Booking.aggregate([
    {
      $match: {
        'cab.owner': owner._id,
        status: { $in: ['completed', 'cancelled'] }
      }
    },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        totalAmount: { $sum: '$totalAmount' },
        commission: { $sum: '$commission' }
      }
    }
  ]);

  // Get recent bookings
  const recentBookings = await Booking.find({ 'cab.owner': owner._id })
    .sort({ createdAt: -1 })
    .limit(5)
    .populate('user', 'name email phone')
    .populate('cab', 'name type registrationNumber');

  res.status(200).json({
    status: 'success',
    data: {
      stats,
      bookingStats,
      recentBookings,
      totalEarnings: owner.totalEarnings,
      currentBalance: owner.currentBalance,
      totalPayouts: owner.totalPayouts
    }
  });
});

export const getOwnerCabs = catchAsync(async (req, res, next) => {
  const owner = await CabOwner.findOne({ user: req.user.id });
  
  if (!owner) {
    return next(new AppError('No cab owner found', 404));
  }

  const features = new APIFeatures(
    Cab.find({ owner: owner._id }),
    req.query
  )
    .filter()
    .sort()
    .limitFields()
    .paginate();

  const cabs = await features.query;

  res.status(200).json({
    status: 'success',
    results: cabs.length,
    data: {
      cabs
    }
  });
});

export const getOwnerBookings = catchAsync(async (req, res, next) => {
  const owner = await CabOwner.findOne({ user: req.user.id });
  
  if (!owner) {
    return next(new AppError('No cab owner found', 404));
  }

  const features = new APIFeatures(
    Booking.find({ 'cab.owner': owner._id }),
    req.query
  )
    .filter()
    .sort()
    .limitFields()
    .paginate();

  const bookings = await features.query
    .populate('user', 'name email phone')
    .populate('cab', 'name type registrationNumber');

  res.status(200).json({
    status: 'success',
    results: bookings.length,
    data: {
      bookings
    }
  });
});

export const requestPayout = catchAsync(async (req, res, next) => {
  const { amount } = req.body;
  const owner = await CabOwner.findOne({ user: req.user.id });
  
  if (!owner) {
    return next(new AppError('No cab owner found', 404));
  }

  if (amount > owner.currentBalance) {
    return next(new AppError('Insufficient balance for payout', 400));
  }

  // Create payout record (you'll need to implement this model)
  const payout = await Payout.create({
    owner: owner._id,
    amount,
    status: 'pending',
    paymentMethod: 'bank_transfer' // or other methods
  });

  // Update owner's balance
  owner.currentBalance -= amount;
  owner.totalPayouts += amount;
  await owner.save({ validateBeforeSave: false });

  // Here you would typically integrate with a payment gateway
  // to process the actual payout
  
  res.status(200).json({
    status: 'success',
    data: {
      payout,
      newBalance: owner.currentBalance
    }
  });
});

export const updateCabStatus = catchAsync(async (req, res, next) => {
  const { cabId } = req.params;
  const { isAvailable } = req.body;

  const owner = await CabOwner.findOne({ user: req.user.id });
  if (!owner) {
    return next(new AppError('No cab owner found', 404));
  }

  const cab = await Cab.findOneAndUpdate(
    { _id: cabId, owner: owner._id },
    { isAvailable },
    { new: true, runValidators: true }
  );

  if (!cab) {
    return next(new AppError('No cab found with that ID', 404));
  }

  res.status(200).json({
    status: 'success',
    data: {
      cab
    }
  });
});
