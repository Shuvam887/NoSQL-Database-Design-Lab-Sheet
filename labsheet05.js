/* ========== NoSQL Database Design_LAB SHEET - 5 ==========

   Needs Node.js 18+ (built-in fetch).
   Questions 1-10 use the Riak KV HTTP API (default http://127.0.0.1:8098).
   Questions 11-15 use Neo4j:  npm install neo4j-driver
   Run one question: node labsheet05.js 4
   Run all         : node labsheet05.js
   ========================================================== */

const RIAK = process.env.RIAK_URL || "http://127.0.0.1:8098";
const NEO = { url: "bolt://127.0.0.1:7687", user: "neo4j", pass: "password" };

const show = (label, data) => console.log(`\n${label}:`, typeof data === "string" ? data : JSON.stringify(data, null, 2));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------------- Riak helpers (HTTP API) ----------------
async function put(bucket, key, value, { type = "application/json", params = "", headers = {} } = {}) {
  const body = type === "application/json" ? JSON.stringify(value) : value;
  const r = await fetch(`${RIAK}/buckets/${bucket}/keys/${encodeURIComponent(key)}${params}`,
    { method: "PUT", headers: { "Content-Type": type, ...headers }, body });
  if (!r.ok) throw new Error(`PUT ${bucket}/${key} failed (${r.status})`);
  return r;
}
async function get(bucket, key, params = "") {
  const r = await fetch(`${RIAK}/buckets/${bucket}/keys/${encodeURIComponent(key)}${params}`);
  if (r.status === 404) return null;
  const vclock = r.headers.get("x-riak-vclock");
  if (r.status === 300) return { siblings: true, raw: await r.text(), vclock };
  if (!r.ok) throw new Error(`GET ${bucket}/${key} failed (${r.status})`);
  const ct = r.headers.get("content-type") || "";
  const value = ct.includes("json") ? await r.json() : await r.text();
  return { value, vclock, contentType: ct };
}
async function del(bucket, key) {
  const r = await fetch(`${RIAK}/buckets/${bucket}/keys/${encodeURIComponent(key)}`, { method: "DELETE" });
  return r.status;
}
async function listKeys(bucket) {
  const r = await fetch(`${RIAK}/buckets/${bucket}/keys?keys=true`);
  return (await r.json()).keys || [];
}
async function setProps(bucket, props) {
  const r = await fetch(`${RIAK}/buckets/${bucket}/props`,
    { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ props }) });
  if (!r.ok) throw new Error(`set props failed (${r.status})`);
}
async function getProps(bucket) {
  return (await (await fetch(`${RIAK}/buckets/${bucket}/props`)).json()).props;
}

// ============================================================
// 1
// ============================================================
async function q1() {
  /* Install and configure Riak KV (Ubuntu/Debian):
       sudo dpkg -i riak-kv_<version>_amd64.deb      (or: sudo apt-get install riak)
       sudo ulimit -n 65536          # raise open-file limit
       sudo riak start
       riak ping                     # should print: pong
       riak-admin status | head      # node health
     Buckets are created automatically on first write.                          */
  console.log("Ping:", await (await fetch(`${RIAK}/ping`)).text());

  const bucket = "students";
  await put(bucket, "101", { name: "Aarav Sharma", course: "BCA", semester: 3, marks: 82 });   // store
  await put(bucket, "102", { name: "Riya Verma", course: "MCA", semester: 1, marks: 91 });
  await put(bucket, "103", { name: "Karan Singh", course: "BCA", semester: 3, marks: 67 });
  show("Retrieve 101", (await get(bucket, "101")).value);                                      // retrieve

  await put(bucket, "101", { name: "Aarav Sharma", course: "BCA", semester: 3, marks: 90 });   // update (overwrite same key)
  show("After update 101", (await get(bucket, "101")).value);

  console.log("\nDelete 103 -> HTTP", await del(bucket, "103"));                                // delete
  show("Get 103 after delete", await get(bucket, "103"));                                      // null = not found
  show("Keys in students", await listKeys(bucket));
}

// ============================================================
// 2
// ============================================================
async function q2() {
  const bucket = "user_sessions";
  const sessions = [
    { session_id: "sess-a1b2c3", user_id: 1, login_time: new Date().toISOString(), status: "active" },
    { session_id: "sess-d4e5f6", user_id: 2, login_time: new Date(Date.now() - 3600000).toISOString(), status: "active" },
    { session_id: "sess-g7h8i9", user_id: 3, login_time: new Date(Date.now() - 7200000).toISOString(), status: "expired" },
  ];
  for (const s of sessions) await put(bucket, s.session_id, s);       // key = session id
  show("Session sess-a1b2c3", (await get(bucket, "sess-a1b2c3")).value);

  // logout: update the status
  const cur = (await get(bucket, "sess-a1b2c3")).value;
  await put(bucket, "sess-a1b2c3", { ...cur, status: "logged_out", logout_time: new Date().toISOString() });
  show("After logout", (await get(bucket, "sess-a1b2c3")).value);
}

// ============================================================
// 3
// ============================================================
async function q3() {
  const bucket = "user_profiles";
  await put(bucket, "aarav@mail.com", {
    name: "Aarav Sharma", email: "aarav@mail.com", city: "Delhi", language: "English", theme: "dark",
    notifications: { email: true, sms: false, push: true } });                                // PUT
  await put(bucket, "riya@mail.com", {
    name: "Riya Verma", email: "riya@mail.com", city: "Mumbai", language: "Hindi", theme: "light",
    notifications: { email: true, sms: true, push: false } });

  show("GET aarav profile", (await get(bucket, "aarav@mail.com")).value);                      // GET
  const p = (await get(bucket, "riya@mail.com")).value;
  p.theme = "dark"; p.notifications.sms = false;                                               // change preferences
  await put(bucket, "riya@mail.com", p);
  show("GET riya profile after PUT", (await get(bucket, "riya@mail.com")).value);
}

// ============================================================
// 4
// ============================================================
async function q4() {
  const bucket = "shopping_carts";
  const key = (user) => `cart:${user}`;
  const recompute = (c) => { c.total = c.items.reduce((t, i) => t + i.price * i.qty, 0); return c; };
  const load = async (user) => (await get(bucket, key(user)))?.value || { user, items: [], total: 0 };

  async function addProduct(user, item) {
    const cart = await load(user);
    const ex = cart.items.find((i) => i.product_id === item.product_id);
    if (ex) ex.qty += item.qty; else cart.items.push(item);
    await put(bucket, key(user), recompute(cart));
  }
  async function updateQty(user, product_id, qty) {
    const cart = await load(user);
    const it = cart.items.find((i) => i.product_id === product_id);
    if (it) it.qty = qty;
    await put(bucket, key(user), recompute(cart));
  }
  async function removeProduct(user, product_id) {
    const cart = await load(user);
    cart.items = cart.items.filter((i) => i.product_id !== product_id);
    await put(bucket, key(user), recompute(cart));
  }

  await del(bucket, key("aarav"));
  await addProduct("aarav", { product_id: "P101", name: "Laptop", qty: 1, price: 50000 });
  await addProduct("aarav", { product_id: "P102", name: "Mouse", qty: 2, price: 500 });
  await addProduct("aarav", { product_id: "P103", name: "Keyboard", qty: 1, price: 1500 });
  show("Cart after adding", await load("aarav"));
  await updateQty("aarav", "P102", 5);
  show("Cart after updating Mouse qty", await load("aarav"));
  await removeProduct("aarav", "P103");
  show("Cart after removing Keyboard (retrieved with GET)", (await get(bucket, key("aarav"))).value);
}

// ============================================================
// 5
// ============================================================
async function q5() {
  const bucket = "data_types_demo";
  await put(bucket, "greeting", "Hello, Riak!", { type: "text/plain" });                        // string
  await put(bucket, "student:1", { name: "Aarav", marks: [82, 75, 91], address: { city: "Delhi" } }); // JSON document
  await put(bucket, "fruits", ["apple", "banana", "mango"]);                                     // list (stored as JSON array)

  for (const k of ["greeting", "student:1", "fruits"]) {
    const r = await get(bucket, k);
    console.log(`\nbucket='${bucket}' key='${k}' content-type='${r.contentType}'`);
    console.log("value:", r.value);
  }
  console.log(`
Role of each part:
  Bucket - a namespace that groups related keys (like a table or folder) and holds settings such as n_val, r, w.
  Key    - the unique identifier inside a bucket; Riak hashes bucket+key to decide which nodes store the object.
  Value  - the data itself; Riak treats it as an opaque blob (string, JSON, list, image...) and does not look inside it.`);
}

// ============================================================
// 6
// ============================================================
async function q6() {
  const bucket = "consistency_demo";
  await setProps(bucket, { n_val: 3, r: "quorum", w: "quorum", allow_mult: true });            // quorum = (n_val/2)+1 = 2
  const p = await getProps(bucket);
  console.log(`Bucket props -> n_val=${p.n_val}, r=${p.r}, w=${p.w}, allow_mult=${p.allow_mult}`);

  await put(bucket, "balance", { amount: 1000 }, { params: "?w=2" });                          // write acknowledged by 2 of 3 replicas
  show("Read with r=2", (await get(bucket, "balance", "?r=2")).value);
  show("Read with r=1 (faster, may be stale)", (await get(bucket, "balance", "?r=1")).value);
  show("Read with r=all (strongest, needs all replicas up)", (await get(bucket, "balance", "?r=all")).value);

  // Concurrent writes without a vector clock create siblings
  await put(bucket, "profile", { city: "Delhi" });
  await put(bucket, "profile", { city: "Mumbai" });                                             // no vclock sent -> conflict
  const conflict = await get(bucket, "profile");
  if (conflict?.siblings) {
    console.log("\nConflict detected, siblings returned (HTTP 300):\n" + conflict.raw);
    await put(bucket, "profile", { city: "Mumbai" }, { headers: { "X-Riak-Vclock": conflict.vclock } }); // resolve with vclock
    show("After resolving with vclock", (await get(bucket, "profile")).value);
  }

  console.log(`
How Riak handles consistency:
  - Each object is stored on N replicas (n_val=3). A write succeeds when W replicas reply, a read when R replicas reply.
  - If R + W > N (2 + 2 > 3) every read overlaps with the latest write, giving strong-like consistency.
  - Lower R/W values give higher availability and speed but only eventual consistency.
  - Vector clocks track versions; conflicting writes are kept as siblings until the application (or CRDTs) resolves them.
  - Read repair and active anti-entropy bring out-of-date replicas back in sync.`);
}

// ============================================================
// 7
// ============================================================
async function q7() {
  const buckets = ["students_big", "orders_big", "logs_big"];
  const perBucket = 300;
  for (const b of buckets) {
    for (let start = 0; start < perBucket; start += 50) {
      await Promise.all(Array.from({ length: 50 }, (_, i) => {
        const id = start + i + 1;
        return put(b, `${b}-${id}`, { id, bucket: b, value: Math.random().toString(36).slice(2), ts: Date.now() });
      }));
    }
    console.log(`Inserted ${perBucket} records into '${b}'`);
  }
  for (const b of buckets) console.log(`${b} holds ${(await listKeys(b)).length} keys`);

  try {
    const s = await (await fetch(`${RIAK}/stats`)).json();
    console.log("\nNode:", s.nodename, "| Ring members:", s.ring_members, "| Ring partitions:", s.ring_num_partitions,
                "| Ring ownership:", s.ring_ownership);
  } catch (_) { console.log("Could not read /stats"); }

  console.log(`
How Riak distributes data and scales:
  - Keys are hashed (SHA-1) onto a ring that is divided into fixed partitions (64 by default).
  - Each node runs several virtual nodes (vnodes), each owning one partition; replicas go to the next N partitions.
  - Adding a node (riak-admin cluster join + plan + commit) makes the ring hand over some partitions to it,
    so capacity grows horizontally without downtime and without re-sharding by hand.
  - Any node can coordinate any request, so there is no master and no single point of failure.`);
}

// ============================================================
// 8
// ============================================================
async function q8() {
  const cartB = "txn_carts", totalB = "txn_totals", user = "aarav";
  await del(cartB, user); await del(totalB, user);
  await put(cartB, user, { items: [{ product_id: "P1", name: "Mouse", qty: 1, price: 500 }] });
  await put(totalB, user, { total: 500 });

  const snapshot = async () => ({ cart: (await get(cartB, user))?.value, total: (await get(totalB, user))?.value });

  async function multiStep({ failAfterStep } = {}) {
    const before = await snapshot();                       // saved so we can compensate manually
    try {
      const cart = structuredClone(before.cart);
      cart.items.push({ product_id: "P2", name: "Keyboard", qty: 1, price: 1500 });          // step 1: add item
      await put(cartB, user, cart);
      if (failAfterStep === 1) throw new Error("simulated crash after step 1");

      cart.items.find((i) => i.product_id === "P2").qty = 3;                                  // step 2: update qty
      await put(cartB, user, cart);
      if (failAfterStep === 2) throw new Error("simulated crash after step 2");

      await put(totalB, user, { total: cart.items.reduce((t, i) => t + i.price * i.qty, 0) }); // step 3: update total
      console.log("All 3 steps completed");
    } catch (e) {
      console.log(`Failure: ${e.message}`);
      show("State at time of failure (inconsistent)", await snapshot());
      await put(cartB, user, before.cart); await put(totalB, user, before.total);             // compensating rollback
      show("State after compensating rollback", await snapshot());
    }
  }

  console.log("--- Scenario A: success ---");
  await multiStep();
  show("Final state", await snapshot());

  await put(cartB, user, { items: [{ product_id: "P1", name: "Mouse", qty: 1, price: 500 }] });
  await put(totalB, user, { total: 500 });
  console.log("\n--- Scenario B: failure after step 2 ---");
  await multiStep({ failAfterStep: 2 });

  console.log(`
Limitations of transactions in a key-value database:
  - Riak KV guarantees atomicity only for a single key; there is no BEGIN/COMMIT/ROLLBACK across keys.
  - A crash between steps leaves partial updates (cart changed but total not), as Scenario B shows.
  - No isolation: other clients can read or write between the steps; concurrent writers can create siblings.
  - The application must provide compensation, idempotent operations, or keep related data in one key/object.
  - For strict ACID across many records, use a relational database (or a store with multi-document transactions).`);
}

// ============================================================
// 9
// ============================================================
async function q9() {
  const bucket = "users_qbd";
  const users = [
    { id: "u1", name: "Aarav", city: "Delhi", age: 21, interests: ["cricket", "coding"] },
    { id: "u2", name: "Riya", city: "Mumbai", age: 24, interests: ["music", "travel"] },
    { id: "u3", name: "Karan", city: "Delhi", age: 29, interests: ["coding", "gaming"] },
    { id: "u4", name: "Neha", city: "Pune", age: 22, interests: ["travel", "photography"] },
    { id: "u5", name: "Rohan", city: "Jaipur", age: 31, interests: ["cricket", "music"] },
    { id: "u6", name: "Simran", city: "Delhi", age: 26, interests: ["music", "coding"] },
  ];
  for (const u of users) await put(bucket, u.id, u);

  // Riak KV cannot query inside values, so the application lists keys, fetches the objects and filters them.
  async function findUsers(predicate) {
    const ks = await listKeys(bucket);
    const all = await Promise.all(ks.map(async (k) => (await get(bucket, k)).value));
    return all.filter(predicate).map((u) => u.name);
  }

  show("Users in Delhi", await findUsers((u) => u.city === "Delhi"));
  show("Users aged 22 to 26", await findUsers((u) => u.age >= 22 && u.age <= 26));
  show("Users interested in coding", await findUsers((u) => u.interests.includes("coding")));
  show("Delhi users interested in music", await findUsers((u) => u.city === "Delhi" && u.interests.includes("music")));

  console.log(`
Note: this full scan works for small data. For larger data use secondary indexes (2i, header
x-riak-index-city_bin: Delhi on PUT, then GET /buckets/users_qbd/index/city_bin/Delhi) or Riak Search.`);
}

// ============================================================
// 10
// ============================================================
async function q10() {
  /* One-time setup of a bucket type that stores Riak sets (CRDT):
       riak admin bucket-type create sets '{"props":{"datatype":"set"}}'
       riak admin bucket-type activate sets                                      */
  const { execSync } = require("child_process");
  for (const bin of ["riak admin", "riak-admin"]) {
    try {
      execSync(`${bin} bucket-type create sets '{"props":{"datatype":"set"}}'`, { stdio: "ignore" });
      execSync(`${bin} bucket-type activate sets`, { stdio: "ignore" });
      break;
    } catch (_) { /* already exists or command not found */ }
  }

  const url = (key) => `${RIAK}/types/sets/buckets/interests/datatypes/${key}`;
  const getSet = async (key) => {
    const r = await fetch(url(key));
    return r.ok ? await r.json() : { value: [], context: undefined };
  };
  const update = async (key, op) => {
    const r = await fetch(url(key), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(op) });
    if (!r.ok) throw new Error(`set update failed (${r.status}): ${await r.text()}`);
  };

  await update("aarav", { add_all: ["cricket", "coding", "music"] });                          // adding elements
  await update("riya", { add_all: ["music", "travel", "coding"] });
  show("aarav interests", (await getSet("aarav")).value);

  const a = await getSet("aarav");
  await update("aarav", { remove: "music", context: a.context });                              // removing an element
  show("aarav after removing music", (await getSet("aarav")).value);

  const aSet = (await getSet("aarav")).value, rSet = (await getSet("riya")).value;
  console.log("\nIs 'coding' in aarav's set?", aSet.includes("coding"));                      // membership
  console.log("Is 'travel' in aarav's set?", aSet.includes("travel"));
  show("Common interests of aarav and riya", aSet.filter((x) => rSet.includes(x)));            // intersection
  show("Union of interests", [...new Set([...aSet, ...rSet])]);
}

// ============================================================
// Neo4j helpers
// ============================================================
function clean(v) {
  if (v && typeof v === "object" && typeof v.toNumber === "function" && "low" in v) return v.toNumber();
  if (Array.isArray(v)) return v.map(clean);
  if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, clean(x)]));
  return v;
}
async function withNeo(fn) {
  const neo4j = require("neo4j-driver");
  const driver = neo4j.driver(NEO.url, neo4j.auth.basic(NEO.user, NEO.pass));
  const session = driver.session();
  const run = async (q, p = {}) => (await session.run(q, p)).records.map((r) => clean(r.toObject()));
  try { return await fn(run, session, driver); } finally { await session.close(); await driver.close(); }
}

// ============================================================
// 11
// ============================================================
async function q11() {
  /* Install and configure Neo4j (Ubuntu/Debian):
       sudo apt-get install neo4j        (or docker run -p7474:7474 -p7687:7687 neo4j)
       sudo systemctl start neo4j
       open http://localhost:7474  and log in (default neo4j / neo4j, then set a new password) */
  await withNeo(async (run) => {
    await run("MATCH (n) DETACH DELETE n");
    await run(`
      CREATE (cs:Department {name:'Computer Science'}), (mg:Department {name:'Management'})
      CREATE (db:Course {code:'C101', title:'NoSQL Databases'}), (ml:Course {code:'C102', title:'Machine Learning'}),
             (mk:Course {code:'C201', title:'Marketing'})
      CREATE (db)-[:OFFERED_BY]->(cs), (ml)-[:OFFERED_BY]->(cs), (mk)-[:OFFERED_BY]->(mg)
      CREATE (a:Student {id:1, name:'Aarav'}), (r:Student {id:2, name:'Riya'}), (k:Student {id:3, name:'Karan'}),
             (n:Student {id:4, name:'Neha'}), (ro:Student {id:5, name:'Rohan'})
      CREATE (a)-[:BELONGS_TO]->(cs), (r)-[:BELONGS_TO]->(cs), (k)-[:BELONGS_TO]->(cs),
             (n)-[:BELONGS_TO]->(mg), (ro)-[:BELONGS_TO]->(mg)
      CREATE (a)-[:ENROLLED_IN]->(db), (a)-[:ENROLLED_IN]->(ml), (r)-[:ENROLLED_IN]->(db),
             (k)-[:ENROLLED_IN]->(ml), (n)-[:ENROLLED_IN]->(mk), (ro)-[:ENROLLED_IN]->(mk), (ro)-[:ENROLLED_IN]->(db)`);

    show("Node counts", await run("MATCH (n) RETURN labels(n)[0] AS label, count(*) AS total ORDER BY label"));
    show("Relationship counts", await run("MATCH ()-[r]->() RETURN type(r) AS rel, count(*) AS total ORDER BY rel"));
    show("Students per course", await run(`
      MATCH (s:Student)-[:ENROLLED_IN]->(c:Course)-[:OFFERED_BY]->(d:Department)
      RETURN d.name AS department, c.title AS course, collect(s.name) AS students ORDER BY course`));
    console.log(`
Visualize: open Neo4j Browser (http://localhost:7474) and run
    MATCH p = (s:Student)-[]->(x) RETURN p
or:  MATCH (n)-[r]->(m) RETURN n, r, m
Students, courses and departments appear as connected nodes.`);
  });
}

// ============================================================
// 12
// ============================================================
async function q12() {
  await withNeo(async (run) => {
    await run("MATCH (n) DETACH DELETE n");
    await run(`
      CREATE (a:Person {name:'Aarav', age:21}), (r:Person {name:'Riya', age:24}), (k:Person {name:'Karan', age:29}),
             (n:Person {name:'Neha', age:22}), (ro:Person {name:'Rohan', age:31})
      CREATE (g:Company {name:'Google'}), (t:Company {name:'TCS'})
      CREATE (a)-[:FRIENDS_WITH]->(r), (a)-[:FRIENDS_WITH]->(k), (r)-[:FRIENDS_WITH]->(n), (k)-[:FRIENDS_WITH]->(ro)
      CREATE (r)-[:FOLLOWS]->(a), (n)-[:FOLLOWS]->(a), (ro)-[:FOLLOWS]->(a), (a)-[:FOLLOWS]->(n), (k)-[:FOLLOWS]->(r)
      CREATE (a)-[:WORKS_AT]->(g), (r)-[:WORKS_AT]->(g), (k)-[:WORKS_AT]->(t), (ro)-[:WORKS_AT]->(t)`);

    show("Friends of Aarav (direction ignored)", await run(
      "MATCH (:Person {name:$n})-[:FRIENDS_WITH]-(f:Person) RETURN f.name AS friend", { n: "Aarav" }));
    show("Followers of Aarav", await run(
      "MATCH (f:Person)-[:FOLLOWS]->(:Person {name:$n}) RETURN f.name AS follower", { n: "Aarav" }));
    show("People Aarav follows", await run(
      "MATCH (:Person {name:$n})-[:FOLLOWS]->(p:Person) RETURN p.name AS following", { n: "Aarav" }));
    show("Friends of friends of Aarav", await run(`
      MATCH (:Person {name:$n})-[:FRIENDS_WITH*2]-(fof:Person)
      WHERE fof.name <> $n RETURN DISTINCT fof.name AS friend_of_friend`, { n: "Aarav" }));
    show("Colleagues of Aarav", await run(`
      MATCH (:Person {name:$n})-[:WORKS_AT]->(c)<-[:WORKS_AT]-(o:Person)
      RETURN c.name AS company, o.name AS colleague`, { n: "Aarav" }));
    show("Follower count per person", await run(`
      MATCH (p:Person) OPTIONAL MATCH (f)-[:FOLLOWS]->(p)
      RETURN p.name AS person, count(f) AS followers ORDER BY followers DESC`));
  });
}

// ============================================================
// 13
// ============================================================
async function q13() {
  await withNeo(async (run) => {
    await run("MATCH (n) DETACH DELETE n");
    await run(`
      CREATE (el:Category {name:'Electronics'}), (ac:Category {name:'Accessories'})
      CREATE (lp:Product {id:'P1', name:'Laptop', price:50000}), (ph:Product {id:'P2', name:'Phone', price:20000}),
             (ms:Product {id:'P3', name:'Mouse', price:500}), (kb:Product {id:'P4', name:'Keyboard', price:1500})
      CREATE (lp)-[:IN_CATEGORY]->(el), (ph)-[:IN_CATEGORY]->(el), (ms)-[:IN_CATEGORY]->(ac), (kb)-[:IN_CATEGORY]->(ac)
      CREATE (c1:Customer {id:1, name:'Aarav'}), (c2:Customer {id:2, name:'Riya'}), (c3:Customer {id:3, name:'Karan'})
      CREATE (o1:Order {id:1001, date:'2026-01-10'}), (o2:Order {id:1002, date:'2026-02-12'}),
             (o3:Order {id:1003, date:'2026-03-01'}), (o4:Order {id:1004, date:'2026-03-05'})
      CREATE (c1)-[:PLACED]->(o1), (c1)-[:PLACED]->(o3), (c2)-[:PLACED]->(o2), (c3)-[:PLACED]->(o4)
      CREATE (o1)-[:CONTAINS {qty:1}]->(lp), (o1)-[:CONTAINS {qty:2}]->(ms), (o2)-[:CONTAINS {qty:1}]->(ph),
             (o3)-[:CONTAINS {qty:1}]->(kb), (o3)-[:CONTAINS {qty:1}]->(ms), (o4)-[:CONTAINS {qty:1}]->(lp)`);

    show("Products purchased by Aarav", await run(`
      MATCH (:Customer {name:$n})-[:PLACED]->(o:Order)-[c:CONTAINS]->(p:Product)
      RETURN o.id AS order, p.name AS product, c.qty AS qty, p.price AS price ORDER BY order`, { n: "Aarav" }));
    show("Total spent by each customer", await run(`
      MATCH (cu:Customer)-[:PLACED]->(:Order)-[c:CONTAINS]->(p:Product)
      RETURN cu.name AS customer, sum(c.qty * p.price) AS total_spent ORDER BY total_spent DESC`));
    show("Aarav's purchases by category", await run(`
      MATCH (:Customer {name:$n})-[:PLACED]->(:Order)-[:CONTAINS]->(p:Product)-[:IN_CATEGORY]->(cat:Category)
      RETURN cat.name AS category, collect(DISTINCT p.name) AS products`, { n: "Aarav" }));
    show("Customers who bought a Laptop", await run(`
      MATCH (cu:Customer)-[:PLACED]->(:Order)-[:CONTAINS]->(:Product {name:'Laptop'}) RETURN cu.name AS customer`));
  });
}

// ============================================================
// 14
// ============================================================
async function q14() {
  await withNeo(async (run, session) => {
    await run("MATCH (n) DETACH DELETE n");
    await run("CREATE CONSTRAINT acct_id IF NOT EXISTS FOR (a:Account) REQUIRE a.id IS UNIQUE");

    // Transaction 1: CREATE, MATCH, SET and DELETE together, then COMMIT
    const tx = session.beginTransaction();
    try {
      await tx.run("CREATE (:Account {id:'A1', owner:'Aarav', balance:1000}), (:Account {id:'A2', owner:'Riya', balance:500}), (:Account {id:'TMP', owner:'Temp', balance:0})");
      const m = await tx.run("MATCH (a:Account {id:'A1'}) RETURN a.balance AS balance");
      console.log("Inside tx, A1 balance:", clean(m.records[0].get("balance")));
      await tx.run("MATCH (a:Account {id:'A1'}), (b:Account {id:'A2'}) SET a.balance = a.balance - 300, b.balance = b.balance + 300");
      await tx.run("MATCH (t:Account {id:'TMP'}) DELETE t");
      await tx.commit();
      console.log("Transaction committed");
    } catch (e) { await tx.rollback(); console.log("Rolled back:", e.message); }
    show("After commit", await run("MATCH (a:Account) RETURN a.id AS id, a.balance AS balance ORDER BY id"));

    // Transaction 2: explicit ROLLBACK, nothing is saved
    const tx2 = session.beginTransaction();
    await tx2.run("MATCH (a:Account {id:'A1'}) SET a.balance = 0");
    await tx2.run("CREATE (:Account {id:'A3', owner:'Ghost', balance:99})");
    await tx2.rollback();
    show("After explicit rollback (unchanged)", await run("MATCH (a:Account) RETURN a.id AS id, a.balance AS balance ORDER BY id"));

    // Transaction 3: error halfway (duplicate id breaks the constraint) -> the earlier SET is undone too
    const tx3 = session.beginTransaction();
    try {
      await tx3.run("MATCH (a:Account {id:'A2'}) SET a.balance = a.balance + 1000");
      await tx3.run("CREATE (:Account {id:'A1', owner:'Duplicate', balance:1})");
      await tx3.commit();
    } catch (e) {
      console.log("\nTransaction 3 failed:", e.message.split("\n")[0]);
      try { await tx3.rollback(); } catch (_) {}
    }
    show("After failed transaction (A2 unchanged)", await run("MATCH (a:Account) RETURN a.id AS id, a.balance AS balance ORDER BY id"));

    console.log(`
How transaction management keeps the graph consistent:
  - Atomicity: all statements in a transaction commit together or none do (see transactions 2 and 3).
  - Consistency: constraints (such as unique Account.id) are checked, and a violation aborts the whole transaction.
  - Isolation: other sessions never see uncommitted changes (read-committed isolation with locks on changed nodes).
  - Durability: committed data is written to the transaction log first, so it survives a crash.
  - Availability: Neo4j clusters keep several copies of the database; a leader takes writes via Raft consensus
    and followers serve reads and take over if the leader fails.`);
  });
}

// ============================================================
// 15
// ============================================================
async function q15() {
  await withNeo(async (run) => {
    await run("MATCH (n) DETACH DELETE n");

    // ---- CRUD ----
    const createPerson = (id, name, city) => run("CREATE (:Person {id:$id, name:$name, city:$city})", { id, name, city });
    const readPerson = (name) => run("MATCH (p:Person {name:$name}) RETURN p.id AS id, p.name AS name, p.city AS city", { name });
    const updatePerson = (name, city) => run("MATCH (p:Person {name:$name}) SET p.city = $city RETURN p.name AS name, p.city AS city", { name, city });
    const deletePerson = (name) => run("MATCH (p:Person {name:$name}) DETACH DELETE p", { name });
    const connect = (a, b, rel) => run(`MATCH (x:Person {name:$a}), (y:Person {name:$b}) MERGE (x)-[:${rel}]->(y)`, { a, b });

    await createPerson(1, "Aarav", "Delhi"); await createPerson(2, "Riya", "Mumbai"); await createPerson(3, "Karan", "Delhi");
    await createPerson(4, "Neha", "Pune"); await createPerson(5, "Rohan", "Jaipur"); await createPerson(6, "Temp", "Nowhere");
    show("Read Aarav", await readPerson("Aarav"));
    show("Update Riya's city", await updatePerson("Riya", "Bengaluru"));
    await deletePerson("Temp");
    show("All people after delete", await run("MATCH (p:Person) RETURN p.name AS name ORDER BY name"));

    for (const [a, b] of [["Aarav", "Riya"], ["Riya", "Neha"], ["Aarav", "Karan"], ["Karan", "Rohan"], ["Neha", "Rohan"]]) {
      await connect(a, b, "FRIENDS_WITH"); await connect(b, a, "FRIENDS_WITH");
    }

    // ---- relationship-based queries ----
    show("Friend recommendations for Aarav (friends of friends, not yet friends)", await run(`
      MATCH (me:Person {name:'Aarav'})-[:FRIENDS_WITH]->(:Person)-[:FRIENDS_WITH]->(rec:Person)
      WHERE rec <> me AND NOT (me)-[:FRIENDS_WITH]->(rec)
      RETURN rec.name AS recommended, count(*) AS mutual_friends ORDER BY mutual_friends DESC`));
    show("Shortest path Aarav to Rohan", await run(`
      MATCH p = shortestPath((:Person {name:'Aarav'})-[:FRIENDS_WITH*]-(:Person {name:'Rohan'}))
      RETURN [n IN nodes(p) | n.name] AS path, length(p) AS hops`));

    // ---- recommendation system ----
    await run(`
      CREATE (m1:Movie {title:'Inception'}), (m2:Movie {title:'Interstellar'}), (m3:Movie {title:'Dangal'})
      WITH m1, m2, m3
      MATCH (a:Person {name:'Aarav'}), (r:Person {name:'Riya'}), (k:Person {name:'Karan'})
      CREATE (a)-[:WATCHED]->(m1), (a)-[:WATCHED]->(m2), (r)-[:WATCHED]->(m1), (r)-[:WATCHED]->(m3), (k)-[:WATCHED]->(m2)`);
    show("Movies recommended to Aarav (watched by people with similar taste)", await run(`
      MATCH (a:Person {name:'Aarav'})-[:WATCHED]->(:Movie)<-[:WATCHED]-(other:Person)-[:WATCHED]->(rec:Movie)
      WHERE NOT (a)-[:WATCHED]->(rec)
      RETURN rec.title AS recommendation, count(DISTINCT other) AS score ORDER BY score DESC`));

    // ---- fraud detection ----
    await run(`
      CREATE (d:Device {id:'DEV-9'}), (c:Card {no:'XXXX-1111'})
      WITH d, c
      MATCH (a:Person {name:'Neha'}), (b:Person {name:'Rohan'}), (k:Person {name:'Karan'})
      CREATE (a)-[:USED]->(d), (b)-[:USED]->(d), (k)-[:USED]->(d), (a)-[:OWNS]->(c), (b)-[:OWNS]->(c)`);
    show("Possible fraud rings (people sharing a device or card)", await run(`
      MATCH (p1:Person)-[:USED|OWNS]->(shared)<-[:USED|OWNS]-(p2:Person)
      WHERE id(p1) < id(p2)
      RETURN p1.name AS person1, p2.name AS person2, labels(shared)[0] AS shared_by`));

    // ---- knowledge graph ----
    await run(`
      CREATE (db:Concept {name:'Database'}), (nosql:Concept {name:'NoSQL'}), (graph:Concept {name:'Graph DB'}),
             (neo:Concept {name:'Neo4j'}), (cy:Concept {name:'Cypher'})
      CREATE (nosql)-[:IS_A]->(db), (graph)-[:IS_A]->(nosql), (neo)-[:IS_A]->(graph), (neo)-[:USES]->(cy)`);
    show("Everything Neo4j is a kind of", await run(`
      MATCH (:Concept {name:'Neo4j'})-[:IS_A*]->(c:Concept) RETURN c.name AS concept`));

    console.log(`
Why graph databases fit these tasks:
  - Relationship-based queries: relationships are stored as direct pointers (index-free adjacency), so multi-hop
    queries such as friends of friends or shortest path stay fast, whereas SQL needs expensive joins.
  - Scaling: scale up with more memory/cores, scale reads with cluster read replicas, and split very large graphs
    across databases with Neo4j Fabric/composite databases.
  - Availability: a causal cluster elects a leader using Raft; if it fails a follower takes over automatically.
  - Use cases: social networks (friend suggestions), recommendation systems (similar users/items), fraud detection
    (shared devices, cards or addresses), knowledge graphs (concepts linked by typed relationships).`);
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
