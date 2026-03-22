const mongoose = require('mongoose');

const CourseSchema = new mongoose.Schema({
    courseCode: {
        type: String,
        required: true,
        trim: true
    },
    courseName: {
        type: String,
        required: true,
        trim: true
    },
    technology: {
        type: String,
        required: true,
        trim: true
    },
    durationHours: {
        type: Number,
        default: null
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

// Index for fast search
CourseSchema.index({ technology: 1 });
CourseSchema.index({ courseCode: 'text', courseName: 'text' });
CourseSchema.index({ courseCode: 1, courseName: 1 }, { unique: true });

// Pre-save hook
CourseSchema.pre('save', function (next) {
    this.updatedAt = Date.now();
    next();
});

module.exports = mongoose.model('Course', CourseSchema);
