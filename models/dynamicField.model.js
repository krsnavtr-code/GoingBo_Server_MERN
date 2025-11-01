import mongoose from 'mongoose';

const dynamicFieldSchema = new mongoose.Schema({
    mediaGalaryTags: {
        type: [String],
        default: []
    },

});

const DynamicField = mongoose.model('DynamicField', dynamicFieldSchema);

export default DynamicField;
