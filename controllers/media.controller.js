import multer from 'multer';
import path from 'path';
import fs from 'fs';
import Media from '../models/media.model.js';
import AppError from '../utils/appError.js';

// Configure multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = 'uploads/';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, 'media-' + uniqueSuffix + ext);
  },
});

// Accept all file types
const fileFilter = (req, file, cb) => {
  cb(null, true);
};

// Initialize multer upload
const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
});

export const uploadMedia = [
  upload.single('file'),
  async (req, res, next) => {
    try {
      if (!req.file) {
        return next(new AppError('Please upload a file', 400));
      }

      const media = await Media.create({
        filename: req.file.filename,
        originalname: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size,
        path: `/uploads/${req.file.filename}`,
      });

      res.status(201).json({
        status: 'success',
        data: {
          media,
        },
      });
    } catch (error) {
      // Delete the uploaded file if there's an error
      if (req.file) {
        fs.unlink(req.file.path, (err) => {
          if (err) console.error('Error deleting file:', err);
        });
      }
      next(error);
    }
  },
];

export const getAllMedia = async (req, res, next) => {
  try {
    const media = await Media.find().sort({ createdAt: -1 });
    
    res.status(200).json({
      status: 'success',
      results: media.length,
      data: {
        media,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const deleteMedia = async (req, res, next) => {
  try {
    const { id } = req.params;
    const media = await Media.findByIdAndDelete(id);

    if (!media) {
      return next(new AppError('No media found with that ID', 404));
    }

    // Delete the file from the server
    const filePath = `uploads/${media.filename}`;
    if (fs.existsSync(filePath)) {
      fs.unlink(filePath, (err) => {
        if (err) console.error('Error deleting file:', err);
      });
    }

    res.status(204).json({
      status: 'success',
      data: null,
    });
  } catch (error) {
    next(error);
  }
};


export const updateMediaTags = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { tags } = req.body;

    if (!Array.isArray(tags)) {
      return next(new AppError('Tags must be an array', 400));
    }

    const media = await Media.findByIdAndUpdate(
      id,
      { tags },
      { new: true, runValidators: true }
    );

    if (!media) {
      return next(new AppError('No media found with that ID', 404));
    }

    res.status(200).json({
      status: 'success',
      data: {
        media
      }
    });
  } catch (err) {
    next(err);
  }
};

