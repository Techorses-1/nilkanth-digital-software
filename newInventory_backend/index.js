const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();

// MongoDB Connection
const connectDB = require('./config/mongodb');
connectDB();

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Middlewares
app.use(cors());
app.use(express.json());

const cron = require("node-cron");
const Customer = require("./models/customer");

// ============= OLD ROUTES (KEEP AS IS) =============
const vendorRoutes = require('./routes/vendorRoutes');
const adminRoutes = require('./routes/admin');
const customerRoutes = require("./routes/customerRoutes");
const authRoutes = require("./routes/authRoutes");

// ============= NEW ROUTES (ADD THESE) =============
const unitRoutes = require('./routes/unitRoutes');
const itemRoutes = require('./routes/itemRoutes');
const productRoutes = require('./routes/productRoutes');

// ===== INVENTORY ROUTES =====
const itemInventoryRoutes = require('./routes/itemInventoryRoutes');
const productInventoryRoutes = require('./routes/productInventoryRoutes');

const salesRoutes = require('./routes/salesRoutes');

// ===== PURCHASE ROUTES (NEW) =====
const itemPurchaseRoutes = require('./routes/itemPurchaseRoutes');
const productPurchaseRoutes = require('./routes/productPurchaseRoutes');

// ============= ROUTE MIDDLEWARES =============
// Old routes
app.use('/customer', customerRoutes);
app.use('/vendors', vendorRoutes);
app.use('/auth', authRoutes);
app.use('/admin', adminRoutes);

// New routes
app.use('/units', unitRoutes);
app.use('/items', itemRoutes);
app.use('/products-master', productRoutes); // Using different path to avoid conflict with existing /products
app.use('/item-inventory', itemInventoryRoutes);
app.use('/product-inventory', productInventoryRoutes);
app.use('/sales', salesRoutes);

app.use('/item-purchase', itemPurchaseRoutes);
app.use('/product-purchase', productPurchaseRoutes);



// ============= CRON JOB (Keep as is) =============
cron.schedule("0 0 1 1 *", async () => {
  try {
    await Customer.updateMany({}, { $set: { loyaltyCoins: 0 } });
    console.log("✅ Yearly reset: Loyalty coins reset for all customers (1 Jan)");
  } catch (error) {
    console.error("❌ Error resetting loyalty coins:", error);
  }
});

// Basic Route
app.get('/', (req, res) => {
  res.send('New Updated Inventory Backend Running !');
});

// Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});