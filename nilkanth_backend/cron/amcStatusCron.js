const cron = require("node-cron");
const AMC = require("../models/amc");

// ===== Runs every day at 12:00 AM IST =====
// 1. Mark Active AMCs as Expired if endDate < today
// 2. Activate Pending AMCs whose startDate <= today
const startAmcStatusCron = () => {
    // cron.schedule("0 0 * * *", async () => {   // ← PRODUCTION (midnight daily)
    cron.schedule("*/60 * * * *", async () => {    // ← TEST (every 1 minute)
        console.log("🔄 AMC Status Cron: Running at", new Date().toISOString());

        try {
            const now = new Date(); // current moment — no setHours

            // ===== STEP 1: Expire Active AMCs whose endDate < now =====
            const expiredAmcs = await AMC.find({
                status: 'Active',
                endDate: { $lt: now }
            });

            for (const amc of expiredAmcs) {
                amc.status = 'Expired';
                await amc.save();
                console.log(`⏰ AMC expired: ${amc.amcNumber}`);
            }

            // ===== STEP 2: Activate Pending AMCs whose startDate <= now =====
            const pendingAmcs = await AMC.find({
                status: 'Pending',
                startDate: { $lte: now }
            });

            for (const amc of pendingAmcs) {
                amc.status = 'Active';
                await amc.save();
                console.log(`✅ AMC activated (renewal): ${amc.amcNumber}`);
            }

            console.log(`✅ AMC Cron done. Expired: ${expiredAmcs.length}, Activated: ${pendingAmcs.length}`);
        } catch (error) {
            console.error("❌ AMC Cron error:", error);
        }
    });

    console.log("✅ AMC Status Cron scheduled (TEST: every 1 minute)");
};

module.exports = startAmcStatusCron;