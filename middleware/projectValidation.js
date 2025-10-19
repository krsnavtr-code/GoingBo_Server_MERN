import Joi from 'joi';
import ApiError from '../utils/ApiError.js';
import Project from '../models/project.model.js';

// Validation schema for project creation and update
export const validateProjectInput = (data, isUpdate = false) => {
  const baseSchema = {
    // Main image and image gallery are optional and not validated
    mainImage: Joi.any().optional(),
    imageGallery: Joi.any().optional(),
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
    technologies: Joi.array()
      .items(Joi.string())
      .default([]),
    projectUrl: Joi.string()
      .uri()
      .allow('')
      .messages({
        'string.uri': 'Project URL must be a valid URL'
      }),
    githubUrl: Joi.string()
      .uri()
      .allow('')
      .messages({
        'string.uri': 'GitHub URL must be a valid URL'
      }),
    githubUrl2: Joi.string()
      .uri()
      .allow('')
      .messages({
        'string.uri': 'Second GitHub URL must be a valid URL'
      }),
    status: Joi.string()
      .valid('planning', 'in_progress', 'completed', 'on_hold', 'cancelled')
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
      })
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
