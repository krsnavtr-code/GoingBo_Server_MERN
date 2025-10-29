import Joi from 'joi';
import ApiError from '../utils/ApiError.js';
import Project from '../models/package.model.js';

// Validation schema for project creation and update
export const validateProjectInput = (data, isUpdate = false) => {
  const baseSchema = {
    // Main image and image gallery
    mainImage: Joi.string().allow(''),
    imageGallery: Joi.array().items(Joi.string()).default([]),
    title: Joi.string()
      .min(5)
      .max(100)
      .required()
      .messages({
        'string.empty': 'Project title is required',
        'string.min': 'Project title must be at least 5 characters long',
        'string.max': 'Project title cannot be longer than 100 characters',
        'any.required': 'Project title is required'
      }),
    description: Joi.string()
      .required()
      .messages({
        'string.empty': 'Project description is required',
        'any.required': 'Project description is required'
      }),
    shortDescription: Joi.string()
      .max(250)
      .allow('')
      .messages({
        'string.max': 'Short description cannot be longer than 250 characters'
      }),
    status: Joi.string()
      .valid('planning', 'in_progress', 'completed', 'on_hold')
      .default('planning'),
    priority: Joi.number()
      .integer()
      .min(0)
      .max(10)
      .default(0),
    startDate: Joi.date()
      .allow(null)
      .messages({
        'date.base': 'Start date must be a valid date'
      }),
    endDate: Joi.date()
      .min(Joi.ref('startDate'))
      .allow(null)
      .messages({
        'date.base': 'End date must be a valid date',
        'date.min': 'End date must be after start date'
      }),
    tags: Joi.array()
      .items(Joi.string())
      .default([]),
    isPublished: Joi.boolean()
      .default(false),
    slug: Joi.string()
      .allow(''),
    order: Joi.number()
      .integer()
      .default(0),
    
    itcategories: Joi.array()
      .items(Joi.string().pattern(/^[0-9a-fA-F]{24}$/))
      .min(1)
      .required()
      .messages({
        'array.base': 'Categories must be an array',
        'array.min': 'At least one category is required',
        'string.pattern.base': 'Invalid category ID format',
        'any.required': 'At least one category is required'
      }),

    // Travel Package Fields
    packageType: Joi.string()
      .valid('project', 'travel')
      .default('project'),
    destination: Joi.string().allow(''),
    duration: Joi.number().min(0).default(0),
    durationDay: Joi.number().min(0).default(0),
    price: Joi.number().min(0).default(0),
    discount: Joi.number().min(0).max(100).default(0),
    maxTravelers: Joi.number().min(1).default(1),
    included: Joi.array().items(Joi.string().trim()).default([]),
    excluded: Joi.array().items(Joi.string().trim()).default([]),
    itinerary: Joi.array().items(
      Joi.object({
        title: Joi.string().trim().required(),
        location: Joi.string().trim().allow(''),
        locationMapLink: Joi.string().trim().allow(''),
        description: Joi.string().trim().allow(''),
        meals: Joi.array().items(
          Joi.string().valid('breakfast', 'lunch', 'dinner')
        ).default([])
      })
    ).default([]),
    accommodation: Joi.string().allow(''),
    transportation: Joi.string().allow(''),
    mealPlan: Joi.string().allow(''),
    
    // Location details
    location: Joi.object({
      country: Joi.string().trim().allow(''),
      state: Joi.string().trim().allow(''),
      city: Joi.string().trim().allow(''),
      address: Joi.string().trim().allow(''),
    }).optional(),
    
    // Highlights
    highlights: Joi.array()
      .items(Joi.string().trim())
      .default([]),
      
    // Ratings and reviews
    ratings: Joi.object({
      average: Joi.number().min(1).max(5).default(0),
      count: Joi.number().min(0).default(0),
      reviews: Joi.array().items(
        Joi.object({
          user: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).required(),
          rating: Joi.number().min(1).max(5).required(),
          comment: Joi.string().trim().allow(''),
          createdAt: Joi.date().default(Date.now)
        })
      ).default([])
    }).default({ average: 0, count: 0, reviews: [] }),
    
    // FAQs
    faqs: Joi.array().items(
      Joi.object({
        question: Joi.string().trim().required(),
        answer: Joi.string().trim().required(),
        isActive: Joi.boolean().default(true)
      })
    ).default([]),
    
    // Available seats
    availableSeats: Joi.number().min(0).default(0),
    
    // SEO Meta Fields
    metaTitle: Joi.string().trim().max(100).allow(''),
    metaDescription: Joi.string().trim().max(160).allow(''),
    metaKeywords: Joi.array().items(Joi.string().trim()).default([]),
    cancellationPolicy: Joi.string().allow(''),
    bookingDeadline: Joi.date().allow(null, ''),
    minTravelersRequired: Joi.number().min(1).default(1),
    isFeatured: Joi.boolean().default(false),
    isGroupDiscountAvailable: Joi.boolean().default(false),
    groupDiscountDetails: Joi.string().allow(''),
    ageRestrictions: Joi.string().allow(''),
    physicalRating: Joi.string().allow(''),
    specialRequirements: Joi.string().allow('')
  };

  // For updates, make fields optional
  const schema = isUpdate 
    ? Joi.object().keys(
        Object.keys(baseSchema).reduce((acc, key) => {
          acc[key] = baseSchema[key].optional();
          return acc;
        }, {})
      )
    : Joi.object(baseSchema);

  return schema.validate(data, { abortEarly: false, allowUnknown: false });
};

// Middleware to validate project input
export const validateProject = (req, res, next) => {
  console.log('Validating project data:', JSON.stringify(req.body, null, 2));
  const { error, value } = validateProjectInput(req.body, req.method === 'PATCH');
  
  if (error) {
    console.error('Validation error:', error.details);
    const errorMessage = error.details.map(detail => detail.message).join(', ');
    return next(new ApiError(errorMessage, 400));
  }
  
  // Attach validated data to the request object
  req.validatedData = value;
  next();
};

// Middleware to check if project exists
export const projectExists = async (req, res, next) => {
  try {
    const project = await Project.findOne({
      $or: [
        { _id: req.params.id },
        { slug: req.params.id }
      ]
    });

    if (!project) {
      return res.status(404).json({
        status: 'fail',
        message: 'No project found with that ID or slug'
      });
    }

    req.project = project;
    next();
  } catch (error) {
    next(error);
  }
};
