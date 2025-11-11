import Cab from '../models/cab.model.js';
import CabBooking from '../models/cabBooking.model.js';
import AppError from '../utils/appError.js';
import catchAsync from '../utils/catchAsync.js';
import APIFeatures from '../utils/apiFeatures.js';
import CabSettings from '../models/cabSettings.model.js';
import User from '../models/user.model.js';

// Helper function to calculate distance between two points (Haversine formula)
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c; // Distance in km
};

// Admin: Get cab settings
export const getCabSettings = catchAsync(async (req, res, next) => {
  const settings = await CabSettings.findOne();
  
  if (!settings) {
    // Create default settings if none exist
    const defaultSettings = await CabSettings.create({
      minBookingNotice: 60, // 1 hour in minutes
      maxBookingDaysInAdvance: 30, // 30 days
      cancellationPolicy: 'Free cancellation up to 1 hour before pickup',
      baseFare: 50,
      perKmRate: 10,
      perMinuteRate: 1,
      nightSurcharge: 1.2, // 20% surcharge
      peakHourSurcharge: 1.1, // 10% surcharge
      taxRate: 0.18, // 18% tax
    });
    
    return res.status(200).json({
      status: 'success',
      data: {
        settings: defaultSettings,
      },
    });
  }
  
  res.status(200).json({
    status: 'success',
    data: {
      settings,
    },
  });
});

// Admin: Update cab settings
export const updateCabSettings = catchAsync(async (req, res, next) => {
  const settings = await CabSettings.findOneAndUpdate({}, req.body, {
    new: true,
    runValidators: true,
    upsert: true,
  });
  
  res.status(200).json({
    status: 'success',
    data: {
      settings,
    },
  });
});

// Admin: Get all cabs with filtering, sorting, and pagination
// Admin: Get all drivers with their cab assignments
export const getAllDrivers = catchAsync(async (req, res, next) => {
  // Find all cabs that have a driver assigned
  const cabsWithDrivers = await Cab.find({ 'driver.name': { $exists: true, $ne: '' } })
    .select('driver name registrationNumber isAvailable');

  // Extract unique drivers from cabs
  const drivers = [];
  const driverMap = new Map();

  cabsWithDrivers.forEach(cab => {
    if (cab.driver && !driverMap.has(cab.driver.phone)) {
      driverMap.set(cab.driver.phone, true);
      drivers.push({
        name: cab.driver.name,
        phone: cab.driver.phone,
        licenseNumber: cab.driver.licenseNumber,
        cabName: cab.name,
        cabRegistration: cab.registrationNumber,
        isCabAvailable: cab.isAvailable
      });
    }
  });

  res.status(200).json({
    status: 'success',
    results: drivers.length,
    data: {
      drivers
    }
  });
});

export const getAllCabs = catchAsync(async (req, res, next) => {
  const features = new APIFeatures(Cab.find(), req.query)
    .filter()
    .sort()
    .limitFields()
    .paginate();

  const cabs = await features.query;

  res.status(200).json({
    status: 'success',
    results: cabs.length,
    data: {
      cabs,
    },
  });
});

// Admin: Create a new cab
export const createCab = catchAsync(async (req, res, next) => {
  // Ensure routes array is present and not empty
  if (!req.body.routes || !Array.isArray(req.body.routes) || req.body.routes.length === 0) {
    return next(new AppError('At least one route (from and to) is required', 400));
  }

  // Validate each route
  for (const route of req.body.routes) {
    if (!route.from || !route.to) {
      return next(new AppError('Both "from" and "to" cities are required for each route', 400));
    }
  }

  const newCab = await Cab.create(req.body);

  res.status(201).json({
    status: 'success',
    data: {
      cab: newCab,
    },
  });
});

// Admin: Get a single cab
export const getCab = catchAsync(async (req, res, next) => {
  const cab = await Cab.findById(req.params.id);

  if (!cab) {
    return next(new AppError('No cab found with that ID', 404));
  }

  res.status(200).json({
    status: 'success',
    data: {
      cab,
    },
  });
});

// Admin: Update a cab
export const updateCab = catchAsync(async (req, res, next) => {
  const cab = await Cab.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });

  if (!cab) {
    return next(new AppError('No cab found with that ID', 404));
  }

  res.status(200).json({
    status: 'success',
    data: {
      cab,
    },
  });
});

// Admin: Delete a cab
export const deleteCab = catchAsync(async (req, res, next) => {
  const cab = await Cab.findByIdAndDelete(req.params.id);

  if (!cab) {
    return next(new AppError('No cab found with that ID', 404));
  }

  res.status(204).json({
    status: 'success',
    data: null,
  });
});

// Admin: Get all cab bookings with filtering
// Create a new cab booking
export const createCabBooking = catchAsync(async (req, res, next) => {
  const {
    cab,
    pickupLocation,
    dropoffLocation,
    pickupTime,
    distance = 10, // Default distance if not provided
    passengerName,
    passengerEmail,
    passengerPhone,
    specialRequests = '',
    paymentMethod = 'cash',
    totalAmount
  } = req.body;

  // Validate required fields
  if (!cab || !pickupLocation || !dropoffLocation || !pickupTime || 
      !passengerName || !passengerEmail || !passengerPhone) {
    return next(new AppError('Please provide all required booking details', 400));
  }

  // Generate a booking reference (e.g., 'GB' + timestamp + random string)
  const generateBookingReference = () => {
    const timestamp = Date.now().toString(36).toUpperCase();
    const randomStr = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `GB-${timestamp}-${randomStr}`;
  };

  // Create the booking
  const booking = await CabBooking.create({
    user: req.user.id,
    cab,
    bookingReference: generateBookingReference(),
    pickupLocation: {
      type: 'Point',
      coordinates: pickupLocation.coordinates || [0, 0],
      address: pickupLocation.address || '',
      name: pickupLocation.name || 'Pickup Location',
      contactNumber: pickupLocation.contactNumber || passengerPhone
    },
    dropoffLocation: {
      type: 'Point',
      coordinates: dropoffLocation.coordinates || [0, 0],
      address: dropoffLocation.address || '',
      name: dropoffLocation.name || 'Drop-off Location'
    },
    pickupTime: new Date(pickupTime),
    distance,
    fare: totalAmount,
    passengerName,
    passengerEmail,
    passengerPhone,
    specialRequests,
    paymentMethod,
    totalAmount,
    status: 'pending',
    paymentStatus: paymentMethod === 'cash' ? 'pending' : 'paid'
  });

  // Update cab availability
  await Cab.findByIdAndUpdate(cab, { isAvailable: false });

  // Populate the booking with cab and user details
  const populatedBooking = await CabBooking.findById(booking._id)
    .populate('user', 'name email phone')
    .populate('cab', 'name type registrationNumber');

  res.status(201).json({
    status: 'success',
    data: {
      booking: populatedBooking
    }
  });
});

export const getAllCabBookings = catchAsync(async (req, res, next) => {
  const features = new APIFeatures(CabBooking.find()
    .populate('user', 'name email phone')
    .populate('cab', 'name type registrationNumber'), req.query)
    .filter()
    .sort()
    .limitFields()
    .paginate();

  const bookings = await features.query;

  res.status(200).json({
    status: 'success',
    results: bookings.length,
    data: {
      bookings,
    },
  });
});

// Admin: Get a single booking
export const getBooking = catchAsync(async (req, res, next) => {
  const booking = await CabBooking.findById(req.params.id)
    .populate('user', 'name email phone')
    .populate('cab', 'name type registrationNumber driver');

  if (!booking) {
    return next(new AppError('No booking found with that ID', 404));
  }

  res.status(200).json({
    status: 'success',
    data: {
      booking,
    },
  });
});

// Admin: Update booking status
export const updateBookingStatus = catchAsync(async (req, res, next) => {
  const { status, cancellationReason } = req.body;
  
  const booking = await CabBooking.findById(req.params.id);
  
  if (!booking) {
    return next(new AppError('No booking found with that ID', 404));
  }

  // Update cab availability if booking is completed or cancelled
  if (['completed', 'cancelled', 'rejected'].includes(status)) {
    await Cab.findByIdAndUpdate(booking.cab, { isAvailable: true });
  } else if (status === 'confirmed') {
    await Cab.findByIdAndUpdate(booking.cab, { isAvailable: false });
  }

  // Update booking status
  booking.status = status;
  if (cancellationReason) {
    booking.cancellationReason = cancellationReason;
  }
  
  await booking.save({ validateBeforeSave: false });

  // Populate the updated booking
  const updatedBooking = await CabBooking.findById(booking._id)
    .populate('user', 'name email phone')
    .populate('cab', 'name type registrationNumber driver');

  res.status(200).json({
    status: 'success',
    data: {
      booking: updatedBooking,
    },
  });
});

// Admin: Get cab statistics
// Get current user's bookings
export const getMyBookings = catchAsync(async (req, res, next) => {
  const bookings = await CabBooking.find({ user: req.user.id })
    .sort('-createdAt')
    .populate('cab', 'name type registrationNumber');

  res.status(200).json({
    status: 'success',
    results: bookings.length,
    data: {
      bookings
    }
  });
});

export const getCabStats = catchAsync(async (req, res, next) => {
  const stats = await Cab.aggregate([
    {
      $group: {
        _id: '$type',
        count: { $sum: 1 },
        available: {
          $sum: { $cond: [{ $eq: ['$isAvailable', true] }, 1, 0] }
        },
        averagePrice: { $avg: '$pricePerKm' },
      },
    },
    {
      $addFields: {
        type: '$_id',
      },
    },
    {
      $project: {
        _id: 0,
      },
    },
    {
      $sort: { type: 1 },
    },
  ]);

  // Get booking statistics
  const bookingStats = await CabBooking.aggregate([
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        totalRevenue: { $sum: '$totalAmount' },
      },
    },
    {
      $addFields: {
        status: '$_id',
      },
    },
    {
      $project: {
        _id: 0,
      },
    },
  ]);

  // Get recent bookings
  const recentBookings = await CabBooking.find()
    .sort({ createdAt: -1 })
    .limit(5)
    .populate('user', 'name email')
    .populate('cab', 'name type');

  res.status(200).json({
    status: 'success',
    data: {
      stats,
      bookingStats,
      recentBookings,
    },
  });
});

// Find available cabs by route
export const findAvailableCabs = catchAsync(async (req, res, next) => {
  try {
    const { from, to, cabType, capacity } = req.query;
    
    // Input validation
    if (!from || !to) {
      return next(new AppError('Both "from" and "to" parameters are required', 400));
    }
    
    // Basic query for available cabs
    let query = { isAvailable: true };
    
    // Add optional filters
    if (cabType) {
      query.type = { $regex: new RegExp(`^${cabType}$`, 'i') };
    }
    
    if (capacity && !isNaN(capacity)) {
      query.capacity = { $gte: parseInt(capacity, 10) };
    }
    
    // Find cabs with matching routes (case-insensitive partial match)
    const cabs = await Cab.find({
      ...query,
      'routes': {
        $elemMatch: {
          from: { $regex: new RegExp(from, 'i') },
          to: { $regex: new RegExp(to, 'i') },
          isActive: true
        }
      }
    }).select('-__v -createdAt -updatedAt');
    
    // Format response to match frontend expectations
    res.status(200).json({
      status: 'success',
      data: {
        cabs: cabs.map(cab => ({
          ...cab.toObject(),
          id: cab._id,
          image: cab.images?.[0] || '/images/cabs/default.png',
          rating: cab.rating || 4.5, // Default rating if not set
          baseFare: cab.baseFare || 100 // Default base fare if not set
        }))
      }
    });
    
  } catch (error) {
    console.error('Error finding available cabs:', error);
    next(new AppError('Error searching for cabs. Please try again later.', 500));
  }
});

// Admin: Add a new route to a cab
export const addCabRoute = catchAsync(async (req, res, next) => {
  const { from, to, isActive = true } = req.body;
  
  if (!from || !to) {
    return next(new AppError('Both "from" and "to" cities are required', 400));
  }
  
  // Check if the route already exists
  const existingRoute = await Cab.findOne({
    _id: req.params.id,
    'routes': {
      $elemMatch: {
        from: { $regex: new RegExp(`^${from}$`, 'i') },
        to: { $regex: new RegExp(`^${to}$`, 'i') }
      }
    }
  });
  
  if (existingRoute) {
    return next(new AppError('This route already exists for the cab', 400));
  }
  
  const cab = await Cab.findByIdAndUpdate(
    req.params.id,
    {
      $push: {
        routes: { from, to, isActive }
      }
    },
    { new: true, runValidators: true }
  );
  
  if (!cab) {
    return next(new AppError('No cab found with that ID', 404));
  }
  
  res.status(200).json({
    status: 'success',
    data: {
      cab,
    },
  });
});

// Admin: Update a cab route
export const updateCabRoute = catchAsync(async (req, res, next) => {
  const { routeId } = req.params;
  const { from, to, isActive } = req.body;
  
  const updateData = {};
  if (from) updateData['routes.$.from'] = from;
  if (to) updateData['routes.$.to'] = to;
  if (isActive !== undefined) updateData['routes.$.isActive'] = isActive;
  
  const cab = await Cab.findOneAndUpdate(
    { _id: req.params.id, 'routes._id': routeId },
    { $set: updateData },
    { new: true, runValidators: true }
  );
  
  if (!cab) {
    return next(new AppError('No cab or route found with the given IDs', 404));
  }
  
  res.status(200).json({
    status: 'success',
    data: {
      cab,
    },
  });
});

// Admin: Remove a route from a cab
// @desc    Register a new cab (public)
// @route   POST /api/v1/cabs/register
// @access  Public
export const registerCab = catchAsync(async (req, res, next) => {
  const {
    name,
    email,
    phone,
    cabType = 'economy', // Default to economy if not provided
    cabNumber,
    city,
    availability = true
  } = req.body;
  
  // Validate required fields
  if (!name || !phone || !cabNumber) {
    return next(new AppError('Please provide name, phone, and cab number', 400));
  }

  // Create a new cab document
  const newCab = await Cab.create({
    name: `Cab ${cabNumber}`, // You might want to customize this
    type: cabType.toLowerCase(),
    capacity: getDefaultCapacity(cabType),
    registrationNumber: cabNumber,
    driver: {
      name,
      phone,
      licenseNumber: 'PENDING' // Will be updated after verification
    },
    isAvailable: availability,
    routes: [{
      from: city,
      to: city,
      isActive: true
    }],
    pricePerKm: getDefaultPricePerKm(cabType),
    isActive: false // Set to false until verified by admin
  });

  // TODO: Send email notification to admin about new cab registration
  // TODO: Send confirmation email to cab owner

  res.status(201).json({
    status: 'success',
    message: 'Cab registration submitted successfully. Our team will contact you shortly for verification.',
    data: {
      cab: newCab
    }
  });
});

// Helper function to get default capacity based on cab type
const getDefaultCapacity = (cabType) => {
  const capacities = {
    'sedan': 4,
    'suv': 6,
    'luxury': 4,
    'muv': 8,
    'tempo traveler': 12
  };
  return capacities[cabType.toLowerCase()] || 4;
};

// Helper function to get default price per km based on cab type
const getDefaultPricePerKm = (cabType) => {
  const prices = {
    'sedan': 12,
    'suv': 15,
    'luxury': 25,
    'muv': 18,
    'tempo traveler': 20
  };
  return prices[cabType.toLowerCase()] || 15;
};

export const removeCabRoute = catchAsync(async (req, res, next) => {
  const { routeId } = req.params;
  
  const cab = await Cab.findByIdAndUpdate(
    req.params.id,
    {
      $pull: {
        routes: { _id: routeId }
      }
    },
    { new: true }
  );
  
  if (!cab) {
    return next(new AppError('No cab found with that ID', 404));
  }
  
  res.status(200).json({
    status: 'success',
    data: {
      cab,
    },
  });
});

// Admin: Assign driver to a booking
export const assignDriverToBooking = catchAsync(async (req, res, next) => {
  const { cabId } = req.body;
  
  const booking = await CabBooking.findById(req.params.id);
  if (!booking) {
    return next(new AppError('No booking found with that ID', 404));
  }
  
  const cab = await Cab.findById(cabId);
  if (!cab) {
    return next(new AppError('No cab found with that ID', 404));
  }
  
  // Update cab's availability
  cab.isAvailable = false;
  await cab.save();
  
  // Update booking with cab and driver info
  booking.cab = cab._id;
  booking.status = 'driver_assigned';
  await booking.save();
  
  const updatedBooking = await CabBooking.findById(booking._id)
    .populate('user', 'name email phone')
    .populate('cab', 'name type registrationNumber driver');
  
  res.status(200).json({
    status: 'success',
    data: {
      booking: updatedBooking,
    },
  });
});
