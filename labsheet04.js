/* ======== NOSQL DATABASE DESIGN – LAB SHEET - 4 ========

   Questions 1-10 drive the HBase shell from JavaScript (`hbase` must be on your PATH
   and HBase must be running).
   Questions 11-15 use Cassandra:  npm install cassandra-driver
   Run one question: node labsheet04.js 7
   Run all         : node labsheet04.js
   ======================================================== */

const { execSync } = require("child_process");

const CASS = { contactPoints: ["127.0.0.1"], localDataCenter: "datacenter1" };
const RF_LAB = Number(process.env.CASS_RF || 1);   // replication factor for single-node labs
const RF_CLUSTER = Number(process.env.CASS_RF || 3); // replication factor for Q14 (3-node cluster)

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const say = (label) => console.log(`\n${label}`);

// ---------------- HBase helpers ----------------
function hbase(cmds, { quiet = false } = {}) {
  try {
    const out = execSync("hbase shell", {
      input: [...cmds, "exit"].join("\n"), stdio: ["pipe", "pipe", "pipe"],
    }).toString();
    if (!quiet) console.log(out);
    return out;
  } catch (e) {
    if (!quiet) console.log((e.stdout || "").toString() || e.message);
    return "";
  }
}
const dropTable = (t) => hbase([`disable '${t}'`, `drop '${t}'`], { quiet: true });   // ignore "table not found"

// ============================================================
// 1
// ============================================================
async function q1() {
  /* Install and configure Apache HBase (standalone mode):
       sudo apt-get install openjdk-11-jdk
       wget https://downloads.apache.org/hbase/<version>/hbase-<version>-bin.tar.gz
       tar xzf hbase-*-bin.tar.gz && cd hbase-*
       export JAVA_HOME=/usr/lib/jvm/java-11-openjdk-amd64
       edit conf/hbase-site.xml:  hbase.rootdir = file:///home/user/hbase-data
       bin/start-hbase.sh
       bin/hbase shell                                                      */
  dropTable("Student");
  const rows = [
    ["1", "Aarav Sharma", "Delhi", "BCA", "3", "82"],
    ["2", "Riya Verma", "Mumbai", "MCA", "1", "91"],
    ["3", "Karan Singh", "Pune", "BCA", "3", "67"],
    ["4", "Neha Gupta", "Jaipur", "BBA", "2", "75"],
    ["5", "Rohan Mehta", "Lucknow", "MCA", "1", "88"],
  ];
  hbase([
    "create 'Student', 'personal', 'academic'",
    "list",
    "describe 'Student'",
    ...rows.flatMap(([id, name, city, course, sem, marks]) => [
      `put 'Student','${id}','personal:name','${name}'`,
      `put 'Student','${id}','personal:city','${city}'`,
      `put 'Student','${id}','academic:course','${course}'`,
      `put 'Student','${id}','academic:semester','${sem}'`,
      `put 'Student','${id}','academic:marks','${marks}'`,
    ]),
    "scan 'Student'",
    "count 'Student'",
  ]);
}

// ============================================================
// 2
// ============================================================
async function q2() {
  dropTable("Employee");
  hbase([
    "create 'Employee', 'info', 'job'",                                          // create
    "put 'Employee','E101','info:name','Aarav Sharma'",                          // put
    "put 'Employee','E101','info:city','Delhi'",
    "put 'Employee','E101','job:dept','IT'",
    "put 'Employee','E101','job:salary','55000'",
    "put 'Employee','E102','info:name','Riya Verma'",
    "put 'Employee','E102','job:dept','HR'",
    "put 'Employee','E102','job:salary','48000'",
    "put 'Employee','E103','info:name','Karan Singh'",
    "put 'Employee','E103','job:dept','Finance'",
    "put 'Employee','E103','job:salary','60000'",
    "get 'Employee','E101'",                                                     // get a row
    "get 'Employee','E101',{COLUMN=>'job:salary'}",                              // get one column
    "put 'Employee','E101','job:salary','62000'",                                // update
    "get 'Employee','E101','job:salary'",
    "scan 'Employee'",                                                           // scan all
    "scan 'Employee',{COLUMNS=>['info:name','job:dept'],LIMIT=>2}",
    "delete 'Employee','E102','job:dept'",                                       // delete a cell
    "deleteall 'Employee','E103'",                                               // delete a whole row
    "scan 'Employee'",
  ]);
}

// ============================================================
// 3
// ============================================================
async function q3() {
  // Row key = user # timestamp # event_id, so one user's events are stored together in time order.
  dropTable("EventLog");
  const ev = [
    ["user01", "20260310101500", "E1001", "login", "success", "Aarav"],
    ["user01", "20260310103000", "E1002", "file-upload", "success", "Aarav"],
    ["user01", "20260310110000", "E1003", "failed-login", "failed", "Aarav"],
    ["user02", "20260310102000", "E1004", "login", "success", "Riya"],
    ["user02", "20260310120000", "E1005", "password-change", "success", "Riya"],
    ["user03", "20260311090000", "E1006", "logout", "success", "Karan"],
  ];
  hbase([
    "create 'EventLog', 'meta', 'user', 'event'",
    ...ev.flatMap(([u, ts, id, type, status, name]) => {
      const rk = `${u}#${ts}#${id}`;
      return [
        `put 'EventLog','${rk}','meta:event_id','${id}'`,
        `put 'EventLog','${rk}','meta:timestamp','${ts}'`,
        `put 'EventLog','${rk}','user:user_id','${u}'`,
        `put 'EventLog','${rk}','user:name','${name}'`,
        `put 'EventLog','${rk}','event:type','${type}'`,
        `put 'EventLog','${rk}','event:status','${status}'`,
      ];
    }),
    "get 'EventLog','user01#20260310101500#E1001'",                               // exact row key
    "scan 'EventLog',{STARTROW=>'user01#',STOPROW=>'user01#~'}",                  // all events of user01
    "scan 'EventLog',{STARTROW=>'user01#20260310100000',STOPROW=>'user01#20260310111000',COLUMNS=>['event:type','event:status']}", // time window
    "scan 'EventLog',{ROWPREFIXFILTER=>'user02#'}",
  ]);
}

// ============================================================
// 4
// ============================================================
async function q4() {
  dropTable("CMS");
  hbase([
    "create 'CMS', 'content', 'author', 'metadata'",
    // insert
    "put 'CMS','post001','content:title','Introduction to HBase'",
    "put 'CMS','post001','content:body','HBase is a column-oriented NoSQL database.'",
    "put 'CMS','post001','author:name','Aarav Sharma'",
    "put 'CMS','post001','author:email','aarav@mail.com'",
    "put 'CMS','post001','metadata:created','2026-03-01'",
    "put 'CMS','post001','metadata:status','draft'",
    "put 'CMS','post002','content:title','Cassandra Basics'",
    "put 'CMS','post002','content:body','Cassandra is a masterless distributed database.'",
    "put 'CMS','post002','author:name','Riya Verma'",
    "put 'CMS','post002','metadata:status','published'",
    // retrieve
    "get 'CMS','post001'",
    // update
    "put 'CMS','post001','metadata:status','published'",
    "put 'CMS','post001','content:title','Introduction to Apache HBase'",
    "get 'CMS','post001',{COLUMNS=>['content:title','metadata:status']}",
    // delete
    "delete 'CMS','post002','author:name'",
    "deleteall 'CMS','post002'",
    "scan 'CMS'",
  ]);
}

// ============================================================
// 5
// ============================================================
async function q5() {
  dropTable("Blogs");
  hbase([
    "create 'Blogs', 'blog', 'author', 'comments'",
    "put 'Blogs','blog001','blog:title','Getting Started with NoSQL'",
    "put 'Blogs','blog001','blog:category','Database'",
    "put 'Blogs','blog001','blog:published','2026-01-15'",
    "put 'Blogs','blog001','author:name','Aarav Sharma'",
    "put 'Blogs','blog001','author:email','aarav@mail.com'",
    "put 'Blogs','blog001','comments:c1','Riya: Very helpful!'",
    "put 'Blogs','blog001','comments:c2','Karan: Please add examples.'",
    "put 'Blogs','blog002','blog:title','Understanding Column Stores'",
    "put 'Blogs','blog002','blog:category','Database'",
    "put 'Blogs','blog002','blog:published','2026-02-10'",
    "put 'Blogs','blog002','author:name','Riya Verma'",
    "put 'Blogs','blog002','comments:c1','Neha: Great explanation.'",
    "put 'Blogs','blog003','blog:title','Building REST APIs'",
    "put 'Blogs','blog003','blog:category','Web'",
    "put 'Blogs','blog003','blog:published','2026-03-05'",
    "put 'Blogs','blog003','author:name','Karan Singh'",
    "get 'Blogs','blog001'",                                          // retrieve a blog by row key
    "get 'Blogs','blog002',{COLUMNS=>['blog:title','comments']}",
    "scan 'Blogs',{COLUMNS=>['blog:title','author:name']}",
  ]);
}

// ============================================================
// 6
// ============================================================
async function q6() {
  dropTable("Employees_CF");
  hbase([
    "create 'Employees_CF', {NAME=>'personal', VERSIONS=>3}, {NAME=>'professional'}, {NAME=>'contact'}",
    "describe 'Employees_CF'",
    // each row can use different qualifiers inside the same families (sparse columns)
    "put 'Employees_CF','emp1','personal:name','Aarav'",
    "put 'Employees_CF','emp1','personal:age','28'",
    "put 'Employees_CF','emp1','professional:dept','IT'",
    "put 'Employees_CF','emp1','professional:skills','Java,SQL'",
    "put 'Employees_CF','emp1','contact:email','aarav@mail.com'",
    "put 'Employees_CF','emp2','personal:name','Riya'",
    "put 'Employees_CF','emp2','personal:hobby','Painting'",
    "put 'Employees_CF','emp2','professional:dept','HR'",
    "put 'Employees_CF','emp2','contact:phone','9876543210'",
    "put 'Employees_CF','emp2','contact:linkedin','linkedin.com/in/riya'",
    // multiple versions of one cell
    "put 'Employees_CF','emp1','personal:age','29'",
    "put 'Employees_CF','emp1','personal:age','30'",
    "get 'Employees_CF','emp1',{COLUMN=>'personal:age',VERSIONS=>3}",
    "scan 'Employees_CF'",                                       // cells shown as row/family:qualifier/timestamp
    "scan 'Employees_CF',{COLUMNS=>['personal']}",               // reads only the 'personal' family files
    "scan 'Employees_CF',{COLUMNS=>['contact:email','contact:phone']}",
  ]);
  console.log(`
How HBase stores columns within column families:
  - A table is split into column families; every family is stored in its own set of HFiles on HDFS/disk.
  - Qualifiers (personal:name, personal:hobby...) are not fixed in the schema; each row may have different ones.
  - Each value is stored as a cell: (row key, family, qualifier, timestamp) -> value, sorted in that order.
  - Missing columns take no space (sparse storage), so emp1 and emp2 above store different sets of cells.
  - Reading only one family (scan COLUMNS=>['personal']) avoids reading the other families' files.
  - VERSIONS => 3 keeps the last three timestamped values of each cell.`);
}

// ============================================================
// 7
// ============================================================
async function q7() {
  dropTable("WebsiteCounter");
  hbase([
    "create 'WebsiteCounter', 'views'",
    "incr 'WebsiteCounter','/home','views:count'",             // +1 (default)
    "incr 'WebsiteCounter','/home','views:count'",
    "incr 'WebsiteCounter','/home','views:count',5",           // +5
    "incr 'WebsiteCounter','/products','views:count',3",
    "incr 'WebsiteCounter','/products','views:count'",
    "incr 'WebsiteCounter','/about','views:count',2",
    "incr 'WebsiteCounter','/contact','views:count'",
    "get_counter 'WebsiteCounter','/home','views:count'",
    "get_counter 'WebsiteCounter','/products','views:count'",
    "get_counter 'WebsiteCounter','/about','views:count'",
    "get_counter 'WebsiteCounter','/contact','views:count'",
    "incr 'WebsiteCounter','/home','views:count',10",
    "get_counter 'WebsiteCounter','/home','views:count'",
    "scan 'WebsiteCounter'",                                    // raw values are 8-byte binary longs
  ]);
}

// ============================================================
// 8
// ============================================================
async function q8() {
  dropTable("UserSessions");
  hbase([
    "create 'UserSessions', {NAME=>'session', TTL=>10}, {NAME=>'profile'}",   // session cells expire after 10 seconds
    "describe 'UserSessions'",
    "put 'UserSessions','sess001','session:user','aarav'",
    "put 'UserSessions','sess001','session:login_time','2026-03-10 10:15:00'",
    "put 'UserSessions','sess001','session:status','active'",
    "put 'UserSessions','sess001','profile:name','Aarav Sharma'",             // this family has no TTL
    "put 'UserSessions','sess002','session:user','riya'",
    "put 'UserSessions','sess002','session:status','active'",
    "scan 'UserSessions'",
  ]);
  say("Waiting 15 seconds so the 10-second TTL passes...");
  await sleep(15000);
  say("After expiry: 'session' cells are gone, 'profile' cell remains");
  hbase(["scan 'UserSessions'", "get 'UserSessions','sess001'", "get 'UserSessions','sess002'"]);
  hbase(["flush 'UserSessions'", "major_compact 'UserSessions'"], { quiet: true });   // physically removes expired cells
  console.log(`
Expiration behavior: once a cell is older than the family TTL, reads no longer return it (even before
compaction). Expired cells are physically deleted during compaction. TTL is set per column family.`);
}

// ============================================================
// 9
// ============================================================
async function q9() {
  /* Row-key design for a large-scale orders table:
       key = <salt><|><user_id><|><reverse_timestamp>
     - salt (0-3, hash of user_id) spreads writes over all regions instead of hammering one (no hotspotting)
     - user_id groups one user's rows together for fast prefix scans
     - reverse timestamp makes the newest record come first                                              */
  dropTable("OrdersLarge");
  const SALTS = 4;
  const salt = (u) => [...u].reduce((a, c) => a + c.charCodeAt(0), 0) % SALTS;
  const base = Date.now();
  const puts = [], perSalt = {};
  for (let i = 0; i < 24; i++) {
    const user = `user${(i % 8) + 1}`;
    const rev = String(9999999999999 - (base + i * 1000)).padStart(13, "0");
    const rk = `${salt(user)}|${user}|${rev}`;
    perSalt[salt(user)] = (perSalt[salt(user)] || 0) + 1;
    puts.push(`put 'OrdersLarge','${rk}','data:order_id','ORD${1000 + i}'`);
    puts.push(`put 'OrdersLarge','${rk}','data:amount','${(500 + i * 137) % 5000}'`);
  }
  const u = "user5", s = salt(u);
  hbase([
    "create 'OrdersLarge', 'data', SPLITS => ['1','2','3']",       // pre-split into 4 regions, one per salt
    ...puts,
    "count 'OrdersLarge'",
    `scan 'OrdersLarge',{STARTROW=>'${s}|${u}|',STOPROW=>'${s}|${u}|~',LIMIT=>3}`,   // latest orders of one user
    "list_regions 'OrdersLarge'",
  ]);
  console.log("\nRows written per salt prefix (one per region):", perSalt);
  console.log(`
How row-key design supports horizontal scaling:
  - HBase keeps rows sorted by row key and splits the table into regions by key ranges.
  - Sequential keys (timestamps, auto-increment ids) send every write to the last region (hotspot).
  - A salted prefix spreads consecutive writes across regions, which sit on different RegionServers,
    so write and read load is shared and more servers can be added to scale out.`);
}

// ============================================================
// 10
// ============================================================
async function q10() {
  dropTable("RegionDemo");
  const words = ["apple", "banana", "cherry", "dog", "elephant", "fox", "grape", "horse", "ink", "jug", "kiwi",
                 "lemon", "mango", "nut", "orange", "pear", "queen", "rose", "sun", "tiger", "umbrella", "violin",
                 "water", "xray", "yak", "zebra"];
  hbase([
    "create 'RegionDemo', 'cf', SPLITS => ['d','h','m','s']",                   // 5 regions: <d, d-h, h-m, m-s, >=s
    ...words.map((w) => `put 'RegionDemo','${w}','cf:len','${w.length}'`),
    "count 'RegionDemo'",
    "list_regions 'RegionDemo'",                                                // region boundaries and hosting server
    "scan 'hbase:meta',{ROWPREFIXFILTER=>'RegionDemo,',COLUMNS=>['info:server']}", // which RegionServer serves each region
    "status 'simple'",
  ]);
  console.log(`
Rows with keys a-c go to region 1, d-g to region 2, h-l to region 3, m-r to region 4 and s-z to region 5.
Role of RegionServers:
  - Each RegionServer hosts many regions and handles all reads and writes for them (memstore + HFiles).
  - The HMaster assigns regions to RegionServers and rebalances them; new servers automatically take regions,
    so capacity grows horizontally; a region that grows too big splits automatically.
  - Availability: data lives on HDFS (replicated). If a RegionServer dies, ZooKeeper detects it and the master
    reassigns its regions to other servers, which replay the write-ahead log and serve them again.`);
}

// ============================================================
// Cassandra helper
// ============================================================
async function withCass(fn) {
  const cassandra = require("cassandra-driver");
  const client = new cassandra.Client(CASS);
  await client.connect();
  try { return await fn(client, cassandra); } finally { await client.shutdown(); }
}
function plain(rows) {
  return JSON.parse(JSON.stringify(rows, (k, v) =>
    v && typeof v === "object" && "low" in v && "high" in v ? v.toString() : v));
}
const showRows = (label, rows) => console.log(`\n${label}:`, JSON.stringify(plain(rows), null, 2));

// ============================================================
// 11
// ============================================================
async function q11() {
  /* Install and configure Apache Cassandra:
       sudo apt-get install openjdk-11-jdk
       echo "deb https://debian.cassandra.apache.org 41x main" | sudo tee /etc/apt/sources.list.d/cassandra.list
       sudo apt-get update && sudo apt-get install cassandra
       sudo systemctl start cassandra
       nodetool status        # node should show UN (Up/Normal)
       cqlsh                                                                   */
  await withCass(async (c) => {
    await c.execute(`CREATE KEYSPACE IF NOT EXISTS CollegeDB
      WITH replication = {'class':'SimpleStrategy','replication_factor':${RF_LAB}}`);
    // Use replication_factor 3 (and NetworkTopologyStrategy) on a real multi-node cluster.
    await c.execute(`CREATE TABLE IF NOT EXISTS CollegeDB.Students (
      student_id int PRIMARY KEY, name text, course text, semester int, marks int)`);
    const students = [
      [1, "Aarav Sharma", "BCA", 3, 82], [2, "Riya Verma", "MCA", 1, 91], [3, "Karan Singh", "BCA", 3, 67],
      [4, "Neha Gupta", "BBA", 2, 75], [5, "Rohan Mehta", "MCA", 1, 88],
    ];
    for (const s of students)
      await c.execute("INSERT INTO CollegeDB.Students (student_id,name,course,semester,marks) VALUES (?,?,?,?,?)", s, { prepare: true });
    showRows("All students", (await c.execute("SELECT * FROM CollegeDB.Students")).rows);
    showRows("Student 3", (await c.execute("SELECT * FROM CollegeDB.Students WHERE student_id = ?", [3], { prepare: true })).rows);
  });
}

// ============================================================
// 12
// ============================================================
async function q12() {
  await withCass(async (c) => {
    await c.execute(`CREATE KEYSPACE IF NOT EXISTS CompanyDB
      WITH replication = {'class':'SimpleStrategy','replication_factor':${RF_LAB}}`);
    await c.execute("DROP TABLE IF EXISTS CompanyDB.Employees");
    await c.execute(`CREATE TABLE CompanyDB.Employees (
      emp_id int PRIMARY KEY, name text, dept text, salary int, city text)`);

    const ins = "INSERT INTO CompanyDB.Employees (emp_id,name,dept,salary,city) VALUES (?,?,?,?,?)";
    await c.execute(ins, [101, "Aarav Sharma", "IT", 55000, "Delhi"], { prepare: true });          // INSERT
    await c.execute(ins, [102, "Riya Verma", "HR", 48000, "Mumbai"], { prepare: true });
    await c.execute(ins, [103, "Karan Singh", "Finance", 60000, "Pune"], { prepare: true });
    showRows("SELECT all", (await c.execute("SELECT * FROM CompanyDB.Employees")).rows);          // SELECT
    showRows("SELECT emp 101", (await c.execute("SELECT name, dept, salary FROM CompanyDB.Employees WHERE emp_id = 101")).rows);

    await c.execute("UPDATE CompanyDB.Employees SET salary = 62000, city = 'Noida' WHERE emp_id = 101");  // UPDATE
    showRows("After UPDATE", (await c.execute("SELECT * FROM CompanyDB.Employees WHERE emp_id = 101")).rows);

    await c.execute("DELETE city FROM CompanyDB.Employees WHERE emp_id = 102");                    // DELETE a column
    await c.execute("DELETE FROM CompanyDB.Employees WHERE emp_id = 103");                         // DELETE a row
    showRows("After DELETE", (await c.execute("SELECT * FROM CompanyDB.Employees")).rows);
  });
}

// ============================================================
// 13
// ============================================================
async function q13() {
  await withCass(async (c, cassandra) => {
    await c.execute(`CREATE KEYSPACE IF NOT EXISTS EventsDB
      WITH replication = {'class':'SimpleStrategy','replication_factor':${RF_LAB}}`);
    await c.execute("DROP TABLE IF EXISTS EventsDB.events_by_user");
    // partition key = user_id (one user's events together), clustering = event_time (newest first)
    await c.execute(`CREATE TABLE EventsDB.events_by_user (
      user_id text, event_time timestamp, event_id uuid, event_type text, status text,
      PRIMARY KEY ((user_id), event_time, event_id)
    ) WITH CLUSTERING ORDER BY (event_time DESC, event_id ASC)`);

    const t = (d, h, m) => new Date(`2026-03-${d}T${h}:${m}:00Z`);
    const events = [
      ["user01", t("10", "10", "15"), "login", "success"], ["user01", t("10", "10", "30"), "file-upload", "success"],
      ["user01", t("10", "11", "00"), "failed-login", "failed"], ["user01", t("11", "09", "00"), "logout", "success"],
      ["user02", t("10", "10", "20"), "login", "success"], ["user02", t("10", "12", "00"), "password-change", "success"],
      ["user03", t("11", "09", "30"), "login", "success"],
    ];
    for (const [u, time, type, status] of events)
      await c.execute("INSERT INTO EventsDB.events_by_user (user_id,event_time,event_id,event_type,status) VALUES (?,?,?,?,?)",
        [u, time, cassandra.types.Uuid.random(), type, status], { prepare: true });

    showRows("All events of user01 (newest first)", (await c.execute(
      "SELECT user_id, event_time, event_type, status FROM EventsDB.events_by_user WHERE user_id = ?", ["user01"], { prepare: true })).rows);
    showRows("user01 events between 10 Mar 10:00 and 10 Mar 11:30", (await c.execute(
      `SELECT event_time, event_type, status FROM EventsDB.events_by_user
       WHERE user_id = ? AND event_time >= ? AND event_time <= ?`,
      ["user01", t("10", "10", "00"), t("10", "11", "30")], { prepare: true })).rows);
    showRows("Latest 2 events of user01", (await c.execute(
      "SELECT event_time, event_type FROM EventsDB.events_by_user WHERE user_id = ? LIMIT 2", ["user01"], { prepare: true })).rows);
  });
}

// ============================================================
// 14
// ============================================================
async function q14() {
  /* Needs a multi-node cluster for the full effect (replication factor 3 on 3 nodes).
     After the first run, stop one node (for example `docker stop cass3`) and run again:
     ONE and QUORUM still work, ALL fails.                                               */
  await withCass(async (c, cassandra) => {
    const CL = cassandra.types.consistencies;
    await c.execute(`CREATE KEYSPACE IF NOT EXISTS ConsistencyDB
      WITH replication = {'class':'SimpleStrategy','replication_factor':${RF_CLUSTER}}`);
    await c.execute("CREATE TABLE IF NOT EXISTS ConsistencyDB.accounts (id int PRIMARY KEY, owner text, balance int)");

    console.log(`Keyspace replication factor = ${RF_CLUSTER}  ->  ONE needs 1 replica, QUORUM needs ${Math.floor(RF_CLUSTER / 2) + 1}, ALL needs ${RF_CLUSTER}`);
    const results = [];
    let id = Date.now() % 100000;
    for (const [name, level] of [["ONE", CL.one], ["QUORUM", CL.quorum], ["ALL", CL.all]]) {
      id++;
      let write = "OK", read = "OK";
      try { await c.execute("INSERT INTO ConsistencyDB.accounts (id,owner,balance) VALUES (?,?,?)", [id, "Aarav", 1000], { prepare: true, consistency: level }); }
      catch (e) { write = `FAILED (${e.name})`; }
      try {
        const r = await c.execute("SELECT * FROM ConsistencyDB.accounts WHERE id = ?", [id], { prepare: true, consistency: level });
        read = `OK (${r.rows.length} row)`;
      } catch (e) { read = `FAILED (${e.name})`; }
      results.push({ consistency: name, write, read });
    }
    console.table(results);
    console.log(`
Observations:
  - ONE: fastest and most available (works while any replica is up) but a read may return stale data.
  - QUORUM: majority of replicas; with QUORUM reads and writes (R + W > RF) you get strong consistency
    and the cluster tolerates one node down when RF = 3.
  - ALL: strongest consistency but lowest availability; it fails when any replica is down.
  - Cassandra is AP by default; consistency level is tunable per query.`);
  });
}

// ============================================================
// 15  (Event Logging application on Cassandra)
// ============================================================
async function q15() {
  await withCass(async (c, cassandra) => {
    const CL = cassandra.types.consistencies;
    // ---- database / table creation ----
    await c.execute(`CREATE KEYSPACE IF NOT EXISTS EventApp
      WITH replication = {'class':'SimpleStrategy','replication_factor':${RF_LAB}}`);
    await c.execute("DROP TABLE IF EXISTS EventApp.events");
    await c.execute("DROP TABLE IF EXISTS EventApp.event_counts");
    await c.execute("DROP TABLE IF EXISTS EventApp.events_by_type");
    await c.execute(`CREATE TABLE EventApp.events (
      user_id text, event_time timestamp, event_id uuid, event_type text, status text, details text,
      PRIMARY KEY ((user_id), event_time, event_id)) WITH CLUSTERING ORDER BY (event_time DESC, event_id ASC)`);
    await c.execute("CREATE TABLE EventApp.events_by_type (event_type text, event_time timestamp, event_id uuid, user_id text, PRIMARY KEY ((event_type), event_time, event_id))");
    await c.execute("CREATE TABLE EventApp.event_counts (event_type text PRIMARY KEY, total counter)");

    // ---- insertion (batch keeps the two query tables in step) ----
    const log = async (user, type, status, details, ttl) => {
      const id = cassandra.types.Uuid.random(), now = new Date();
      await c.batch([
        { query: `INSERT INTO EventApp.events (user_id,event_time,event_id,event_type,status,details) VALUES (?,?,?,?,?,?)${ttl ? ` USING TTL ${ttl}` : ""}`,
          params: [user, now, id, type, status, details] },
        { query: "INSERT INTO EventApp.events_by_type (event_type,event_time,event_id,user_id) VALUES (?,?,?,?)",
          params: [type, now, id, user] },
      ], { prepare: true, consistency: CL.quorum });
      // counter updates cannot be mixed into a logged batch, so they run as a separate statement
      await c.execute("UPDATE EventApp.event_counts SET total = total + 1 WHERE event_type = ?", [type], { prepare: true });
      return { id, now };
    };
    await log("user01", "login", "success", "from Delhi");
    await sleep(20);
    const upload = await log("user01", "file-upload", "pending", "report.pdf");
    await sleep(20);
    await log("user01", "failed-login", "failed", "wrong password");
    await log("user02", "login", "success", "from Mumbai");
    await log("user02", "login", "success", "from Pune", 3600);      // this row expires after 1 hour (TTL)

    // ---- querying ----
    showRows("Events of user01", (await c.execute("SELECT event_type,status,details FROM EventApp.events WHERE user_id='user01'")).rows);
    showRows("All login events (by type table)", (await c.execute("SELECT event_type,user_id FROM EventApp.events_by_type WHERE event_type='login'")).rows);
    showRows("Event counters", (await c.execute("SELECT * FROM EventApp.event_counts")).rows);

    // ---- updating (needs the full primary key) ----
    await c.execute("UPDATE EventApp.events SET status='success' WHERE user_id=? AND event_time=? AND event_id=?",
      ["user01", upload.now, upload.id], { prepare: true });
    // lightweight transaction: only applies if the condition holds
    const lwt = await c.execute("UPDATE EventApp.events SET status='archived' WHERE user_id=? AND event_time=? AND event_id=? IF status='success'",
      ["user01", upload.now, upload.id], { prepare: true });
    console.log("\nLWT applied:", lwt.rows[0]["[applied]"]);
    showRows("user01 after update", (await c.execute("SELECT event_type,status FROM EventApp.events WHERE user_id='user01'")).rows);

    // ---- deletion ----
    await c.execute("DELETE FROM EventApp.events WHERE user_id=? AND event_time=? AND event_id=?", ["user01", upload.now, upload.id], { prepare: true });
    showRows("user01 after delete", (await c.execute("SELECT event_type,status FROM EventApp.events WHERE user_id='user01'")).rows);

    console.log(`
How Cassandra handles the requested features:
  Consistency   - tunable per query (ONE, QUORUM, ALL...); QUORUM reads + writes give strong consistency.
                  Replicas are repaired by read repair, hinted handoff and nodetool repair; last write wins by timestamp.
  Availability  - masterless peer-to-peer ring, data replicated to RF nodes; any node can serve requests and the
                  cluster keeps working when nodes fail (no single point of failure).
  Transactions  - no multi-table ACID transactions. Single-partition writes are atomic and isolated; batches give
                  atomicity across tables; lightweight transactions (IF NOT EXISTS / IF condition) use Paxos for
                  compare-and-set.
  Query features- CQL (SQL-like) but queries must use the partition key; clustering columns allow range queries and
                  ordering; no joins, so data is denormalised into one table per query (events, events_by_type);
                  counters, TTL and secondary indexes are available.
  Scaling       - linear horizontal scaling: add nodes and data is redistributed using consistent hashing (vnodes),
                  with writes spread across all nodes.`);
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
