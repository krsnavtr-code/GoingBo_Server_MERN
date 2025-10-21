import Project from '../models/project.model.js';
import asyncHandler from 'express-async-handler';
import ApiError from '../utils/ApiError.js';
import { validateProjectInput } from '../middleware/projectValidation.js';

// @desc    Create a new project
// @route   POST /api/projects
// @access  Private/Admin
export const createProject = asyncHandler(async (req, res, next) => {
  try {
    // Use the validated data from the middleware
    const projectData = { ...req.validatedData };
    
    console.log('Creating project with data:', JSON.stringify(projectData, null, 2));
    
    // Process image gallery
    if (projectData.imageGallery && Array.isArray(projectData.imageGallery)) {
      projectData.imageGallery = projectData.imageGallery.map(image => {
        if (!image || typeof image !== 'string') return null;
        if (image.startsWith('http')) return image;
        return image.startsWith('/') ? image : `/${image}`;
      }).filter(Boolean);
    }

    const project = await Project.create(projectData);
  
    res.status(201).json({
      status: 'success',
      data: {
        project
      }
    });
  } catch (error) {
    console.error('Error creating project:', error);
    next(error);
  }
});

// @desc    Get all projects
// @route   GET /api/projects
// @access  Public
export const getProjects = asyncHandler(async (req, res) => {
  // Build query
  const queryObj = { ...req.query };
  const excludedFields = ['page', 'sort', 'limit', 'fields'];
  excludedFields.forEach(el => delete queryObj[el]);

  // Filtering
  let queryStr = JSON.stringify(queryObj);
  queryStr = queryStr.replace(/\b(gte|gt|lte|lt)\b/g, match => `$${match}`);
  
  let query = Project.find(JSON.parse(queryStr)).populate('itcategories', 'name');

  // Sorting
  if (req.query.sort) {
    const sortBy = req.query.sort.split(',').join(' ');
    query = query.sort(sortBy);
  } else {
    query = query.sort('-createdAt');
  }

  // Field limiting
  if (req.query.fields) {
    const fields = req.query.fields.split(',').join(' ');
    query = query.select(fields);
  } else {
    query = query.select('-__v');
  }

  // Pagination
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 10;
  const skip = (page - 1) * limit;
  
  const total = await Project.countDocuments(JSON.parse(queryStr));
  query = query.skip(skip).limit(limit);

  const projects = await query;

  res.status(200).json({
    status: 'success',
    results: projects.length,
    total,
    totalPages: Math.ceil(total / limit),
    currentPage: page,
    data: {
      projects
    }
  });
});

// @desc    Get single project by ID or slug
// @route   GET /api/projects/:id
// @access  Public
export const getProject = asyncHandler(async (req, res, next) => {
  const project = await Project.findOne({
    $or: [
      { _id: req.params.id },
      { slug: req.params.id }
    ]
  }).populate('itcategories', 'name');

  if (!project) {
    return next(new ApiError('No project found with that ID or slug', 404));
  }

  res.status(200).json({
    status: 'success',
    data: {
      project
    }
  });
});

// @desc    Update a project
// @route   PATCH /api/projects/:id
// @access  Private/Admin
export const updateProject = asyncHandler(async (req, res, next) => {
  // Validate input
  const { error } = validateProjectInput(req.body, true);
  if (error) {
    return next(new ApiError(error.details[0].message, 400));
  }

  // Process image URLs if provided
  const projectData = { ...req.body };
  
  // // If mainImage is provided, prepend the base URL if it's a relative path
  // if (projectData.mainImage && !projectData.mainImage.startsWith('http')) {
  //   projectData.mainImage = `${projectData.mainImage}`;
  // }

  // // Process image gallery
  // if (projectData.imageGallery && Array.isArray(projectData.imageGallery)) {
  //   projectData.imageGallery = projectData.imageGallery.map(image => 
  //     image.startsWith('http') ? image : `${image}`
  //   );
  // }

  const project = await Project.findByIdAndUpdate(
    req.params.id,
    projectData,
    {
      new: true,
      runValidators: true
    }
  );

  if (!project) {
    return next(new ApiError('No project found with that ID', 404));
  }

  res.status(200).json({
    status: 'success',
    data: {
      project
    }
  });
});

// @desc    Delete a project
// @route   DELETE /api/projects/:id
// @access  Private/Admin
export const deleteProject = asyncHandler(async (req, res, next) => {
  const project = await Project.findByIdAndDelete(req.params.id);

  if (!project) {
    return next(new ApiError('No project found with that ID', 404));
  }

  res.status(204).json({
    status: 'success',
    data: null
  });
});

// @desc    Get projects by category
// @route   GET /api/projects/category/:categoryId
// @access  Public
// @desc    Get single project by slug
// @route   GET /api/projects/slug/:slug
// @access  Public
export const getProjectBySlug = asyncHandler(async (req, res, next) => {
  const project = await Project.findOne({ 
    slug: req.params.slug,
    isPublished: true 
  }).populate('itcategories', 'name');

  if (!project) {
    return next(new ApiError('No published project found with that slug', 404));
  }

  res.status(200).json({
    status: 'success',
    data: {
      project
    }
  });
});

// @desc    Get projects by category
// @route   GET /api/projects/category/:categoryId
// @access  Public
export const getProjectsByCategory = asyncHandler(async (req, res, next) => {
  const projects = await Project.find({ 
    itcategories: req.params.categoryId,
    isPublished: true 
  }).sort('-createdAt');

  res.status(200).json({
    status: 'success',
    results: projects.length,
    data: {
      projects
    }
  });
});

// @desc    Toggle project publish status
// @route   PATCH /api/projects/:id/toggle-publish
// @access  Private/Admin
export const togglePublishProject = asyncHandler(async (req, res, next) => {
  const project = await Project.findById(req.params.id);
  
  if (!project) {
    return next(new ApiError('No project found with that ID', 404));
  }
  
  project.isPublished = !project.isPublished;
  await project.save({ validateBeforeSave: false });
  
  res.status(200).json({
    status: 'success',
    data: {
      isPublished: project.isPublished
    }
  });
});
