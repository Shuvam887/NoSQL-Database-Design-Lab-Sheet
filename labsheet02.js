/* ======================= Labsheet-02 =======================

   Install drivers : npm install mongodb mysql2 redis cassandra-driver neo4j-driver
   Run one question: node labsheet02.js 3
   Run all         : node labsheet02.js
   ============================================================ */

const { execSync } = require("child_process");

// ---------- connection settings (change as needed) ----------
const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017";
const MYSQL_CFG = { host: "127.0.0.1", user: "root", password: "root" };
const REDIS_URL = "redis://127.0.0.1:6379";
const CASS_CFG = { contactPoints: ["127.0.0.1"], localDataCenter: "datacenter1" };
const NEO_CFG = { url: "bolt://127.0.0.1:7687", user: "neo4j", pass: "password" };

// ---------- shared student dataset ----------
const students = [
  { Student_ID: 1, Name: "Aarav Sharma", Course: "BCA", Semester: 3, Marks: 82 },
  { Student_ID: 2, Name: "Riya Verma",   Course: "MCA", Semester: 1, Marks: 91 },
  { Student_ID: 3, Name: "Karan Singh",  Course: "BCA", Semester: 3, Marks: 67 },
  { Student_ID: 4, Name: "Neha Gupta",   Course: "BBA", Semester: 2, Marks: 75 },
  { Student_ID: 5, Name: "Rohan Mehta",  Course: "MCA", Semester: 1, Marks: 88 },
];

async function withMongo(fn) {
  const { MongoClient } = require("mongodb");
  const client = new MongoClient(MONGO_URI);
  await client.connect();
  try { return await fn(client); } finally { await client.close(); }
}

// ============================================================
// 1
// ============================================================
async function q1() {
  const mysql = require("mysql2/promise");
  const conn = await mysql.createConnection(MYSQL_CFG);
  await conn.query("CREATE DATABASE IF NOT EXISTS CollegeDB");
  await conn.query("USE CollegeDB");
  await conn.query("DROP TABLE IF EXISTS Student");
  await conn.query(`CREATE TABLE Student (
    Student_ID INT PRIMARY KEY,
    Name VARCHAR(50) NOT NULL,
    Course VARCHAR(20),
    Semester INT,
    Marks INT)`);
  for (const s of students) {
    await conn.query("INSERT INTO Student VALUES (?,?,?,?,?)",
      [s.Student_ID, s.Name, s.Course, s.Semester, s.Marks]);
  }
  const [rows] = await conn.query("SELECT * FROM Student");
  console.log("MySQL rows:"); console.table(rows);
  await conn.end();

  await withMongo(async (client) => {
    const col = client.db("CollegeDB").collection("Students");
    await col.deleteMany({});
    await col.insertMany(students);
    console.log("MongoDB documents:");
    console.log(await col.find({}, { projection: { _id: 0 } }).toArray());
  });

  console.table([
    { Aspect: "Schema",       MySQL: "Fixed, defined before inserting data", MongoDB: "Flexible, each document can differ" },
    { Aspect: "Data storage", MySQL: "Rows in tables",                       MongoDB: "BSON documents in collections" },
    { Aspect: "Flexibility",  MySQL: "ALTER TABLE needed for changes",       MongoDB: "Add new fields any time" },
    { Aspect: "Scalability",  MySQL: "Mostly vertical (scale-up)",           MongoDB: "Horizontal (sharding) built in" },
  ]);
}

// ============================================================
// 2
// ============================================================
async function q2() {
  await withMongo(async (client) => {
    const col = client.db("CollegeDB").collection("Students");
    await col.deleteMany({});
    await col.insertMany(students);

    console.log("All documents:", await col.find().toArray());
    console.log("Course = BCA:", await col.find({ Course: "BCA" }).toArray());

    await col.updateOne({ Student_ID: 3 }, { $set: { Marks: 72 } });
    console.log("After update:", await col.findOne({ Student_ID: 3 }));

    await col.deleteOne({ Student_ID: 4 });
    console.log("Total students:", await col.countDocuments());
  });
}

// ============================================================
// 3
// ============================================================
async function q3() {
  await withMongo(async (client) => {
    const orders = client.db("ShopDB").collection("Orders");
    await orders.deleteMany({});
    await orders.insertMany([
      { order_id: 1, customer: { name: "Aarav", city: "Delhi",  email: "aarav@mail.com" },
        products: [{ name: "Laptop", price: 50000, quantity: 1 }, { name: "Mouse", price: 500, quantity: 2 }] },
      { order_id: 2, customer: { name: "Riya",  city: "Mumbai", email: "riya@mail.com" },
        products: [{ name: "Phone", price: 20000, quantity: 1 }] },
      { order_id: 3, customer: { name: "Karan", city: "Pune",   email: "karan@mail.com" },
        products: [{ name: "Keyboard", price: 1500, quantity: 3 }, { name: "Monitor", price: 9000, quantity: 1 }] },
      { order_id: 4, customer: { name: "Aarav", city: "Delhi",  email: "aarav@mail.com" },
        products: [{ name: "Headphones", price: 2500, quantity: 2 }] },
      { order_id: 5, customer: { name: "Neha",  city: "Jaipur", email: "neha@mail.com" },
        products: [{ name: "Tablet", price: 30000, quantity: 1 }, { name: "Cover", price: 800, quantity: 1 }] },
    ]);

    console.log("Orders of Aarav:", JSON.stringify(await orders.find({ "customer.name": "Aarav" }).toArray(), null, 2));

    await orders.updateOne(
      { order_id: 1, "products.name": "Mouse" },
      { $set: { "products.$.quantity": 4 } });

    console.log("Order totals:",
      await orders.aggregate([
        { $unwind: "$products" },
        { $group: { _id: "$order_id", total: { $sum: { $multiply: ["$products.price", "$products.quantity"] } } } },
        { $sort: { _id: 1 } },
      ]).toArray());

    const limit = 20000;
    console.log(`Orders above ${limit}:`,
      await orders.aggregate([
        { $addFields: { total: { $sum: { $map: { input: "$products", as: "p",
            in: { $multiply: ["$$p.price", "$$p.quantity"] } } } } } },
        { $match: { total: { $gt: limit } } },
      ]).toArray());
  });
}

// ============================================================
// 4
// ============================================================
async function q4() {
  const { createClient } = require("redis");
  const r = createClient({ url: REDIS_URL });
  await r.connect();

  for (const s of students) await r.set(`student:${s.Student_ID}`, s.Name);   // 1 & 2
  console.log("Get student:1 ->", await r.get("student:1"));                  // 3
  await r.set("student:1", "Aarav K. Sharma");                                // 4
  console.log("After update  ->", await r.get("student:1"));
  await r.del("student:5");                                                   // 5
  console.log("All keys      ->", await r.keys("student:*"));                 // 6

  await r.quit();
}

// ============================================================
// 5
// ============================================================
async function q5() {
  const cassandra = require("cassandra-driver");
  const c = new cassandra.Client(CASS_CFG);
  await c.connect();

  await c.execute(`CREATE KEYSPACE IF NOT EXISTS CollegeDB
    WITH replication = {'class':'SimpleStrategy','replication_factor':1}`);
  await c.execute(`CREATE TABLE IF NOT EXISTS CollegeDB.Students (
    Course text, Student_ID int, Name text, Semester int, Marks int,
    PRIMARY KEY ((Course), Student_ID))`);

  for (const s of students) {
    await c.execute(
      "INSERT INTO CollegeDB.Students (Student_ID, Name, Course, Semester, Marks) VALUES (?,?,?,?,?)",
      [s.Student_ID, s.Name, s.Course, s.Semester, s.Marks], { prepare: true });
  }
  console.log("All:", (await c.execute("SELECT * FROM CollegeDB.Students")).rows);
  console.log("MCA:", (await c.execute("SELECT * FROM CollegeDB.Students WHERE Course='MCA'")).rows);
  await c.execute("UPDATE CollegeDB.Students SET Marks=95 WHERE Course='MCA' AND Student_ID=2");
  await c.execute("DELETE FROM CollegeDB.Students WHERE Course='BBA' AND Student_ID=4");
  console.log("After update/delete:", (await c.execute("SELECT * FROM CollegeDB.Students")).rows);

  await c.shutdown();
}

// ============================================================
// 6   (HBase has no official Node driver, so the HBase shell is driven from JS)
// ============================================================
async function q6() {
  const cmds = [
    "disable 'Students'", "drop 'Students'",
    "create 'Students', 'personal', 'academic'",
    ...students.flatMap((s) => [
      `put 'Students','${s.Student_ID}','personal:name','${s.Name}'`,
      `put 'Students','${s.Student_ID}','academic:course','${s.Course}'`,
      `put 'Students','${s.Student_ID}','academic:semester','${s.Semester}'`,
      `put 'Students','${s.Student_ID}','academic:marks','${s.Marks}'`,
    ]),
    "get 'Students','1'",
    "put 'Students','1','academic:marks','90'",
    "scan 'Students'",
    "deleteall 'Students','5'",
    "scan 'Students'",
    "exit",
  ];
  console.log(execSync("hbase shell -n", { input: cmds.join("\n") }).toString());
}

// ============================================================
// 7
// ============================================================
async function q7() {
  const neo4j = require("neo4j-driver");
  const driver = neo4j.driver(NEO_CFG.url, neo4j.auth.basic(NEO_CFG.user, NEO_CFG.pass));
  const s = driver.session();
  const run = async (q, p) => (await s.run(q, p)).records;

  await run("MATCH (n) DETACH DELETE n");
  for (const st of students)
    await run("CREATE (:Student {id:$id, name:$name, semester:$sem, marks:$marks})",
      { id: st.Student_ID, name: st.Name, sem: st.Semester, marks: st.Marks });
  for (const c of ["BCA", "MCA", "BBA"]) await run("CREATE (:Course {name:$c})", { c });
  for (const st of students)
    await run(`MATCH (s:Student {id:$id}), (c:Course {name:$c})
               CREATE (s)-[:ENROLLED_IN]->(c)`, { id: st.Student_ID, c: st.Course });

  console.log("Students:", (await run("MATCH (s:Student) RETURN s.name AS name")).map(r => r.get("name")));
  console.log("In MCA:", (await run("MATCH (s:Student)-[:ENROLLED_IN]->(:Course {name:'MCA'}) RETURN s.name AS name")).map(r => r.get("name")));
  console.log("Courses of Aarav:", (await run("MATCH (:Student {name:'Aarav Sharma'})-[:ENROLLED_IN]->(c) RETURN c.name AS name")).map(r => r.get("name")));

  await run(`MATCH (s:Student {name:'Aarav Sharma'}), (c:Course {name:'MCA'})
             CREATE (s)-[:ENROLLED_IN]->(c)`);                       // add relationship
  await run(`MATCH (:Student {name:'Aarav Sharma'})-[r:ENROLLED_IN]->(:Course {name:'MCA'})
             DELETE r`);                                              // remove relationship

  await s.close(); await driver.close();
}

// ============================================================
// 8
// ============================================================
async function q8() {
  // MongoDB
  await withMongo(async (client) => {
    const col = client.db("CollegeDB").collection("Students");
    await col.deleteMany({});
    await col.insertMany(students.map((s) => ({ ...s })));
    console.log("MongoDB count:", await col.countDocuments());
  });

  // Cassandra
  const cassandra = require("cassandra-driver");
  const c = new cassandra.Client(CASS_CFG);
  await c.connect();
  await c.execute(`CREATE KEYSPACE IF NOT EXISTS CollegeDB
    WITH replication = {'class':'SimpleStrategy','replication_factor':1}`);
  await c.execute(`CREATE TABLE IF NOT EXISTS CollegeDB.Students (
    Course text, Student_ID int, Name text, Semester int, Marks int,
    PRIMARY KEY ((Course), Student_ID))`);
  for (const s of students)
    await c.execute("INSERT INTO CollegeDB.Students (Student_ID,Name,Course,Semester,Marks) VALUES (?,?,?,?,?)",
      [s.Student_ID, s.Name, s.Course, s.Semester, s.Marks], { prepare: true });
  console.log("Cassandra count:", (await c.execute("SELECT count(*) FROM CollegeDB.Students")).rows[0].count.toString());
  await c.shutdown();

  // Neo4j
  const neo4j = require("neo4j-driver");
  const driver = neo4j.driver(NEO_CFG.url, neo4j.auth.basic(NEO_CFG.user, NEO_CFG.pass));
  const s = driver.session();
  await s.run("MATCH (n) DETACH DELETE n");
  for (const st of students)
    await s.run(`MERGE (c:Course {name:$c})
                 CREATE (:Student {id:$id, name:$n, semester:$sem, marks:$m})-[:ENROLLED_IN]->(c)`,
      { c: st.Course, id: st.Student_ID, n: st.Name, sem: st.Semester, m: st.Marks });
  console.log("Neo4j students:", (await s.run("MATCH (s:Student) RETURN count(s) AS n")).records[0].get("n").toString());
  await s.close(); await driver.close();

  console.table([
    { Feature: "Data model",    MongoDB: "Document (JSON/BSON)",      Cassandra: "Wide-column",                   Neo4j: "Graph (nodes + relationships)" },
    { Feature: "Storage",       MongoDB: "Collections of documents",  Cassandra: "Partitions of rows (SSTables)", Neo4j: "Node/relationship records with pointers" },
    { Feature: "Query method",  MongoDB: "MQL / aggregation",         Cassandra: "CQL (query-first design)",      Neo4j: "Cypher pattern matching" },
    { Feature: "Scalability",   MongoDB: "Sharding + replica sets",   Cassandra: "Linear, masterless ring",       Neo4j: "Mainly vertical; read replicas / fabric" },
    { Feature: "Applications",  MongoDB: "CMS, catalogs, apps",       Cassandra: "IoT, logs, time-series",        Neo4j: "Social networks, recommendations, fraud" },
  ]);
}

// ============================================================
// 9
// ============================================================
async function q9() {
  /* Install (Ubuntu):  sudo apt-get install -y mongodb-org
     Start server    :  sudo systemctl start mongod
     (or)            :  mongod --dbpath ./data --port 27017            */
  await withMongo(async (client) => {
    console.log("Server ping:", await client.db("admin").command({ ping: 1 }));
    const col = client.db("SingleServerDB").collection("Students");
    await col.deleteMany({});
    await col.insertMany(students);                                          // Create
    console.log("Read:", await col.find({ Course: "MCA" }).toArray());       // Read
    await col.updateOne({ Student_ID: 1 }, { $set: { Marks: 90 } });         // Update
    await col.deleteOne({ Student_ID: 5 });                                  // Delete
    console.log("Final count:", await col.countDocuments());                 // Verify
    console.log("Server version:", (await client.db("admin").command({ buildInfo: 1 })).version);
  });
}

// ============================================================
// 10
// ============================================================
async function q10() {
  /* Prerequisite: a sharded cluster (mongos on 27017 with two shards), e.g.
       mongosh --port 27017
       sh.addShard("shard1/localhost:27101")
       sh.addShard("shard2/localhost:27102")                              */
  await withMongo(async (client) => {
    const admin = client.db("admin");
    const db = client.db("ShardDB");
    const col = db.collection("Students");
    await col.deleteMany({});

    const data = Array.from({ length: 25 }, (_, i) => ({
      Student_ID: i + 1, Name: `Student${i + 1}`,
      Course: ["BCA", "MCA", "BBA"][i % 3], Semester: (i % 6) + 1, Marks: 50 + ((i * 7) % 50),
    }));
    await col.insertMany(data);

    await admin.command({ enableSharding: "ShardDB" });
    await col.createIndex({ Student_ID: "hashed" });
    await admin.command({ shardCollection: "ShardDB.Students", key: { Student_ID: "hashed" } });

    const stats = await db.command({ collStats: "Students" });
    for (const [shard, s] of Object.entries(stats.shards || {}))
      console.log(`${shard}: ${s.count} documents`);

    console.log(`Benefit: sharding splits data across servers, so storage and read/write load
scale horizontally and no single machine becomes a bottleneck.`);
  });
}

// ============================================================
// 11
// ============================================================
async function q11() {
  /* Start two mongod instances:
       mongod --replSet rs0 --port 27017 --dbpath ./p
       mongod --replSet rs0 --port 27018 --dbpath ./s                     */
  const { MongoClient } = require("mongodb");
  const primary = new MongoClient("mongodb://127.0.0.1:27017/?directConnection=true");
  await primary.connect();
  try {
    await primary.db("admin").command({
      replSetInitiate: { _id: "rs0", members: [
        { _id: 0, host: "127.0.0.1:27017", priority: 2 },
        { _id: 1, host: "127.0.0.1:27018" } ] } });
  } catch (e) { console.log("Replica set already initiated:", e.codeName); }
  await new Promise((r) => setTimeout(r, 8000));                    // wait for election

  const col = primary.db("ReplDB").collection("Students");
  await col.deleteMany({});
  await col.insertMany(students, { writeConcern: { w: "majority" } });

  const secondary = new MongoClient("mongodb://127.0.0.1:27018/?directConnection=true", { readPreference: "secondaryPreferred" });
  await secondary.connect();
  console.log("Docs on secondary:", await secondary.db("ReplDB").collection("Students").countDocuments());

  const st = await primary.db("admin").command({ replSetGetStatus: 1 });
  st.members.forEach((m) => console.log(m.name, m.stateStr));

  console.log(`If the primary fails, the secondaries detect missing heartbeats and hold an election;
one secondary becomes the new primary and the app continues writing to it. The old primary
rejoins as a secondary after recovery.`);
  await secondary.close(); await primary.close();
}

// ============================================================
// 12
// ============================================================
async function q12() {
  /* Start 3 nodes (e.g. docker run --name cass1 -d cassandra,
     then cass2 / cass3 with CASSANDRA_SEEDS=cass1) and check: nodetool status */
  const cassandra = require("cassandra-driver");
  const c = new cassandra.Client({ contactPoints: ["127.0.0.1"], localDataCenter: "datacenter1" });
  await c.connect();

  await c.execute(`CREATE KEYSPACE IF NOT EXISTS P2PDB
    WITH replication = {'class':'NetworkTopologyStrategy','datacenter1':3}`);
  await c.execute("CREATE TABLE IF NOT EXISTS P2PDB.Students (Student_ID int PRIMARY KEY, Name text, Course text, Marks int)");
  for (const s of students)
    await c.execute("INSERT INTO P2PDB.Students (Student_ID,Name,Course,Marks) VALUES (?,?,?,?)",
      [s.Student_ID, s.Name, s.Course, s.Marks], { prepare: true, consistency: cassandra.types.consistencies.quorum });

  // verify: read through each node as the coordinator
  for (const host of c.hosts.keys()) {
    const one = new cassandra.Client({ contactPoints: [host.split(":")[0]], localDataCenter: "datacenter1" });
    await one.connect();
    const n = (await one.execute("SELECT count(*) FROM P2PDB.Students")).rows[0].count;
    console.log(`Node ${host} sees ${n} rows`);
    await one.shutdown();
  }
  try { console.log(execSync("docker exec cass1 nodetool status").toString()); } catch (_) {}

  console.log(`Peer-to-peer: every node is equal, any node accepts reads and writes and data is
replicated by the ring, so there is no single point of failure. Master-slave has one primary that
handles all writes; if it fails, a failover election is required.`);
  await c.shutdown();
}

// ============================================================
// 13
// ============================================================
async function q13() {
  /* Cluster layout (each shard is a 3-member replica set):
       config servers : cfg replica set   (port 27019)
       shard1 (rs1)   : 27101, 27102, 27103
       shard2 (rs2)   : 27201, 27202, 27203
       mongos         : 27017 --configdb cfg/localhost:27019            */
  const { MongoClient } = require("mongodb");
  const client = new MongoClient("mongodb://127.0.0.1:27017");
  await client.connect();
  const admin = client.db("admin");

  await admin.command({ addShard: "rs1/127.0.0.1:27101,127.0.0.1:27102,127.0.0.1:27103" });
  await admin.command({ addShard: "rs2/127.0.0.1:27201,127.0.0.1:27202,127.0.0.1:27203" });

  const db = client.db("ShardReplDB");
  const col = db.collection("Students");
  await col.deleteMany({});
  await col.insertMany(Array.from({ length: 30 }, (_, i) => ({
    Student_ID: i + 1, Name: `Student${i + 1}`, Course: ["BCA", "MCA", "BBA"][i % 3], Marks: 40 + ((i * 11) % 60),
  })));
  await admin.command({ enableSharding: "ShardReplDB" });
  await col.createIndex({ Student_ID: "hashed" });
  await admin.command({ shardCollection: "ShardReplDB.Students", key: { Student_ID: "hashed" } });

  const stats = await db.command({ collStats: "Students" });
  for (const [shard, s] of Object.entries(stats.shards || {}))
    console.log(`Distribution -> ${shard}: ${s.count} docs`);

  for (const port of [27101, 27201]) {                                // replica availability per shard
    const m = new MongoClient(`mongodb://127.0.0.1:${port}/?directConnection=true`);
    await m.connect();
    const st = await m.db("admin").command({ replSetGetStatus: 1 });
    console.log(`Shard set ${st.set}:`, st.members.map((x) => `${x.name}=${x.stateStr}`).join(", "));
    await m.close();
  }

  console.log(`Sharding spreads data over shards (scalability); each shard's replica set keeps copies
and elects a new primary on failure (fault tolerance).`);
  await client.close();
}

// ============================================================
// 14
// ============================================================
async function q14() {
  const data = [
    { Student_ID: 1, Name: "Aarav Sharma", Course: "BCA", Marks: 82 },
    { Student_ID: 2, Name: "Riya Verma",   Course: "MCA", Marks: 91 },
    { Student_ID: 3, Name: "Karan Singh",  Course: "BCA", Marks: 67 },
    { Student_ID: 4, Name: "Neha Gupta",   Course: "BBA", Marks: 75 },
    { Student_ID: 5, Name: "Rohan Mehta",  Course: "MCA", Marks: 88 },
    { Student_ID: 6, Name: "Simran Kaur",  Course: "BBA", Marks: 79 },
  ];

  // MAP: emit (course, {count:1, marks})
  const mapped = data.map((d) => [d.Course, { count: 1, marks: d.Marks }]);
  console.log("MAP output:"); mapped.forEach(([k, v]) => console.log(k, JSON.stringify(v)));

  // SHUFFLE: group values by key
  const grouped = {};
  for (const [k, v] of mapped) (grouped[k] ||= []).push(v);
  console.log("GROUPED:", JSON.stringify(grouped));

  // REDUCE: sum counts and marks, then compute average
  const reduced = Object.entries(grouped).map(([course, vals]) => {
    const total = vals.reduce((a, v) => ({ count: a.count + v.count, marks: a.marks + v.marks }), { count: 0, marks: 0 });
    return { Course: course, Students: total.count, AvgMarks: +(total.marks / total.count).toFixed(2) };
  });
  console.log("REDUCE output:"); console.table(reduced);

  // Same result in MongoDB (aggregation pipeline, the modern replacement for mapReduce):
  //   db.Students.aggregate([{ $group: { _id: "$Course", count: { $sum: 1 }, avgMarks: { $avg: "$Marks" } } }])
}

// ============================================================
// 15
// ============================================================
async function q15() {
  const models = [
    { name: "Single Server",
      arch: "[Client] --> [ Server + DB ]",
      distribution: "All data lives on one machine.",
      failure: "Server failure = downtime; recover from backups.",
      advantage: "Simplest to set up and manage; no consistency issues.",
      limitation: "Single point of failure and limited by one machine's capacity.",
      application: "Small websites, development/testing environments." },
    { name: "Sharding",
      arch: "[Client] --> [Router] --> [Shard1 | Shard2 | Shard3]",
      distribution: "Data is partitioned by a shard key (range or hash); each shard holds a subset.",
      failure: "Only the failed shard's data is unavailable; other shards keep working.",
      advantage: "Horizontal scaling of storage and throughput.",
      limitation: "Complex; a shard loss makes its data unavailable without replicas.",
      application: "Large e-commerce catalogs, big-data analytics." },
    { name: "Master-Slave Replication",
      arch: "[Client] --writes--> [Master] --replicates--> [Slave1] [Slave2] <--reads-- [Client]",
      distribution: "Full copy of data on each node; master takes writes, slaves serve reads.",
      failure: "If master fails, a slave is promoted to master (manual or automatic election).",
      advantage: "High read scalability and data redundancy.",
      limitation: "Master is a write bottleneck; slaves may serve stale data.",
      application: "Read-heavy apps such as reporting and blogs." },
    { name: "Peer-to-Peer Replication",
      arch: "      [Node A]\n     /        \\\n[Node D]      [Node B]\n     \\        /\n      [Node C]   (ring, all nodes equal)",
      distribution: "Data is spread over a ring via consistent hashing and copied to N replicas.",
      failure: "Other nodes serve requests; hinted handoff and repair sync the failed node later.",
      advantage: "No single point of failure; reads and writes on any node.",
      limitation: "Eventual consistency; conflicts must be resolved.",
      application: "Messaging, IoT, always-on services (Cassandra)." },
    { name: "Sharding + Replication",
      arch: "[Client] --> [Router] --> Shard1(P,S,S) | Shard2(P,S,S) | Shard3(P,S,S)",
      distribution: "Data is partitioned across shards, and each shard is replicated.",
      failure: "Within a shard a secondary is elected primary; other shards are unaffected.",
      advantage: "Both scalability and high availability.",
      limitation: "Highest operational complexity and cost.",
      application: "Large-scale production systems like social media and banking." },
  ];
  for (const m of models) {
    console.log("\n" + m.name);
    console.log(m.arch);
    console.log("Data distribution :", m.distribution);
    console.log("Failure handling  :", m.failure);
    console.log("Advantage         :", m.advantage);
    console.log("Limitation        :", m.limitation);
    console.log("Application       :", m.application);
  }
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
