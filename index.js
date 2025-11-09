const express = require("express");
const cors = require("cors");
require("dotenv").config();
const app = express();
const port = process.env.PORT || 3000;
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const admin = require("firebase-admin");
const jwt = require("jsonwebtoken");

// index.js
const decoded = Buffer.from(process.env.FIREBASE_SERVICE_KEY, "base64").toString("utf8");
const serviceAccount = JSON.parse(decoded);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

// Middleware
app.use(cors());
app.use(express.json());

// Firebase built in Token verification with middleware

const verifyFirebaseToken = async (req, res, next) => {
  if (!req.headers.authorization) {
    return res.status(401).send({ message: "Unauthorize Access" });
  }
  const token = req.headers.authorization.split(" ")[1];
  if (!token) {
    return res.status(401).send({ message: "Unauthorize Access" });
  }
  try {
    const userInfo = await admin.auth().verifyIdToken(token);
    req.token_email = userInfo.email;
    console.log("after token validation", userInfo);
    next();
  } catch (error) {
    return res.status(401).send({ message: "Unauthorize Access" });
  }
};

// custome token generate by JWT
// const verifyJWTToken = (req, res, next) => {
//   const authorization = req.headers.authorization;
//   if (!authorization) {
//     return res.status(401).send({ message: "unauthorized access" });
//   }
//   const token = authorization.split(" ")[1];
//   if (!token) {
//     return res.status(401).send({ message: "unauthorized access" });
//   }

//   jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
//     if (err) {
//       return res.status(401).send({ message: "unauthorized access" });
//     }
//     // put it in the right place
//     console.log("after decoded", decoded);
//     req.token_email = decoded.email;
//     next();
//   });
// };

// URI
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.9sqbqr2.mongodb.net/?appName=Cluster0`;

// Connect To MongoDB
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    await client.connect();
    // await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );

    const database = client.db("smart_deals_db");

    const productsCollection = database.collection("products");
    const bidsCollection = database.collection("bids");
    const usersCollection = database.collection("users");

    // JWT related Apis
    app.post("/getToken", (req, res) => {
      const loggedUser = req.body;
      const token = jwt.sign(loggedUser, process.env.JWT_SECRET, {
        expiresIn: "1h",
      });
      res.send({ token: token });
    });

    // USER API
    app.post("/users", async (req, res) => {
      const newUser = req.body;
      const email = req.body.email;
      const query = { email: email };
      const existingUser = await usersCollection.findOne(query);

      if (existingUser) {
        res.send({ message: "user already exits." });
      } else {
        const result = await usersCollection.insertOne(newUser);
        res.send(result);
      }
    });

    // PRODUCTS API
    app.get("/products", async (req, res) => {
      const headers = req.headers
      console.log(headers)
      const cursor = productsCollection.find();
      const result = await cursor.toArray();
      res.send(result);
    });

    app.get("/products/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      console.log(query, id);
      const result = await productsCollection.findOne(query);
      res.send(result);
    });

    app.get("/latest-products", async (req, res) => {
      const cursor = productsCollection
        .find()
        .limit(6)
        .sort({ created_at: -1 });
      const result = await cursor.toArray();
      res.send(result);
    });

    app.post("/products", verifyFirebaseToken, async (req, res) => {
      const newProduct = req.body;
      const result = await productsCollection.insertOne(newProduct);
      res.send(result);
    });

    app.patch("/products/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const updatedProduct = req.body;
      const update = {
        $set: {
          name: updatedProduct.name,
          price: updatedProduct.price,
        },
      };

      const result = await productsCollection.updateOne(query, update);
      res.send(result);
    });

    app.delete("/products/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await productsCollection.deleteOne(query);
      res.send(result);
    });

    app.get("/bids", verifyFirebaseToken, async (req, res) => {
      const email = req.query.email;
      const query = {};
      if (email) {
        query.buyer_email = email;
      }

      // verify user have access to see this data
      if (email !== req.token_email) {
        return res.status(403).send({ message: "forbidden access" });
      }

      const cursor = bidsCollection.find(query);
      const result = await cursor.toArray();
      res.send(result);
    });

    // Bid Related API

    app.post("/bids", async (req, res) => {
      const newBid = req.body;
      const result = await bidsCollection.insertOne(newBid);
      res.send(result);
    });

    app.get(
      "/products/bids/:productId",
      verifyFirebaseToken,
      async (req, res) => {
        const productId = req.params.productId;
        const query = { product: productId };
        const cursor = bidsCollection.find(query);
        const result = await cursor.toArray();
        res.send(result);
      }
    );

    app.delete("/bids/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await bidsCollection.deleteOne(query);
      res.send(result);
    });
  } finally {
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Smart Deal Server is Running");
});

app.listen(port, () => {
  console.log("Server is running");
});
