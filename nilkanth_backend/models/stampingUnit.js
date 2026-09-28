const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const stampingUnitSchema = new mongoose.Schema({
    unitId: {
        type: String,
        unique: true,
        default: () => uuidv4(),
    },

    // ===== IDENTITY OF THE PHYSICAL UNIT =====
    // Compound key: customerId + productId + uniqueNumber (unique)
    customerId: {
        type: String,
        required: true,
        ref: 'Customer'
    },
    customerName: {
        type: String,
        required: true,
        trim: true
    },
    productId: {
        type: String,
        required: true,
        ref: 'Product'
    },
    productName: {
        type: String,
        required: true,
        trim: true
    },
    uniqueNumber: {
        type: String,
        required: true,
        trim: true
    },

    // ===== UNIT META =====
    hsnCode: {
        type: String,
        trim: true,
        default: ''
    },
    capacity: {
        type: String,
        trim: true,
        default: ''
    },
    storeType: {
        type: String,
        enum: ['Vadodara', 'Padra'],
        default: 'Vadodara'
    },

    // ===== LAST STAMP CACHE (for fast queries) =====
    lastStampDate: {
        type: Date,
        default: null
    },
    nextDueDate: {
        type: Date,
        default: null
    },
    lastStampingNumber: {
        type: String,
        default: null
    },
    lastStampingId: {
        type: String,
        default: null
    },

    // ===== COUNTER =====
    totalStamps: {
        type: Number,
        default: 0,
        min: 0
    },

    // ===== FULL HISTORY (one entry per stamping event) =====
    stampHistory: [{
        stampingId: {
            type: String,
            required: true
        },
        stampingNumber: {
            type: String,
            required: true
        },
        stampDate: {
            type: Date,
            required: true
        },
        storeType: {
            type: String,
            enum: ['Vadodara', 'Padra'],
            default: 'Vadodara'
        },
        stampedBy: {
            type: String,
            trim: true
        },
        stampedById: {
            type: String
        },
        createdAt: {
            type: Date,
            default: Date.now
        }
    }]

}, {
    timestamps: true,
});

// ===== INDEXES =====
// Compound unique: one unit per customer+product+uniqueNumber
stampingUnitSchema.index(
    { customerId: 1, productId: 1, uniqueNumber: 1 },
    { unique: true }
);

stampingUnitSchema.index({ customerId: 1 });
stampingUnitSchema.index({ productId: 1 });
stampingUnitSchema.index({ uniqueNumber: 1 });
stampingUnitSchema.index({ nextDueDate: 1 });
stampingUnitSchema.index({ lastStampDate: -1 });

// ===== VIRTUALS =====
stampingUnitSchema.virtual('stampCount').get(function () {
    return this.stampHistory ? this.stampHistory.length : 0;
});

stampingUnitSchema.set('toJSON', { virtuals: true });
stampingUnitSchema.set('toObject', { virtuals: true });

const StampingUnit = mongoose.models.StampingUnit || mongoose.model('StampingUnit', stampingUnitSchema);
module.exports = StampingUnit;