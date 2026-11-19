/* ======== NOSQL DATABASE DESIGN – LAB SHEET - 3 ========

   Install driver  : npm install mongodb
   Run one question: node labsheet03.js 5
   Run all         : node labsheet03.js
   Q11 needs MongoDB running as a replica set (transactions).
   ======================================================== */

const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/?replicaSet=rs0";
const DB_NAME = "LabSheet3DB";

async function withDb(fn) {
  const { MongoClient } = require("mongodb");
  const client = new MongoClient(MONGO_URI);
  await client.connect();
  try { return await fn(client.db(DB_NAME), client); } finally { await client.close(); }
}
const daysAgo = (n) => new Date(Date.now() - n * 24 * 60 * 60 * 1000);
const show = (label, data) => console.log(`\n${label}:`, JSON.stringify(data, null, 2));

// ============================================================
// 1
// ============================================================
async function q1() {
  await withDb(async (db) => {
    const col = db.collection("student_activity");
    await col.deleteMany({});
    await col.insertMany([
      { student_id: 1, name: "Aarav Sharma", email: "aarav@mail.com",
        courses: ["Data Structures", "NoSQL"], attendance: { total: 40, attended: 36 },
        skills: ["Java", "MongoDB", "SQL"],
        recent_activities: [{ type: "quiz", date: daysAgo(1) }, { type: "assignment", date: daysAgo(3) }] },
      { student_id: 2, name: "Riya Verma", email: "riya@mail.com",
        courses: ["NoSQL", "AI"], attendance: { total: 40, attended: 24 },
        skills: ["Python", "ML"],
        recent_activities: [{ type: "lab", date: daysAgo(10) }] },
      { student_id: 3, name: "Karan Singh", email: "karan@mail.com",
        courses: ["Networks", "NoSQL"], attendance: { total: 40, attended: 30 },
        skills: ["C++", "MongoDB"],
        recent_activities: [{ type: "quiz", date: daysAgo(2) }, { type: "project", date: daysAgo(5) }] },
      { student_id: 4, name: "Neha Gupta", email: "neha@mail.com",
        courses: ["AI"], attendance: { total: 40, attended: 38 },
        skills: ["Python", "SQL", "MongoDB"],
        recent_activities: [] },
      { student_id: 5, name: "Rohan Mehta", email: "rohan@mail.com",
        courses: ["Data Structures", "Networks"], attendance: { total: 40, attended: 20 },
        skills: ["Java"],
        recent_activities: [{ type: "assignment", date: daysAgo(20) }] },
    ]);

    show("Enrolled in NoSQL", await col.find({ courses: "NoSQL" }, { projection: { name: 1, _id: 0 } }).toArray());
    show("Skills MongoDB AND SQL", await col.find({ skills: { $all: ["MongoDB", "SQL"] } }, { projection: { name: 1, _id: 0 } }).toArray());
    show("Attendance below 75%", await col.aggregate([
      { $addFields: { pct: { $multiply: [{ $divide: ["$attendance.attended", "$attendance.total"] }, 100] } } },
      { $match: { pct: { $lt: 75 } } },
      { $project: { _id: 0, name: 1, pct: 1 } },
    ]).toArray());
    show("Activity in last 7 days", await col.find(
      { recent_activities: { $elemMatch: { date: { $gte: daysAgo(7) } } } },
      { projection: { name: 1, _id: 0 } }).toArray());
    show("Did a quiz recently", await col.find({ "recent_activities.type": "quiz" }, { projection: { name: 1, _id: 0 } }).toArray());
    show("No recent activity", await col.find({ recent_activities: { $size: 0 } }, { projection: { name: 1, _id: 0 } }).toArray());
  });
}

// ============================================================
// 2
// ============================================================
async function q2() {
  await withDb(async (db) => {
    const col = db.collection("event_logs");
    await col.deleteMany({});
    const ev = (user, type, mins, ip = "10.0.0.1") => ({ user, event: type, ip, timestamp: new Date(Date.now() - mins * 60000) });
    await col.insertMany([
      ev("alice", "login", 100), ev("alice", "file-upload", 90), ev("alice", "logout", 80),
      ev("bob", "failed-login", 60, "10.0.0.7"), ev("bob", "failed-login", 58, "10.0.0.7"),
      ev("bob", "failed-login", 55, "10.0.0.7"), ev("bob", "failed-login", 50, "10.0.0.7"),
      ev("bob", "login", 45, "10.0.0.7"), ev("carol", "failed-login", 40, "10.0.0.9"),
      ev("carol", "password-change", 35), ev("carol", "login", 30), ev("dave", "login", 20),
      ev("dave", "file-upload", 15), ev("dave", "file-upload", 10), ev("dave", "logout", 5),
    ]);

    show("Repeated failed logins (3 or more)", await col.aggregate([
      { $match: { event: "failed-login" } },
      { $group: { _id: "$user", attempts: { $sum: 1 }, ips: { $addToSet: "$ip" } } },
      { $match: { attempts: { $gte: 3 } } },
    ]).toArray());
    show("Most frequent events", await col.aggregate([
      { $group: { _id: "$event", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]).toArray());
    show("Failed logins in last 2 hours per IP", await col.aggregate([
      { $match: { event: "failed-login", timestamp: { $gte: new Date(Date.now() - 2 * 3600000) } } },
      { $group: { _id: "$ip", count: { $sum: 1 } } },
    ]).toArray());
  });
}

// ============================================================
// 3
// ============================================================
async function q3() {
  await withDb(async (db) => {
    const col = db.collection("blogs");
    await col.deleteMany({});
    await col.insertMany([
      { title: "Intro to MongoDB", author: { name: "Aarav", email: "a@mail.com" }, category: "Database",
        tags: ["mongodb", "nosql", "beginner"], published: { date: new Date("2026-01-10"), status: "published" },
        comments: [{ user: "Riya", text: "Helpful!", date: new Date() }] },
      { title: "Indexing Deep Dive", author: { name: "Riya" }, category: "Database",
        tags: ["mongodb", "performance"], published: { date: new Date("2026-02-05"), status: "published" }, comments: [] },
      { title: "Learning Python", author: { name: "Karan" }, category: "Programming",
        tags: ["python", "beginner"], published: { date: new Date("2026-02-20"), status: "published" },
        comments: [{ user: "Neha", text: "Nice", date: new Date() }, { user: "Aarav", text: "Great", date: new Date() }] },
      { title: "REST API Design", author: { name: "Neha" }, category: "Web",
        tags: ["api", "node", "backend"], published: { date: new Date("2026-03-01"), status: "published" }, comments: [] },
      { title: "Graph Databases", author: { name: "Aarav" }, category: "Database",
        tags: ["neo4j", "nosql"], published: { date: null, status: "draft" }, comments: [] },
    ]);

    show("Tag mongodb", await col.find({ tags: "mongodb" }, { projection: { title: 1, _id: 0 } }).toArray());
    show("Tags nosql AND beginner", await col.find({ tags: { $all: ["nosql", "beginner"] } }, { projection: { title: 1, _id: 0 } }).toArray());
    show("Tags python OR api", await col.find({ tags: { $in: ["python", "api"] } }, { projection: { title: 1, _id: 0 } }).toArray());
    show("Category Database AND tag nosql", await col.find({ category: "Database", tags: "nosql" }, { projection: { title: 1, _id: 0 } }).toArray());
    show("Category Database but NOT tag mongodb", await col.find({ category: "Database", tags: { $nin: ["mongodb"] } }, { projection: { title: 1, _id: 0 } }).toArray());
    show("Blogs with comments", await col.find({ "comments.0": { $exists: true } }, { projection: { title: 1, _id: 0 } }).toArray());
  });
}

// ============================================================
// 4
// ============================================================
async function q4() {
  await withDb(async (db) => {
    const col = db.collection("catalog");
    await col.deleteMany({});
    await col.insertMany([
      { name: "ProBook 15", category: "laptop", price: 65000, specs: { ram_gb: 16, processor: "i7", storage_gb: 512 } },
      { name: "AirLite 13", category: "laptop", price: 45000, specs: { ram_gb: 8, processor: "i5", storage_gb: 256 } },
      { name: "Nova X", category: "mobile", price: 22000, specs: { battery_mah: 5000, os: "Android", camera_mp: 64, five_g: true } },
      { name: "iPhone Mini", category: "mobile", price: 70000, specs: { battery_mah: 3200, os: "iOS", camera_mp: 12, five_g: true } },
      { name: "SnapPro", category: "camera", price: 55000, specs: { megapixels: 24, lens_mount: "EF", sensor: "APS-C", video: "4K" } },
      { name: "ZoomShot", category: "camera", price: 30000, specs: { megapixels: 20, optical_zoom: 30 } },
    ]);

    show("Laptops with RAM >= 16 GB", await col.find({ category: "laptop", "specs.ram_gb": { $gte: 16 } }, { projection: { name: 1, _id: 0 } }).toArray());
    show("Android mobiles with 5G", await col.find({ category: "mobile", "specs.os": "Android", "specs.five_g": true }, { projection: { name: 1, _id: 0 } }).toArray());
    show("Cameras with 4K video", await col.find({ "specs.video": "4K" }, { projection: { name: 1, _id: 0 } }).toArray());
    show("Products having a lens_mount field", await col.find({ "specs.lens_mount": { $exists: true } }, { projection: { name: 1, _id: 0 } }).toArray());
    show("Average price per category", await col.aggregate([{ $group: { _id: "$category", avgPrice: { $avg: "$price" } } }]).toArray());
  });
}

// ============================================================
// 5
// ============================================================
async function q5() {
  await withDb(async (db) => {
    const customers = db.collection("customers"), products = db.collection("products"), orders = db.collection("orders");
    await Promise.all([customers.deleteMany({}), products.deleteMany({}), orders.deleteMany({})]);

    await customers.insertMany([
      { _id: 1, name: "Aarav", email: "aarav@mail.com", city: "Delhi" },
      { _id: 2, name: "Riya", email: "riya@mail.com", city: "Mumbai" },
      { _id: 3, name: "Karan", email: "karan@mail.com", city: "Pune" },
    ]);
    await products.insertMany([
      { _id: 101, name: "Laptop", price: 50000 }, { _id: 102, name: "Mouse", price: 500 },
      { _id: 103, name: "Keyboard", price: 1500 }, { _id: 104, name: "Monitor", price: 9000 },
    ]);
    await orders.insertMany([
      { _id: 1001, customer_id: 1, date: daysAgo(30), items: [{ product_id: 101, qty: 1 }, { product_id: 102, qty: 2 }] },
      { _id: 1002, customer_id: 2, date: daysAgo(20), items: [{ product_id: 104, qty: 1 }] },
      { _id: 1003, customer_id: 1, date: daysAgo(5),  items: [{ product_id: 103, qty: 2 }, { product_id: 104, qty: 1 }] },
      { _id: 1004, customer_id: 3, date: daysAgo(2),  items: [{ product_id: 102, qty: 5 }] },
    ]);

    show("Complete purchase history of Aarav", await orders.aggregate([
      { $match: { customer_id: 1 } },
      { $unwind: "$items" },
      { $lookup: { from: "products", localField: "items.product_id", foreignField: "_id", as: "p" } },
      { $unwind: "$p" },
      { $project: { _id: 0, order_id: "$_id", date: 1, product: "$p.name", qty: "$items.qty",
                    line_total: { $multiply: ["$p.price", "$items.qty"] } } },
      { $sort: { date: 1 } },
    ]).toArray());

    show("Order totals", await orders.aggregate([
      { $unwind: "$items" },
      { $lookup: { from: "products", localField: "items.product_id", foreignField: "_id", as: "p" } },
      { $unwind: "$p" },
      { $group: { _id: "$_id", customer_id: { $first: "$customer_id" },
                  total: { $sum: { $multiply: ["$p.price", "$items.qty"] } } } },
      { $lookup: { from: "customers", localField: "customer_id", foreignField: "_id", as: "c" } },
      { $project: { total: 1, customer: { $arrayElemAt: ["$c.name", 0] } } },
      { $sort: { _id: 1 } },
    ]).toArray());
  });
}

// ============================================================
// 6
// ============================================================
async function q6() {
  await withDb(async (db) => {
    const col = db.collection("page_visits");
    await col.deleteMany({});
    const pages = ["/home", "/products", "/about", "/contact", "/home", "/products", "/home"];
    const devices = ["mobile", "desktop", "mobile", "tablet", "mobile", "desktop", "mobile"];
    const browsers = ["Chrome", "Firefox", "Chrome", "Safari", "Edge", "Chrome", "Safari"];
    const cities = ["Delhi", "Mumbai", "Pune", "Delhi", "Jaipur", "Mumbai", "Delhi"];
    const visits = [];
    for (let i = 0; i < 21; i++) {
      const k = i % 7;
      visits.push({ page: pages[k], user_id: 100 + (i % 9), device: devices[k], browser: browsers[k],
                    location: cities[k], timestamp: new Date(Date.now() - i * 3600000) });
    }
    await col.insertMany(visits);

    show("Most visited pages", await col.aggregate([
      { $group: { _id: "$page", visits: { $sum: 1 }, unique_users: { $addToSet: "$user_id" } } },
      { $project: { visits: 1, unique_users: { $size: "$unique_users" } } },
      { $sort: { visits: -1 } },
    ]).toArray());
    show("Commonly used devices", await col.aggregate([
      { $group: { _id: "$device", count: { $sum: 1 } } }, { $sort: { count: -1 } },
    ]).toArray());
    show("Browser usage", await col.aggregate([
      { $group: { _id: "$browser", count: { $sum: 1 } } }, { $sort: { count: -1 } },
    ]).toArray());
    show("Visits per location", await col.aggregate([
      { $group: { _id: "$location", count: { $sum: 1 } } }, { $sort: { count: -1 } },
    ]).toArray());
  });
}

// ============================================================
// 7
// ============================================================
async function q7() {
  await withDb(async (db) => {
    const col = db.collection("articles");
    await col.deleteMany({});
    await col.insertMany([
      { title: "NoSQL Basics", author: "Aarav", category: "Technology", tags: ["nosql", "db"], status: "published", published_on: new Date("2026-01-15") },
      { title: "Cloud Trends", author: "Riya", category: "Technology", tags: ["cloud"], status: "published", published_on: new Date("2026-02-10") },
      { title: "Healthy Living", author: "Neha", category: "Lifestyle", tags: ["health"], status: "draft", published_on: null },
      { title: "Stock Market 101", author: "Karan", category: "Finance", tags: ["stocks", "beginner"], status: "published", published_on: new Date("2026-03-05") },
      { title: "AI in Education", author: "Aarav", category: "Technology", tags: ["ai", "education"], status: "draft", published_on: null },
      { title: "Travel Guide", author: "Neha", category: "Lifestyle", tags: ["travel"], status: "archived", published_on: new Date("2025-11-01") },
    ]);
    const proj = { projection: { title: 1, _id: 0 } };

    show("All published", await col.find({ status: "published" }, proj).toArray());
    show("All unpublished (draft)", await col.find({ status: "draft" }, proj).toArray());
    show("Not published (any other status)", await col.find({ status: { $ne: "published" } }, proj).toArray());
    show("Published Technology articles", await col.find({ status: "published", category: "Technology" }, proj).toArray());
    show("Drafts by Aarav", await col.find({ status: "draft", author: "Aarav" }, proj).toArray());
    show("Published after 2026-02-01", await col.find({ status: "published", published_on: { $gt: new Date("2026-02-01") } }, proj).toArray());
    show("Articles per status", await col.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]).toArray());
  });
}

// ============================================================
// 8
// ============================================================
async function q8() {
  await withDb(async (db) => {
    const carts = db.collection("carts");
    await carts.deleteMany({});
    const user = "aarav";

    async function addProduct(p) {
      const r = await carts.updateOne({ user, "items.product_id": p.product_id },
                                      { $inc: { "items.$.quantity": p.quantity } });
      if (r.matchedCount === 0)
        await carts.updateOne({ user }, { $push: { items: p }, $setOnInsert: { created: new Date() } }, { upsert: true });
    }

    await addProduct({ product_id: 1, name: "Laptop", price: 50000, quantity: 1 });   // add
    await addProduct({ product_id: 2, name: "Mouse", price: 500, quantity: 2 });
    await addProduct({ product_id: 3, name: "Keyboard", price: 1500, quantity: 1 });
    await addProduct({ product_id: 2, name: "Mouse", price: 500, quantity: 1 });      // existing: quantity increases
    show("After adding", await carts.findOne({ user }));

    await carts.updateOne({ user, "items.product_id": 3 }, { $set: { "items.$.quantity": 4 } });   // change quantity
    show("After changing keyboard quantity", (await carts.findOne({ user })).items);

    await carts.updateOne({ user }, { $pull: { items: { product_id: 1 } } });          // remove product
    show("After removing laptop", (await carts.findOne({ user })).items);

    show("Cart value", await carts.aggregate([
      { $match: { user } },
      { $unwind: "$items" },
      { $group: { _id: "$user", cart_value: { $sum: { $multiply: ["$items.price", "$items.quantity"] } },
                  total_items: { $sum: "$items.quantity" } } },
    ]).toArray());
  });
}

// ============================================================
// 9
// ============================================================
async function q9() {
  await withDb(async (db) => {
    const col = db.collection("reviews");
    await col.deleteMany({});
    const r = (product_id, customer, rating, comment) => ({ product_id, product_name: `Product-${product_id}`, customer, rating, comment, date: new Date() });
    await col.insertMany([
      r(1, "Aarav", 5, "Excellent"), r(1, "Riya", 4, "Good"), r(1, "Karan", 4, "Value for money"),
      r(2, "Neha", 3, "Average"), r(2, "Aarav", 2, "Poor battery"),
      r(3, "Riya", 5, "Loved it"), r(3, "Karan", 5, "Perfect"), r(3, "Neha", 4, "Nice"), r(3, "Rohan", 5, "Best"),
    ]);

    show("Average rating and review count per product", await col.aggregate([
      { $group: { _id: "$product_id", product: { $first: "$product_name" },
                  avg_rating: { $avg: "$rating" }, reviews: { $sum: 1 } } },
      { $project: { product: 1, reviews: 1, avg_rating: { $round: ["$avg_rating", 2] } } },
      { $sort: { avg_rating: -1 } },
    ]).toArray());
    show("Products rated above 4", await col.aggregate([
      { $group: { _id: "$product_id", avg_rating: { $avg: "$rating" } } },
      { $match: { avg_rating: { $gt: 4 } } },
    ]).toArray());
  });
}

// ============================================================
// 10
// ============================================================
async function q10() {
  await withDb(async (db) => {
    const col = db.collection("inventory");
    await col.deleteMany({});
    await col.insertMany([
      { product: "Laptop",   stock: 4,   min_stock: 10, supplier: "TechSupply",  restock_date: new Date("2026-03-10") },
      { product: "Mouse",    stock: 120, min_stock: 50, supplier: "GadgetHub",   restock_date: new Date("2026-04-01") },
      { product: "Keyboard", stock: 15,  min_stock: 15, supplier: "GadgetHub",   restock_date: new Date("2026-03-20") },
      { product: "Monitor",  stock: 2,   min_stock: 8,  supplier: "ScreenWorld", restock_date: new Date("2026-03-05") },
      { product: "Webcam",   stock: 40,  min_stock: 20, supplier: "TechSupply",  restock_date: new Date("2026-05-01") },
    ]);

    show("Needs immediate restocking (stock <= min_stock)", await col.find({ $expr: { $lte: ["$stock", "$min_stock"] } }).toArray());
    show("Shortage and supplier", await col.aggregate([
      { $match: { $expr: { $lte: ["$stock", "$min_stock"] } } },
      { $project: { _id: 0, product: 1, supplier: 1, shortage: { $subtract: ["$min_stock", "$stock"] } } },
      { $sort: { shortage: -1 } },
    ]).toArray());
    show("Critical (stock less than half of minimum)", await col.find(
      { $expr: { $lt: ["$stock", { $multiply: ["$min_stock", 0.5] }] } }, { projection: { product: 1, _id: 0 } }).toArray());
    show("Restocking items per supplier", await col.aggregate([
      { $match: { $expr: { $lte: ["$stock", "$min_stock"] } } },
      { $group: { _id: "$supplier", products: { $push: "$product" } } },
    ]).toArray());
  });
}

// ============================================================
// 11  (requires replica set: mongod --replSet rs0)
// ============================================================
async function q11() {
  await withDb(async (db, client) => {
    const wallets = db.collection("wallets");
    await wallets.deleteMany({});
    await wallets.insertMany([{ _id: "alice", balance: 1000 }, { _id: "bob", balance: 500 }]);

    async function transfer(from, to, amount) {
      const session = client.startSession();
      try {
        await session.withTransaction(async () => {
          const debit = await wallets.updateOne(
            { _id: from, balance: { $gte: amount } }, { $inc: { balance: -amount } }, { session });
          if (debit.modifiedCount === 0) throw new Error("Insufficient balance");
          await wallets.updateOne({ _id: to }, { $inc: { balance: amount } }, { session });
        });
        console.log(`Transferred ${amount} from ${from} to ${to}`);
      } catch (e) {
        console.log(`Transfer failed and rolled back: ${e.message}`);
      } finally { await session.endSession(); }
    }

    await transfer("alice", "bob", 300);      // succeeds
    show("Balances after success", await wallets.find().toArray());
    await transfer("alice", "bob", 5000);     // fails, nothing changes
    show("Balances after failed transfer", await wallets.find().toArray());
  });
}

// ============================================================
// 12
// ============================================================
async function q12() {
  await withDb(async (db) => {
    const col = db.collection("notifications");
    await col.deleteMany({});
    const n = (user_id, type, text, read = false) => ({ user_id, type, text, read, created: new Date() });
    await col.insertMany([
      n(1, "message", "New message from Riya"), n(1, "order", "Your order has shipped"),
      n(1, "system", "Password expires in 5 days", true), n(2, "message", "You have a new follower"),
      n(2, "order", "Order delivered", true), n(1, "system", "Maintenance tonight"),
    ]);

    show("Unread for user 1", await col.find({ user_id: 1, read: false }, { projection: { type: 1, text: 1 } }).toArray());
    show("Unread count per type", await col.aggregate([
      { $match: { user_id: 1, read: false } }, { $group: { _id: "$type", count: { $sum: 1 } } },
    ]).toArray());

    // user views the notifications -> mark them read
    const r = await col.updateMany({ user_id: 1, read: false }, { $set: { read: true, read_at: new Date() } });
    console.log("\nMarked as read:", r.modifiedCount);
    show("Unread for user 1 after viewing", await col.find({ user_id: 1, read: false }).toArray());
  });
}

// ============================================================
// 13
// ============================================================
async function q13() {
  await withDb(async (db) => {
    const courses = db.collection("courses"), students = db.collection("lp_students"), enroll = db.collection("enrollments");
    await Promise.all([courses.deleteMany({}), students.deleteMany({}), enroll.deleteMany({})]);

    await courses.insertMany([
      { _id: "C1", title: "NoSQL Databases", instructor: { name: "Dr. Mehta", email: "mehta@uni.edu" }, modules: ["Intro", "MongoDB", "Cassandra", "Neo4j"] },
      { _id: "C2", title: "Machine Learning", instructor: { name: "Dr. Rao", email: "rao@uni.edu" }, modules: ["Basics", "Regression", "Trees", "Neural Nets", "Project"] },
    ]);
    await students.insertMany([
      { _id: 1, name: "Aarav" }, { _id: 2, name: "Riya" }, { _id: 3, name: "Karan" }, { _id: 4, name: "Neha" },
    ]);
    const total = { C1: 4, C2: 5 };
    const e = (student_id, course_id, done) => ({
      student_id, course_id, completed_modules: done, progress: Math.round((done.length / total[course_id]) * 100),
      status: done.length === total[course_id] ? "completed" : done.length === 0 ? "not started" : "in progress" });
    await enroll.insertMany([
      e(1, "C1", ["Intro", "MongoDB", "Cassandra", "Neo4j"]), e(2, "C1", ["Intro", "MongoDB"]),
      e(3, "C1", []), e(1, "C2", ["Basics", "Regression", "Trees"]), e(4, "C2", ["Basics"]),
    ]);

    const withNames = (match) => enroll.aggregate([
      { $match: match },
      { $lookup: { from: "lp_students", localField: "student_id", foreignField: "_id", as: "s" } },
      { $lookup: { from: "courses", localField: "course_id", foreignField: "_id", as: "c" } },
      { $project: { _id: 0, student: { $arrayElemAt: ["$s.name", 0] }, course: { $arrayElemAt: ["$c.title", 0] }, progress: 1, status: 1 } },
    ]).toArray();

    show("Completed students", await withNames({ status: "completed" }));
    show("Progress below 50%", await withNames({ progress: { $lt: 50 } }));
    show("In NoSQL course with progress >= 50%", await withNames({ course_id: "C1", progress: { $gte: 50 } }));
    show("Not started", await withNames({ status: "not started" }));
    show("Average progress per course", await enroll.aggregate([{ $group: { _id: "$course_id", avg_progress: { $avg: "$progress" } } }]).toArray());
  });
}

// ============================================================
// 14
// ============================================================
async function q14() {
  await withDb(async (db) => {
    const col = db.collection("tracked_orders");
    await col.deleteMany({});
    await col.insertOne({ order_id: "ORD-1", customer: "Aarav", status: "Placed",
      status_history: [{ status: "Placed", at: new Date() }] });

    async function moveTo(order_id, status) {
      await col.updateOne({ order_id }, { $set: { status }, $push: { status_history: { status, at: new Date() } } });
    }
    for (const s of ["Confirmed", "Shipped", "Delivered"]) await moveTo("ORD-1", s);

    show("Current status", await col.findOne({ order_id: "ORD-1" }, { projection: { _id: 0, order_id: 1, status: 1 } }));
    show("Complete status history", (await col.findOne({ order_id: "ORD-1" })).status_history);
    show("Latest status from history", await col.aggregate([
      { $match: { order_id: "ORD-1" } },
      { $project: { _id: 0, order_id: 1, latest: { $last: "$status_history" } } },
    ]).toArray());
    show("Orders currently Delivered", await col.find({ status: "Delivered" }, { projection: { order_id: 1, _id: 0 } }).toArray());
  });
}

// ============================================================
// 15
// ============================================================
async function q15() {
  await withDb(async (db) => {
    const col = db.collection("news");
    await col.deleteMany({});
    await col.insertMany([
      { headline: "Floods hit coastal region", body: "Heavy rain caused floods across the coast.", author: "Riya Das",
        location: { city: "Chennai", country: "India" }, category: "Weather", tags: ["flood", "rain"], images: ["f1.jpg", "f2.jpg"] },
      { headline: "Tech giant launches new chip", body: "A new processor promises faster AI workloads.", category: "Technology",
        tags: ["chip", "ai"], sources: ["Reuters", "TechDaily"] },
      { headline: "Local team wins championship", body: "The final went to extra time.", author: "Karan Singh",
        location: "Mumbai", category: "Sports" },
      { headline: "Budget announced", body: "Government presents annual budget with new tax slabs.", category: "Politics",
        author: "Neha Gupta", sources: ["PTI"], location: { city: "Delhi", country: "India" } },
      { headline: "AI reshapes classrooms", body: "Schools adopt AI tools for learning.", tags: ["ai", "education"] },
    ]);
    await col.createIndex({ headline: "text", body: "text" });
    const proj = { projection: { headline: 1, _id: 0 } };

    show("Articles with an author", await col.find({ author: { $exists: true } }, proj).toArray());
    show("Articles missing a category", await col.find({ category: { $exists: false } }, proj).toArray());
    show("Tagged ai (only docs that have tags)", await col.find({ tags: "ai" }, proj).toArray());
    show("Location is Delhi (string or nested city)", await col.find(
      { $or: [{ location: "Delhi" }, { "location.city": "Delhi" }] }, proj).toArray());
    show("Location is Mumbai (string or nested city)", await col.find(
      { $or: [{ location: "Mumbai" }, { "location.city": "Mumbai" }] }, proj).toArray());
    show("Has images or sources", await col.find(
      { $or: [{ images: { $exists: true } }, { sources: { $exists: true } }] }, proj).toArray());
    show("Cited by Reuters", await col.find({ sources: "Reuters" }, proj).toArray());
    show("Full-text search 'AI'", await col.find({ $text: { $search: "AI" } }, proj).toArray());
    show("Field count variation", await col.aggregate([
      { $project: { _id: 0, headline: 1, fields: { $size: { $objectToArray: "$$ROOT" } } } },
    ]).toArray());
  });
}

// ---------- runner ----------
const questions = { 1: q1, 2: q2, 3: q3, 4: q4, 5: q5, 6: q6, 7: q7, 8: q8, 9: q9, 10: q10, 11: q11, 12: q12, 13: q13, 14: q14, 15: q15 };

(async () => {
  const arg = process.argv[2];
  const list = arg ? [arg] : Object.keys(questions);
  for (const n of list) {
    if (!questions[n]) { console.log("No such question:", n); continue; }
    console.log(`\n----- Question ${n} -----`);
    try { await questions[n](); }
    catch (e) { console.error(`Question ${n} failed:`, e.message); }
  }
})();
