require("dotenv").config();
const express = require("express");
const app = express();
const port = 2500;
const cors = require("cors");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

app.use(cors());
app.use(express.json());

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const uri = process.env.MONGODB_URI;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    const userDb = client.db("Daily_Apps").collection("users");
    const productDb = client.db("Pharmasia").collection("products");

    // --- add user to mongodb
    app.post("/api/v1/addUserToDB", async (req, res) => {
      const { user: userInfo } = req.body;
      const userEmail = userInfo.email || userInfo.user.email ;
      
      try {
        const existingUser = await userDb.findOne({ email: userEmail });
    
        if (existingUser) {
          // Update existing user
          const result = await userDb.updateOne(
            { email: userEmail },
            {
              $set: {
                userInfo,
                updatedAt: new Date(),
              },
            }
          );
          res.status(200).json({
            message: "User updated successfully",
            userId: existingUser._id,
          });
        } else {
          // Insert new user
          const result = await userDb.insertOne({
            email: userEmail,
            userInfo,
            createdAt: new Date(),
            updatedAt: new Date(),
          });
          res.status(201).json({
            message: "User created successfully",
            userId: result.insertedId,
          });
        }
      } catch (error) {
        console.error("Error saving user to database:", error);
        res.status(500).json({ error: "Error saving user to database" });
      }
    });


  } finally {
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Server running successfully !");
});

app.listen(process.env.PORT, () => {
  console.log(`Listening from ${port}`);
});
