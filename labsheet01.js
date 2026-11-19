/* ============ Problem Statement Lab Sheet-01 ============
   NoSQL Database Design

   Install driver  : npm install mongodb
   Run all in order: node labsheet01.js        (also writes Lab01_Report.md)
   Run one question: node labsheet01.js 9      (data is reset to a fresh sample first)
   Optional        : MONGO_URI=mongodb://127.0.0.1:27017 node labsheet01.js
   ======================================================== */

const fs = require("fs");
const { MongoClient } = require("mongodb");

const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017";
const DB = "StudentDB";
let client;
const db = () => client.db(DB);

// ---------- sample data ----------
const firstStudent = { Roll_No: 101, Name: "Aarav Sharma", Department: "BCA", Semester: 5, CGPA: 8.4 };
const moreStudents = [
  { Roll_No: 102, Name: "Riya Verma",   Department: "MCA", Semester: 3, CGPA: 9.1 },
  { Roll_No: 103, Name: "Karan Singh",  Department: "BCA", Semester: 5, CGPA: 6.7 },
  { Roll_No: 104, Name: "Neha Gupta",   Department: "BBA", Semester: 4, CGPA: 7.5 },
  { Roll_No: 105, Name: "Rohan Mehta",  Department: "MCA", Semester: 3, CGPA: 8.8 },
  { Roll_No: 106, Name: "Simran Kaur",  Department: "BBA", Semester: 2, CGPA: 4.2 },
  { Roll_No: 107, Name: "Aditya Rao",   Department: "BCA", Semester: 5, CGPA: 3.8 },
];
const allStudents = () => [firstStudent, ...moreStudents].map((s) => ({ ...s }));

// ---------- recorder (feeds the lab report in Q25) ----------
const REPORT = [];
async function step(q, command, fn) {
  console.log(`\nmongosh> ${command}`);
  const out = await fn();
  const text = out === undefined ? "(done)" : typeof out === "string" ? out : JSON.stringify(out, null, 2);
  console.log(text);
  REPORT.push({ q, command, output: text });
  return out;
}
const dbNames = async () => (await client.db().admin().listDatabases()).databases.map((d) => d.name);
const colNames = async (name = DB) => (await client.db(name).listCollections().toArray()).map((c) => c.name).sort();
const exists = async (name) => (await colNames()).includes(name);

// reset to a known state so that any single question can be run on its own
async function prepare() {
  await db().dropDatabase();
  await db().collection("Students").insertMany(allStudents());
  await db().createCollection("Faculty");
  await db().createCollection("Courses");
}

// ============================================================
// 1
// ============================================================
async function q1() {
  await step(1, `use ${DB}`, async () => `switched to db ${db().databaseName}`);
  // MongoDB creates a database only when it holds data/collections, so create a collection to materialise it.
  await step(1, `db.createCollection("Students")`, async () => {
    if (!(await exists("Students"))) await db().createCollection("Students");
    return { ok: 1 };
  });
  await step(1, "show dbs   // verify", async () => ({ databases: await dbNames(), found: (await dbNames()).includes(DB) }));
  await step(1, "db.getName()", async () => db().databaseName);
}

// ============================================================
// 2
// ============================================================
async function q2() {
  await step(2, `db.createCollection("Students")`, async () => { if (!(await exists("Students"))) await db().createCollection("Students"); return { ok: 1 }; });
  await step(2, `db.createCollection("Faculty")`, async () => { if (!(await exists("Faculty"))) await db().createCollection("Faculty"); return { ok: 1 }; });
  await step(2, `db.createCollection("Courses")`, async () => { if (!(await exists("Courses"))) await db().createCollection("Courses"); return { ok: 1 }; });
  await step(2, "show collections", async () => await colNames());
}

// ============================================================
// 3
// ============================================================
async function q3() {
  await step(3, `db.Students.insertOne({ Roll_No: 101, Name: "Aarav Sharma", Department: "BCA", Semester: 5, CGPA: 8.4 })`,
    async () => { await db().collection("Students").deleteMany({ Roll_No: 101 }); return await db().collection("Students").insertOne({ ...firstStudent }); });
}

// ============================================================
// 4
// ============================================================
async function q4() {
  await step(4, "db.Students.insertMany([ ...six student documents (Roll_No 102 to 107)... ])", async () => {
    await db().collection("Students").deleteMany({ Roll_No: { $gte: 102, $lte: 107 } });
    const r = await db().collection("Students").insertMany(moreStudents.map((s) => ({ ...s })));
    return { acknowledged: r.acknowledged, insertedCount: r.insertedCount };
  });
}

// ============================================================
// 5
// ============================================================
async function q5() {
  await step(5, "db.Students.find()", async () => await db().collection("Students").find().toArray());
}

// ============================================================
// 6
// ============================================================
async function q6() {
  await step(6, "db.Students.findOne({ Roll_No: 103 })", async () => await db().collection("Students").findOne({ Roll_No: 103 }));
}

// ============================================================
// 7
// ============================================================
async function q7() {
  await step(7, `db.Students.find({ Department: "BCA" })`, async () => await db().collection("Students").find({ Department: "BCA" }).toArray());
  await step(7, `db.Students.find({ Department: "MCA", CGPA: { $gt: 9 } })   // extra condition`,
    async () => await db().collection("Students").find({ Department: "MCA", CGPA: { $gt: 9 } }).toArray());
}

// ============================================================
// 8
// ============================================================
async function q8() {
  await step(8, "db.Students.find({}, { Name: 1, Department: 1, _id: 0 })",
    async () => await db().collection("Students").find({}, { projection: { Name: 1, Department: 1, _id: 0 } }).toArray());
}

// ============================================================
// 9
// ============================================================
async function q9() {
  await step(9, `db.Students.updateOne({ Roll_No: 102 }, { $set: { Department: "BBA" } })`, async () => {
    const r = await db().collection("Students").updateOne({ Roll_No: 102 }, { $set: { Department: "BBA" } });
    return { matchedCount: r.matchedCount, modifiedCount: r.modifiedCount };
  });
  await step(9, "db.Students.findOne({ Roll_No: 102 })   // verify", async () => await db().collection("Students").findOne({ Roll_No: 102 }));
}

// ============================================================
// 10
// ============================================================
async function q10() {
  await step(10, `db.Students.updateMany({ Department: "BCA" }, { $set: { Semester: 6 } })`, async () => {
    const r = await db().collection("Students").updateMany({ Department: "BCA" }, { $set: { Semester: 6 } });
    return { matchedCount: r.matchedCount, modifiedCount: r.modifiedCount };
  });
  await step(10, `db.Students.find({ Department: "BCA" }, { Name: 1, Semester: 1, _id: 0 })   // verify`,
    async () => await db().collection("Students").find({ Department: "BCA" }, { projection: { Name: 1, Semester: 1, _id: 0 } }).toArray());
}

// ============================================================
// 11
// ============================================================
async function q11() {
  await step(11, `db.Students.replaceOne({ Roll_No: 104 }, { Roll_No: 104, Name: "Neha Gupta", Department: "MCA", Semester: 3, CGPA: 8.0 })`, async () => {
    const r = await db().collection("Students").replaceOne({ Roll_No: 104 },
      { Roll_No: 104, Name: "Neha Gupta", Department: "MCA", Semester: 3, CGPA: 8.0 });
    return { matchedCount: r.matchedCount, modifiedCount: r.modifiedCount };
  });
  await step(11, "db.Students.findOne({ Roll_No: 104 })   // verify", async () => await db().collection("Students").findOne({ Roll_No: 104 }));
}

// ============================================================
// 12
// ============================================================
async function q12() {
  await step(12, `db.Students.updateMany({}, [ { $set: { Email: { $concat: [ lowercase name with dots, "@coer.ac.in" ] } } } ])`, async () => {
    const r = await db().collection("Students").updateMany({}, [
      { $set: { Email: { $concat: [{ $toLower: { $replaceAll: { input: "$Name", find: " ", replacement: "." } } }, "@coer.ac.in"] } } },
    ]);
    return { matchedCount: r.matchedCount, modifiedCount: r.modifiedCount };
  });
  await step(12, "db.Students.find({}, { Name: 1, Email: 1, _id: 0 })   // verify",
    async () => await db().collection("Students").find({}, { projection: { Name: 1, Email: 1, _id: 0 } }).toArray());
}

// ============================================================
// 13
// ============================================================
async function q13() {
  await step(13, `db.Students.updateMany({}, { $unset: { Email: "" } })`, async () => {
    const r = await db().collection("Students").updateMany({}, { $unset: { Email: "" } });
    return { matchedCount: r.matchedCount, modifiedCount: r.modifiedCount };
  });
  await step(13, "db.Students.findOne()   // Email is gone", async () => await db().collection("Students").findOne());
}

// ============================================================
// 14
// ============================================================
async function q14() {
  await step(14, "db.Students.deleteOne({ Roll_No: 105 })", async () => {
    const r = await db().collection("Students").deleteOne({ Roll_No: 105 });
    return { deletedCount: r.deletedCount };
  });
  await step(14, "db.Students.find({ Roll_No: 105 })   // verify", async () => await db().collection("Students").find({ Roll_No: 105 }).toArray());
}

// ============================================================
// 15
// ============================================================
async function q15() {
  await step(15, "db.Students.deleteMany({ CGPA: { $lt: 5 } })", async () => {
    const r = await db().collection("Students").deleteMany({ CGPA: { $lt: 5 } });
    return { deletedCount: r.deletedCount };
  });
  await step(15, "db.Students.find({}, { Name: 1, CGPA: 1, _id: 0 })   // remaining students",
    async () => await db().collection("Students").find({}, { projection: { Name: 1, CGPA: 1, _id: 0 } }).toArray());
}

// ============================================================
// 16
// ============================================================
async function q16() {
  await step(16, "db.Students.countDocuments()", async () => await db().collection("Students").countDocuments());
  await step(16, `db.Students.countDocuments({ Department: "BCA" })`, async () => await db().collection("Students").countDocuments({ Department: "BCA" }));
}

// ============================================================
// 17
// ============================================================
async function q17() {
  await step(17, `db.Students.renameCollection("StudentDetails")`, async () => {
    if (await exists("StudentDetails")) await db().collection("StudentDetails").drop();
    await db().collection("Students").rename("StudentDetails");
    return { ok: 1 };
  });
  await step(17, "show collections   // verify", async () => await colNames());
  await step(17, "db.StudentDetails.countDocuments()", async () => await db().collection("StudentDetails").countDocuments());
}

// ============================================================
// 18
// ============================================================
async function q18() {
  await step(18, `db.Departments.insertMany([ { Dept_ID: 1, Name: "BCA", HOD: "Dr. Mehta", Students: 120 }, ... ])`, async () => {
    await db().collection("Departments").deleteMany({});
    const r = await db().collection("Departments").insertMany([
      { Dept_ID: 1, Name: "BCA", HOD: "Dr. Mehta", Students: 120 },
      { Dept_ID: 2, Name: "MCA", HOD: "Dr. Rao", Students: 60 },
      { Dept_ID: 3, Name: "BBA", HOD: "Dr. Kapoor", Students: 90 },
    ]);
    return { insertedCount: r.insertedCount };
  });
  await step(18, "db.Departments.find()", async () => await db().collection("Departments").find().toArray());
}

// ============================================================
// 19
// ============================================================
async function q19() {
  if (!(await exists("Departments"))) await db().collection("Departments").insertOne({ Dept_ID: 1, Name: "BCA" });
  await step(19, "show collections   // before", async () => await colNames());
  await step(19, "db.Departments.drop()", async () => await db().collection("Departments").drop());
  await step(19, "show collections   // after, Departments is gone", async () => ({ collections: await colNames(), departmentsExists: await exists("Departments") }));
}

// ============================================================
// 20
// ============================================================
async function q20() {
  await db().collection("Students").countDocuments();       // make sure the database exists
  await step(20, "show collections   // before", async () => await colNames());
  await step(20, "db.dropDatabase()", async () => await db().dropDatabase());
  await step(20, "show dbs   // verify", async () => ({ databases: await dbNames(), StudentDBexists: (await dbNames()).includes(DB) }));
  await step(20, "db.getCollectionNames()   // empty after drop", async () => await colNames());
}

// ============================================================
// 21
// ============================================================
async function q21() {
  await step(21, `use StudentDB; db.Students.insertMany([ ...sample students... ])`, async () => {
    const r = await db().collection("Students").insertMany(allStudents());
    return { insertedCount: r.insertedCount };
  });
  await step(21, `db.Faculty.insertMany([ ... ])`, async () => {
    const r = await db().collection("Faculty").insertMany([
      { Faculty_ID: "F01", Name: "Dr. Mehta", Department: "BCA", Designation: "Professor" },
      { Faculty_ID: "F02", Name: "Dr. Rao", Department: "MCA", Designation: "Associate Professor" },
      { Faculty_ID: "F03", Name: "Ms. Kapoor", Department: "BBA", Designation: "Assistant Professor" },
    ]);
    return { insertedCount: r.insertedCount };
  });
  await step(21, `db.Courses.insertMany([ ... ])`, async () => {
    const r = await db().collection("Courses").insertMany([
      { Course_ID: "C101", Title: "NoSQL Database Design", Credits: 4 },
      { Course_ID: "C102", Title: "Java Programming", Credits: 4 },
      { Course_ID: "C103", Title: "Computer Networks", Credits: 3 },
    ]);
    return { insertedCount: r.insertedCount };
  });
  await step(21, "show dbs / show collections", async () => ({ databases: await dbNames(), collections: await colNames() }));
}

// ============================================================
// 22
// ============================================================
async function q22() {
  await db().collection("Students").countDocuments();
  console.log(`
Compass is a GUI, so the equivalent steps are listed below. The same filters are then run from code to show
that Compass and the shell return the same results.`);
  console.table([
    { Operation: "Create (insertOne)",  Shell: "db.Students.insertOne({...})",               Compass: "Students > ADD DATA > Insert Document > paste JSON > Insert" },
    { Operation: "Create (insertMany)", Shell: "db.Students.insertMany([...])",              Compass: "ADD DATA > Insert Document > paste a JSON array, or Import File (CSV/JSON)" },
    { Operation: "Read all",            Shell: "db.Students.find()",                         Compass: "Documents tab (empty filter) > Find" },
    { Operation: "Read with filter",    Shell: "db.Students.find({Department:'BCA'})",       Compass: "Filter box: { Department: 'BCA' } > Find" },
    { Operation: "Projection",          Shell: "db.Students.find({}, {Name:1, Department:1})", Compass: "Options > Project: { Name: 1, Department: 1 }" },
    { Operation: "Update",              Shell: "db.Students.updateOne(filter, {$set:{...}})", Compass: "Hover over a document > pencil icon > edit field > Update" },
    { Operation: "Replace",             Shell: "db.Students.replaceOne(filter, doc)",        Compass: "Edit the JSON view of the document or use the Aggregations/Update dialog" },
    { Operation: "Delete one",          Shell: "db.Students.deleteOne(filter)",              Compass: "Hover over a document > bin icon > Delete" },
    { Operation: "Delete many",         Shell: "db.Students.deleteMany(filter)",             Compass: "Filter the documents, then Delete (Delete all matching documents)" },
    { Operation: "Count",               Shell: "db.Students.countDocuments()",               Compass: "Shown at the top of the Documents tab" },
    { Operation: "Rename / drop",       Shell: "renameCollection() / drop()",                Compass: "Collection list > ... menu > Rename / Drop Collection" },
    { Operation: "Drop database",       Shell: "db.dropDatabase()",                          Compass: "Databases list > bin icon next to StudentDB" },
  ]);
  await step(22, "Compass filter { Department: 'BCA' } run from code", async () => await db().collection("Students").find({ Department: "BCA" }).toArray());
  await step(22, "Compass filter { CGPA: { $gt: 8 } } with project { Name: 1, CGPA: 1, _id: 0 }",
    async () => await db().collection("Students").find({ CGPA: { $gt: 8 } }, { projection: { Name: 1, CGPA: 1, _id: 0 } }).toArray());
  console.log(`
Comparison: the results are identical because both tools send the same operations to the server. The shell is
scriptable, repeatable and good for automation; Compass is visual, easier for browsing data, building queries and
checking indexes and schema, but slower for bulk or repeated work.`);
}

// ============================================================
// 23
// ============================================================
async function q23() {
  await db().collection("Students").countDocuments();
  await step(23, "show dbs   // shell: list databases", async () => await dbNames());
  await step(23, "show collections   // shell: list collections", async () => await colNames());
  await step(23, "db.Students.createIndex({ Roll_No: 1 }, { unique: true })   // shell: manage indexes", async () => {
    await db().collection("Students").createIndex({ Roll_No: 1 }, { unique: true });
    return (await db().collection("Students").indexes()).map((i) => i.name);
  });
  await step(23, "db.Students.stats()   // shell: collection statistics", async () => {
    const s = await db().command({ collStats: "Students" });
    return { count: s.count, size: s.size, avgObjSize: s.avgObjSize, nindexes: s.nindexes };
  });
  console.log(`
Same tasks in MongoDB Compass:
  - Databases: left panel lists databases; the "+" button creates one (needs a first collection name).
  - Collections: click a database to list collections; "Create collection" adds one; the "..." menu renames or drops.
  - Documents: the Documents tab browses, inserts, edits and deletes documents with a filter bar.
  - Indexes: the Indexes tab shows and creates indexes. Schema tab analyses fields. Aggregations tab builds pipelines.
  - MongoSH: Compass has an embedded shell at the bottom, so both tools can be used together.`);
}

// ============================================================
// 24
// ============================================================
async function q24() {
  console.table([
    { Operation: "Create table / collection", SQL: "CREATE TABLE Students (...);",                         MongoDB: "db.createCollection('Students')  (or created on first insert)" },
    { Operation: "Insert one row/document",   SQL: "INSERT INTO Students VALUES (101,'Aarav','BCA',5,8.4);", MongoDB: "db.Students.insertOne({...})" },
    { Operation: "Insert many",               SQL: "INSERT INTO Students VALUES (...),(...);",              MongoDB: "db.Students.insertMany([...])" },
    { Operation: "Select all",                SQL: "SELECT * FROM Students;",                               MongoDB: "db.Students.find()" },
    { Operation: "Select with condition",     SQL: "SELECT * FROM Students WHERE Department='BCA';",        MongoDB: "db.Students.find({Department:'BCA'})" },
    { Operation: "Select columns",            SQL: "SELECT Name, Department FROM Students;",                MongoDB: "db.Students.find({}, {Name:1, Department:1, _id:0})" },
    { Operation: "Update one",                SQL: "UPDATE Students SET Department='MCA' WHERE Roll_No=102 LIMIT 1;", MongoDB: "db.Students.updateOne({Roll_No:102}, {$set:{Department:'MCA'}})" },
    { Operation: "Update many",               SQL: "UPDATE Students SET Semester=6 WHERE Department='BCA';", MongoDB: "db.Students.updateMany({Department:'BCA'}, {$set:{Semester:6}})" },
    { Operation: "Add a column / field",      SQL: "ALTER TABLE Students ADD Email VARCHAR(50);",           MongoDB: "db.Students.updateMany({}, {$set:{Email:''}})" },
    { Operation: "Remove a column / field",   SQL: "ALTER TABLE Students DROP COLUMN Email;",               MongoDB: "db.Students.updateMany({}, {$unset:{Email:''}})" },
    { Operation: "Delete rows/documents",     SQL: "DELETE FROM Students WHERE CGPA < 5;",                  MongoDB: "db.Students.deleteMany({CGPA:{$lt:5}})" },
    { Operation: "Count",                     SQL: "SELECT COUNT(*) FROM Students;",                        MongoDB: "db.Students.countDocuments()" },
    { Operation: "Rename table / collection", SQL: "RENAME TABLE Students TO StudentDetails;",              MongoDB: "db.Students.renameCollection('StudentDetails')" },
    { Operation: "Drop table / collection",   SQL: "DROP TABLE Departments;",                               MongoDB: "db.Departments.drop()" },
    { Operation: "Drop database",             SQL: "DROP DATABASE StudentDB;",                              MongoDB: "db.dropDatabase()" },
  ]);
  console.table([
    { Aspect: "Data unit",   SQL: "Row in a table",                      MongoDB: "BSON document in a collection" },
    { Aspect: "Schema",      SQL: "Fixed; columns defined up front",     MongoDB: "Flexible; documents can have different fields" },
    { Aspect: "Query style", SQL: "Declarative SQL text",                MongoDB: "JSON-like query documents and methods" },
    { Aspect: "Adding field",SQL: "ALTER TABLE changes every row",       MongoDB: "Just set the field on any document" },
    { Aspect: "Joins",       SQL: "JOIN between tables",                 MongoDB: "Embedding or $lookup in aggregation" },
    { Aspect: "Scaling",     SQL: "Mostly vertical",                     MongoDB: "Horizontal with sharding and replica sets" },
  ]);
  REPORT.push({ q: 24, command: "SQL vs MongoDB comparison", output: "See the two tables printed above (operations mapping and key differences)." });
}

// ============================================================
// 25
// ============================================================
async function q25() {
  const byQ = {};
  for (const s of REPORT) (byQ[s.q] ||= []).push(s);
  let md = `# NoSQL Database Design - Lab Sheet-01 Report

**Programme:** BCA V Semester (Session 2026-2027)  
**Date:** ${new Date().toDateString()}

## Objective
To install, configure and work with MongoDB, manage databases and collections, perform CRUD operations, and compare
MongoDB with SQL.

## Requirements
MongoDB Community Edition, MongoDB Shell (mongosh), MongoDB Compass, Ubuntu/Linux, internet connection.

## Commands Executed and Outputs
`;
  for (const q of Object.keys(byQ).map(Number).sort((a, b) => a - b)) {
    md += `\n### Question ${q}\n`;
    for (const s of byQ[q]) md += `\n\`\`\`js\n${s.command}\n\`\`\`\nOutput:\n\`\`\`json\n${s.output}\n\`\`\`\n`;
    md += `\n*Screenshot: [insert screenshot of Question ${q}]*\n`;
  }
  md += `
## Observations
- A MongoDB database appears only after it holds at least one collection with data.
- Documents in one collection can have different fields; adding or removing a field needs no schema change.
- updateOne/deleteOne affect a single document, while updateMany/deleteMany affect all matches.
- replaceOne swaps the whole document (except _id), whereas $set changes only the named fields.
- Dropping a database removes all of its collections.
- MongoDB Compass and the shell give identical results for the same operations.

## Conclusion
All CRUD and collection/database management operations were performed successfully in MongoDB. The shell is best for
scripting and repeatability, Compass for visual exploration. Compared with SQL, MongoDB offers a flexible schema and
easy horizontal scaling, while SQL offers strict structure and mature join support.
`;
  const file = "Lab01_Report.md";
  fs.writeFileSync(file, md);
  console.log(`\nLab report written to ${file} (${REPORT.length} recorded steps). Add your screenshots where marked.`);
}

// ---------- runner ----------
const questions = { 1: q1, 2: q2, 3: q3, 4: q4, 5: q5, 6: q6, 7: q7, 8: q8, 9: q9, 10: q10, 11: q11, 12: q12, 13: q13,
  14: q14, 15: q15, 16: q16, 17: q17, 18: q18, 19: q19, 20: q20, 21: q21, 22: q22, 23: q23, 24: q24, 25: q25 };

(async () => {
  client = new MongoClient(MONGO_URI);
  await client.connect();
  try {
    const arg = process.argv[2];
    const runAll = !arg || arg === "25";             // the report needs the output of every step
    const list = runAll ? Object.keys(questions) : [arg];
    if (runAll) await db().dropDatabase();           // clean start
    else if (Number(arg) >= 5) await prepare();      // fresh sample data for a single question
    for (const n of list) {
      if (!questions[n]) { console.log("No such question:", n); continue; }
      console.log(`\n----- Question ${n} -----`);
      try { await questions[n](); }
      catch (e) { console.error(`Question ${n} failed:`, e.message); }
    }
  } finally { await client.close(); }
})();
