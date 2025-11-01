import Faqs from "../models/faqs.model.js";

/**
 * @desc    Create a new FAQ
 * @route   POST /api/faqs
 * @access  Private/Admin
 */
export const createFaq = async (req, res) => {
    const { question, answer, isActive = true } = req.body;
    
    const faq = await Faqs.create({ 
        question, 
        answer, 
        isActive 
    });
    
    res.status(201).json({ 
        success: true, 
        data: faq 
    });
};

/**
 * @desc    Get all FAQs with pagination
 * @route   GET /api/faqs
 * @access  Public
 */
export const getFaqs = async (req, res) => {
    // Pagination
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;
    const total = await Faqs.countDocuments();

    // Filtering
    const filter = {};
    if (req.query.isActive) {
        filter.isActive = req.query.isActive === 'true';
    }

    // Sorting
    const sort = {};
    if (req.query.sortBy) {
        const parts = req.query.sortBy.split(':');
        sort[parts[0]] = parts[1] === 'desc' ? -1 : 1;
    } else {
        sort.createdAt = -1; // Default sort by newest first
    }

    const faqs = await Faqs.find(filter)
        .sort(sort)
        .limit(limit)
        .skip(startIndex);

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
        count: faqs.length,
        pagination,
        data: faqs
    });
};

/**
 * @desc    Get single FAQ by ID
 * @route   GET /api/faqs/:id
 * @access  Public
 */
export const getFaqById = async (req, res) => {
    const faq = await Faqs.findById(req.params.id);
    
    if (!faq) {
        throw new NotFoundError('FAQ not found');
    }
    
    res.status(200).json({
        success: true,
        data: faq
    });
};

/**
 * @desc    Update FAQ by ID
 * @route   PUT /api/faqs/:id
 * @access  Private/Admin
 */
export const updateFaq = async (req, res) => {
    const { question, answer, isActive } = req.body;
    
    const faq = await Faqs.findById(req.params.id);
    
    if (!faq) {
        throw new NotFoundError('FAQ not found');
    }
    
    // Update fields if provided
    if (question) faq.question = question;
    if (answer) faq.answer = answer;
    if (typeof isActive !== 'undefined') faq.isActive = isActive;
    
    await faq.save();
    
    res.status(200).json({
        success: true,
        data: faq
    });
};

/**
 * @desc    Delete FAQ by ID
 * @route   DELETE /api/faqs/:id
 * @access  Private/Admin
 */
export const deleteFaq = async (req, res) => {
    const faq = await Faqs.findByIdAndDelete(req.params.id);
    
    if (!faq) {
        throw new NotFoundError('FAQ not found');
    }
    
    res.status(200).json({
        success: true,
        data: {}
    });
};

/**
 * @desc    Toggle FAQ active status
 * @route   PATCH /api/faqs/:id/toggle
 * @access  Private/Admin
 */
export const toggleFaqStatus = async (req, res) => {
    const faq = await Faqs.findById(req.params.id);
    
    if (!faq) {
        throw new NotFoundError('FAQ not found');
    }
    
    faq.isActive = !faq.isActive;
    await faq.save();
    
    res.status(200).json({
        success: true,
        data: faq
    });
};
