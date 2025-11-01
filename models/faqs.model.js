import mongoose from "mongoose";

const faqsSchema = new mongoose.Schema({
    question: {
        type: String,
        required: true
    },
    answer: {
        type: String,
        required: true
    },
    isActive: {
        type: Boolean,
        default: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
})
// Update the updatedAt field before saving
faqsSchema.pre('save', function (next) {
    this.updatedAt = Date.now();
    next();
});
const Faqs = mongoose.model("Faqs", faqsSchema);

export default Faqs;
