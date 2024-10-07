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

    //  --- getting user
    app.get("/api/v1/users", async (req, res) => {
      const email = req.query.email;
      try {
        const user = await userDb.findOne({ "email": email });
        if (!user) {
          return res.status(404).json({ error: "User not found" });
        }
        res.json(user);
      } catch (error) {
        console.error("Error fetching user from database:", error);
        res.status(500).json({ error: "Error fetching user from database" });
      }
    });

    // --- add user to mongodb
    app.post("/api/v1/addUserToDB", async (req, res) => {
      const { user: userInfo } = req.body;
      
      const userEmail = userInfo?.email || userInfo?.user?.email;

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

    // --- add note
    app.post("/api/v1/addNote", async (req, res) => {
      const { note } = req.body;
      console.log("🚀 ~ app.post ~ req.body:", req.body)
      const email = note.email;
      console.log("🚀 ~ app.post ~ email:", email)

      try {
        const existingUser = await userDb.findOne({ "email": email });
        if (!existingUser) {
          return res.status(404).json({ message: "User  not found" });
        }

        // Create a new note object with createdAt and updatedAt timestamps
        const newNote = {
          title: note.title,
          description: note.content,
          color: note.color,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        // Update the user document by adding the new note to the notes array
        const result = await userDb.updateOne(
          { "email": email },
          {
            $push: { notes: newNote },
          }
        );

        res.status(201).json({
          message: "Note created successfully",
        });
      } catch (error) {
        console.error("Error saving note to database:", error);
        res.status(500).json({ error: "Error saving note to database" });
      }
    });

    // --- edit a note
    app.put("/api/v1/editNote", async (req, res) => {
      const { createdAt } = req.body;
      const { uid, content: newContent, title: newTitle , email } = req.body.note;
      try {
        // Validate input
        if (!newContent && !newTitle) {
          return res.status(400).json({ message: "No changes provided" });
        }

        // Prepare update object
        const updateObj = {
          "notes.$.updatedAt": new Date(),
        };
        if (newContent) updateObj["notes.$.description"] = newContent;
        if (newTitle) updateObj["notes.$.title"] = newTitle;

        const result = await userDb.updateOne(
          {
            "email": email,
            "notes.createdAt": new Date(createdAt),
            // "notes.isDeleted": { $ne: true } // Ensure we're not editing a deleted note
          },
          {
            $set: updateObj,
          }
        );

        if (result.modifiedCount === 0) {
          return res
            .status(404)
            .json({ message: "Note not found or already deleted" });
        }

        res.status(200).json({
          message: "Note updated successfully",
        });
      } catch (error) {
        console.error("Error updating note in database:", error);
        res.status(500).json({ error: "Error updating note in database" });
      }
    });

    // --- delete a note
    app.delete("/api/v1/deleteNote", async (req, res) => {
      const { uid, createdAt, email } = req.body;

      try {
        const existingUser = await userDb.findOne({ "email": email });
        if (!existingUser) {
          return res.status(404).json({ message: "User not found" });
        }

        // Update the note with isDeleted: true
        const result = await userDb.updateOne(
          {
            "email": email,
            "notes.createdAt": new Date(createdAt),
          },
          {
            $set: {
              "notes.$.isDeleted": true,
              "notes.$.updatedAt": new Date(),
            },
          }
        );

        if (result.modifiedCount === 0) {
          return res.status(404).json({ message: "Note not found" });
        }

        res.status(200).json({
          message: "Note marked as deleted successfully",
        });
      } catch (error) {
        console.error("Error marking note as deleted in database:", error);
        res
          .status(500)
          .json({ error: "Error marking note as deleted in database" });
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
