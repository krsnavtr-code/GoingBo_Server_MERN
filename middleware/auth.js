import jwt from 'jsonwebtoken';
import asyncHandler from 'express-async-handler';
import User from '../models/user.model.js';

// Protect routes
export const protect = asyncHandler(async (req, res, next) => {
    let token;

    // 1. Get token from header or cookies
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        // Get token from header
        token = req.headers.authorization.split(' ')[1];
    } else if (req.cookies.jwt) {
        // Get token from cookie
        token = req.cookies.jwt;
    }

    if (!token) {
        return next(new Error('Not authorized, no token'));
    }

    try {
        // 2. Verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // 3. Get user from the token
        req.user = await User.findById(decoded.id).select('-password');

        if (!req.user) {
            return next(new Error('User not found'));
        }

        next();
    } catch (error) {
        console.error('Token verification error:', error);
        return next(new Error('Not authorized, token failed'));
    }
});

export const authorize = (...roles) => {
    return (req, res, next) => {
        if (!roles.includes(req.user.role)) {
            return next(
                new Error(`User role ${req.user.role} is not authorized to access this route`)
            );
        }
        next();
    };
};

// Alias for authorize to maintain compatibility with the project
// This is the same as authorize but with a more descriptive name
export const restrictTo = (...roles) => authorize(...roles);