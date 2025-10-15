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

  // Create query string
  let queryStr = JSON.stringify(reqQuery);

  // Create operators ($gt, $gte, etc)
  queryStr = queryStr.replace(/\b(gt|gte|lt|lte|in)\b/g, match => `$${match}`);

  // Finding resource
  let query = Blog.find(JSON.parse(queryStr));

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
  const total = await Blog.countDocuments(JSON.parse(queryStr));

  query = query.skip(startIndex).limit(limit);

  // Executing query
  const blogs = await query;

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
    count: blogs.length,
    pagination,
    data: blogs
  });
});

// @desc    Get single blog post
// @route   GET /api/v1/blog/:id
// @access  Public
const getBlog = asyncHandler(async (req, res, next) => {
  const blog = await Blog.findById(req.params.id);

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
    published,
    metaTitle,
    metaDescription,
  } = req.body;

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
  } = req.body;

  // Check if blog with same slug already exists (excluding current blog)
  if (slug && slug !== blog.slug) {
    const blogExists = await Blog.findOne({ slug });
    if (blogExists) {
      return next(new ErrorResponse('Blog with this slug already exists', 400));
    }
  }

  // Validate featured image URL if provided
  if (featuredImage) {
    try {
      new URL(featuredImage);
    } catch (err) {
      return next(new ErrorResponse('Invalid featured image URL', 400));
    }
  }

  // Update blog fields
  blog.title = title || blog.title;
  blog.slug = slug || blog.slug;
  blog.excerpt = excerpt || blog.excerpt;
  blog.content = content || blog.content;
  blog.featuredImage = featuredImage || blog.featuredImage;
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
  createBlog,
  updateBlog,
  deleteBlog
};
