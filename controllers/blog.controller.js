import mongoose from 'mongoose';
import { Blog } from '../models/blog.model.js';
import ErrorResponse from '../utils/errorResponse.js';
import asyncHandler from 'express-async-handler';
import path from 'path';

// @desc    Get all blog posts
// @route   GET /api/v1/blog
// @access  Public
const getBlogs = asyncHandler(async (req, res, next) => {
  // Copy req.query
  const reqQuery = { ...req.query };

  // Fields to exclude
  const removeFields = ['select', 'sort', 'page', 'limit'];

  // Loop over removeFields and delete them from reqQuery
  removeFields.forEach(param => delete reqQuery[param]);

  // Create base query
  let query = Blog.find();

  // Apply published filter for non-admin users
  if (!req.user?.role || req.user.role !== 'admin') {
    query = query.where('published').equals(true);
  }

  // Handle category filter
  if (req.query.category) {
    try {
      const categoryId = new mongoose.Types.ObjectId(req.query.category);
      query = query.where('categories').equals(categoryId);
      console.log('Filtering by category ID:', categoryId);
    } catch (err) {
      console.error('Invalid category ID:', req.query.category, err);
      return res.status(400).json({
        success: false,
        error: 'Invalid category ID format'
      });
    }
  }

  // Apply other filters from reqQuery (search, etc.)
  Object.keys(reqQuery).forEach(key => {
    if (key !== 'select' && key !== 'sort' && key !== 'page' && key !== 'limit' && key !== 'category') {
      if (reqQuery[key]) {  // Only add filter if value is not empty
        query = query.where(key).equals(reqQuery[key]);
      }
    }
  });

  // Debug: Log the final query
  console.log('Final query filter:', query.getFilter());

  // Select Fields
  if (req.query.select) {
    const fields = req.query.select.split(',').join(' ');
    query = query.select(fields);
  }

  // Sort
  if (req.query.sort) {
    const sortBy = req.query.sort.split(',').join(' ');
    query = query.sort(sortBy);
  } else {
    query = query.sort('-createdAt');
  }

  // Pagination
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 10;
  const startIndex = (page - 1) * limit;
  const endIndex = page * limit;
  const total = await Blog.countDocuments(query.getFilter());

  query = query.skip(startIndex).limit(limit);

  // Populate categories
  query = query.populate('categories', 'name _id');

  // Execute query
  const results = await query;

  // Pagination result
  const pagination = {};
  if (endIndex < total) {
    pagination.next = {
      page: page + 1,
      limit
    };
  }

  if (startIndex > 0) {
    pagination.prev = {
      page: page - 1,
      limit
    };
  }

  res.status(200).json({
    success: true,
    count: results.length,
    pagination,
    data: results
  });

  // // Pagination
  // const page = parseInt(req.query.page, 10) || 1;
  // const limit = parseInt(req.query.limit, 10) || 10;
  // const startIndex = (page - 1) * limit;
  // const endIndex = page * limit;
  // const total = await Blog.countDocuments(JSON.parse(queryStr));

  query = query.skip(startIndex).limit(limit);

  // Executing query
  const blogs = await query;

  // Pagination result
  // const pagination = {};

  if (endIndex < total) {
    pagination.next = {
      page: page + 1,
      limit
    };
  }

  if (startIndex > 0) {
    pagination.prev = {
      page: page - 1,
      limit
    };
  }

  res.status(200).json({
    success: true,
    count: blogs.length,
    pagination,
    data: blogs
  });
});

// @desc    Get single blog post by slug
// @route   GET /api/v1/blog/slug/:slug
// @access  Public
const getBlogBySlug = asyncHandler(async (req, res, next) => {
  const blog = await Blog.findOne({ slug: req.params.slug })
    .populate('categories', 'name _id');

  if (!blog) {
    return next(
      new ErrorResponse(`Blog post not found with slug of ${req.params.slug}`, 404)
    );
  }

  res.status(200).json({ success: true, data: blog });
});

// @desc    Get single blog post by ID
// @route   GET /api/v1/blog/:id
// @access  Public
const getBlog = asyncHandler(async (req, res, next) => {
  const blog = await Blog.findById(req.params.id).populate('categories', 'name _id');

  if (!blog) {
    return next(
      new ErrorResponse(`Blog post not found with id of ${req.params.id}`, 404)
    );
  }

  // Increment view count
  blog.views += 1;
  await blog.save();

  res.status(200).json({
    success: true,
    data: blog
  });
});

// @desc    Create a blog post
// @route   POST /api/v1/blog
// @access  Private/Admin
const createBlog = asyncHandler(async (req, res, next) => {
  const {
    title,
    slug,
    excerpt,
    content,
    featuredImage,
    tags,
    categories = [],
    published,
    metaTitle,
    metaDescription,
  } = req.body;

  // Validate categories
  if (!Array.isArray(categories) || categories.length === 0) {
    return next(new ErrorResponse('At least one category is required', 400));
  }

  // Ensure categories is an array (in case a single category is passed)
  const categoriesArray = Array.isArray(categories) ? categories : [categories];

  // Convert all category IDs to ObjectIds
  const categoryIds = categoriesArray.map(id =>
    id instanceof mongoose.Types.ObjectId ? id : new mongoose.Types.ObjectId(id)
  );

  console.log('Processing blog with category IDs:', categoryIds);

  // Check if all categories exist
  const existingCategories = await mongoose.model('BlogCategory').find({
    _id: { $in: categoryIds }
  });

  console.log('Found existing categories:', existingCategories.map(c => c._id));

  if (existingCategories.length !== categoryIds.length) {
    const foundIds = new Set(existingCategories.map(c => c._id.toString()));
    const missingIds = categoryIds.filter(id => !foundIds.has(id.toString()));
    console.error('Missing category IDs:', missingIds);
    return next(new ErrorResponse(`The following categories do not exist: ${missingIds.join(', ')}`, 400));
  }

  // Check if blog with same slug already exists
  const blogExists = await Blog.findOne({ slug });

  if (blogExists) {
    return next(new ErrorResponse('Blog with this slug already exists', 400));
  }

  // Validate featured image URL if provided
  if (featuredImage) {
    try {
      new URL(featuredImage);
    } catch (err) {
      return next(new ErrorResponse('Invalid featured image URL', 400));
    }
  }

  const blog = new Blog({
    title,
    slug,
    excerpt,
    content,
    featuredImage: featuredImage || '',
    tags: Array.isArray(tags) ? tags : [],
    categories: categoryIds,
    published: published || false,
    meta: {
      title: metaTitle || title,
      description: metaDescription || excerpt,
    },
    author: req.user.id,
  });

  const createdBlog = await blog.save();
  res.status(201).json({
    success: true,
    data: createdBlog
  });
});

// @desc    Update a blog post
// @route   PUT /api/v1/blog/:id
// @access  Private/Admin
const updateBlog = asyncHandler(async (req, res, next) => {
  const blog = await Blog.findById(req.params.id);

  if (!blog) {
    return next(new ErrorResponse('Blog post not found', 404));
  }

  const {
    title,
    slug,
    excerpt,
    content,
    featuredImage,
    tags,
    published,
    metaTitle,
    metaDescription,
    categories,
  } = req.body;

  // Check if blog with same slug already exists (excluding current blog)
  if (slug && slug !== blog.slug) {
    const blogExists = await Blog.findOne({ slug });
    if (blogExists) {
      return next(new ErrorResponse('Blog with this slug already exists', 400));
    }
  }

  // Handle categories update if provided
  if (categories) {
    // Ensure categories is an array (in case a single category is passed)
    const categoriesArray = Array.isArray(categories) ? categories : [categories];

    // Convert all category IDs to ObjectIds
    const categoryIds = categoriesArray.map(id =>
      id instanceof mongoose.Types.ObjectId ? id : new mongoose.Types.ObjectId(id)
    );

    console.log('Updating blog with category IDs:', categoryIds);

    // Verify all categories exist
    const existingCategories = await mongoose.model('BlogCategory').find({
      _id: { $in: categoryIds }
    });

    console.log('Found existing categories for update:', existingCategories.map(c => c._id));

    if (existingCategories.length !== categoryIds.length) {
      const foundIds = new Set(existingCategories.map(c => c._id.toString()));
      const missingIds = categoryIds.filter(id => !foundIds.has(id.toString()));
      console.error('Missing category IDs during update:', missingIds);
      return next(new ErrorResponse(`The following categories do not exist: ${missingIds.join(', ')}`, 400));
    }

    blog.categories = categoryIds;
  }

  // Update other blog fields
  blog.title = title || blog.title;
  blog.slug = slug || blog.slug;
  blog.excerpt = excerpt || blog.excerpt;
  blog.content = content || blog.content;
  blog.featuredImage = featuredImage ? String(featuredImage) : blog.featuredImage;
  blog.tags = Array.isArray(tags) ? tags : [];
  blog.published = published !== undefined ? published : blog.published;

  // Update meta fields if provided
  if (metaTitle || metaDescription) {
    blog.meta = {
      title: metaTitle || blog.meta?.title || blog.title,
      description: metaDescription || blog.meta?.description || blog.excerpt,
    };
  }

  const updatedBlog = await blog.save();
  res.status(200).json({
    success: true,
    data: updatedBlog
  });
});

// @desc    Delete a blog post
// @route   DELETE /api/v1/blog/:id
// @access  Private/Admin
const deleteBlog = asyncHandler(async (req, res, next) => {
  const blog = await Blog.findById(req.params.id);

  if (!blog) {
    return next(new ErrorResponse('Blog post not found', 404));
  }

  await blog.deleteOne();
  res.status(200).json({
    success: true,
    data: {}
  });
});

export {
  getBlogs,
  getBlog,
  getBlogBySlug,
  createBlog,
  updateBlog,
  deleteBlog
};
