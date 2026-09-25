const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const unitSchema = new mongoose.Schema({
    unitId: {
        type: String,
        unique: true,
        default: () => uuidv4(),
    },
    unitName: {
        type: String,
        required: [true, 'Unit name is required'],
        unique: true,
        trim: true,
        uppercase: true
    },
    unitDescription: {
        type: String,
        trim: true,
        default: ''
    }
}, {
    timestamps: true,
});

// Index for better query performance
unitSchema.index({ unitName: 1 });

const Unit = mongoose.models.Unit || mongoose.model('Unit', unitSchema);
module.exports = Unit;