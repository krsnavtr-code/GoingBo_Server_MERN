import mongoose from 'mongoose';

const advancedResults = (model, populate) => async (req, res, next) => {
  let query;

  // Create a copy of req.query
  const reqQuery = { ...req.query };

  // Fields to exclude from filtering
  const removeFields = ['select', 'sort', 'page', 'limit'];

  // Remove fields from reqQuery
  removeFields.forEach(param => delete reqQuery[param]);

  // Handle category filter separately
  if (reqQuery.category) {
    // Convert category string to ObjectId
    reqQuery.categories = reqQuery.category;
    delete reqQuery.category;
  }

  // Create query string
  let queryStr = JSON.stringify(reqQuery);

  // Create operators ($gt, $gte, etc)
  queryStr = queryStr.replace(/\b(gt|gte|lt|lte|in)\b/g, match => `$${match}`);

  // Parse the query string to an object
  const parsedQuery = JSON.parse(queryStr);

  // Handle categories as an array of ObjectIds
  if (parsedQuery.categories) {
    parsedQuery.categories = { $in: [new mongoose.Types.ObjectId(parsedQuery.categories)] };
  }

  // Start building the query
  query = model.find(parsedQuery);

  // Select fields
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
  const limit = parseInt(req.query.limit, 10) || 25;
  const startIndex = (page - 1) * limit;
  const endIndex = page * limit;
  const total = await model.countDocuments(JSON.parse(queryStr));

  query = query.skip(startIndex).limit(limit);

  // Populate if specified
  if (populate) {
    query = query.populate(populate);
  }

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

  res.advancedResults = {
    success: true,
    count: results.length,
    pagination,
    data: results
  };

  next();
};

export default advancedResults;
