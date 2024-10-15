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
        const user = await userDb.findOne({ email: email });
        if (!user) {
          return res.status(404).json({ error: "User not found" });
        }
        res.json(user);
      } catch (error) {
        console.error("Error fetching user from database:", error);
        res.status(500).json({ error: "Error fetching user from database" });
      }
    });

    // --- 'Notepad' api
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
          res.status(200).json(existingUser);
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
      const email = note.email;

      try {
        const existingUser = await userDb.findOne({ email: email });
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
          { email: email },
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
      const {
        uid,
        content: newContent,
        title: newTitle,
        email,
      } = req.body.note;
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
            email: email,
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
        const existingUser = await userDb.findOne({ email: email });
        if (!existingUser) {
          return res.status(404).json({ message: "User not found" });
        }

        // Update the note with isDeleted: true
        const result = await userDb.updateOne(
          {
            email: email,
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

        res.status(200).json(result);
      } catch (error) {
        console.error("Error marking note as deleted in database:", error);
        res
          .status(500)
          .json({ error: "Error marking note as deleted in database" });
      }
    });

    // --- "Todo List" api here
    // --- add todo
    app.post("/api/v1/addTodo", async (req, res) => {
      const { todo } = req.body;
      console.log("🚀 ~ app.post ~ req.body:", req.body);
      const email = todo.email;

      try {
        const existingUser = await userDb.findOne({ email: email });
        if (!existingUser) {
          return res.status(404).json({ message: "User not found" });
        }

        // Create a new todo object with createdAt and updatedAt timestamps
        const newTodo = {
          text: todo.text,
          completed: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        // Update the user document by adding the new todo to the todos array
        const result = await userDb.updateOne(
          { email: email },
          {
            $push: { todos: newTodo },
          }
        );

        res.status(201).json({
          message: "Todo created successfully",
        });
      } catch (error) {
        console.error("Error saving todo to database:", error);
        res.status(500).json({ error: "Error saving todo to database" });
      }
    });

    // --- edit a todo
    app.put("/api/v1/editTodo", async (req, res) => {
      const {
        createdAt,
        text: newText,
        completed: newCompleted,
        email,
      } = req.body.todo;

      if (!email || !createdAt) {
        return res
          .status(400)
          .json({ message: "Email and createdAt are required" });
      }

      try {
        // Prepare update object
        const updateObj = { "todos.$.updatedAt": new Date() };
        if (newText) updateObj["todos.$.text"] = newText;
        if (typeof newCompleted === "boolean")
          updateObj["todos.$.completed"] = newCompleted;

        // If no updates are provided, return early
        if (Object.keys(updateObj).length === 1) {
          return res.status(400).json({ message: "No changes provided" });
        }
        const result = await userDb.updateOne(
          { email, "todos.createdAt": new Date(createdAt) },
          { $set: updateObj }
        );
        if (result.modifiedCount === 0) {
          return res
            .status(404)
            .json({ message: "Todo not found or already deleted" });
        }

        res.status(200).json({ message: "Todo updated successfully" });
      } catch (error) {
        console.error("Error updating todo in database:", error);
        res.status(500).json({ error: "Error updating todo in database" });
      }
    });

    // --- delete a todo
    app.delete("/api/v1/deleteTodo", async (req, res) => {
      const { createdAt, email } = req.body;

      try {
        const existingUser = await userDb.findOne({ email: email });
        if (!existingUser) {
          return res.status(404).json({ message: "User not found" });
        }

        // Update the todo with isDeleted: true
        const result = await userDb.updateOne(
          {
            email: email,
            "todos.createdAt": new Date(createdAt),
          },
          {
            $set: {
              "todos.$.isDeleted": true,
              "todos.$.updatedAt": new Date(),
            },
          }
        );

        if (result.modifiedCount === 0) {
          return res.status(404).json({ message: "Todo not found" });
        }

        res.status(200).json({
          message: "Todo marked as deleted successfully",
        });
      } catch (error) {
        console.error("Error marking todo as deleted in database:", error);
        res
          .status(500)
          .json({ error: "Error marking todo as deleted in database" });
      }
    });

    /* ----------------------------------------------------
                  --- "Finance Tracker" api ---
    ---------------------------------------------------- */

    app.post("/api/v1/addTransaction", async (req, res) => {
      const { email, monthName, transaction } = req.body;

      try {
        const newTransaction = {
          _id: new ObjectId(),
          type: transaction.type,
          amount: transaction.amount,
          date: new Date().toISOString(),
        };

        const updateResult = await userDb.findOneAndUpdate(
          { email: email, "financeTracker.name": monthName },
          {
            $push: { "financeTracker.$.transactions": newTransaction },
            $inc: {
              "financeTracker.$.income":
                transaction.type === "income" ? transaction.amount : 0,
              "financeTracker.$.expenses":
                transaction.type === "expenses" ? transaction.amount : 0,
            },
          },
          { returnDocument: "after" }
        );

        if (!updateResult.value) {
          // Month doesn't exist, so we need to add a new month entry
          const newMonthData = {
            name: monthName,
            income: transaction.type === "income" ? transaction.amount : 0,
            expenses: transaction.type === "expenses" ? transaction.amount : 0,
            savings:
              transaction.type === "income"
                ? transaction.amount
                : -transaction.amount,
            transactions: [newTransaction],
          };

          await userDb.updateOne(
            { email: email },
            { $push: { financeTracker: newMonthData } }
          );
        }

        // Fetch the updated user data
        const updatedUser = await userDb.findOne({ email: email });

        if (!updatedUser) {
          return res.status(404).json({ message: "User not found" });
        }

        // Calculate savings for each month
        updatedUser.financeTracker = updatedUser.financeTracker.map(
          (month) => ({
            ...month,
            savings: month.income - month.expenses,
          })
        );

        await userDb.updateOne(
          { email: email },
          { $set: { financeTracker: updatedUser.financeTracker } }
        );

        res.status(201).json({
          message: "Transaction added successfully",
          updatedFinancialData: updatedUser.financeTracker,
        });
      } catch (error) {
        console.error("Error adding transaction:", error);
        res.status(500).json({ error: "Error adding transaction" });
      }
    });

    // --- Edit a transaction
    app.put("/api/v1/editTransaction", async (req, res) => {
      const { email, monthName, transactionId, updatedTransaction } = req.body;
      console.log("🚀 ~ app.put ~ req.body:", req.body);

      try {
        // Find the user and the specific transaction
        const user = await userDb.findOne({
          email: email,
          "financeTracker.name": monthName,
          "financeTracker.transactions._id": new ObjectId(transactionId),
        });

        if (!user) {
          return res
            .status(404)
            .json({ message: "User, month, or transaction not found" });
        }

        // Find the specific month and transaction
        const monthIndex = user.financeTracker.findIndex(
          (m) => m.name === monthName
        );
        const transactionIndex = user.financeTracker[
          monthIndex
        ].transactions.findIndex((t) => t._id.toString() === transactionId);

        const oldTransaction =
          user.financeTracker[monthIndex].transactions[transactionIndex];

        // Calculate the differences
        const incomeDiff =
          updatedTransaction.type === "income"
            ? updatedTransaction.amount -
              (oldTransaction.type === "income" ? oldTransaction.amount : 0)
            : -(oldTransaction.type === "income" ? oldTransaction.amount : 0);

        const expensesDiff =
          updatedTransaction.type === "expenses"
            ? updatedTransaction.amount -
              (oldTransaction.type === "expenses" ? oldTransaction.amount : 0)
            : -(oldTransaction.type === "expenses" ? oldTransaction.amount : 0);

        // Update the transaction and month totals
        const updateResult = await userDb.updateOne(
          {
            email: email,
            "financeTracker.name": monthName,
            "financeTracker.transactions._id": new ObjectId(transactionId),
          },
          {
            $set: {
              "financeTracker.$.transactions.$[trans].type":
                updatedTransaction.type,
              "financeTracker.$.transactions.$[trans].amount":
                updatedTransaction.amount,
              "financeTracker.$.transactions.$[trans].date":
                new Date().toISOString(),
            },
            $inc: {
              "financeTracker.$.income": incomeDiff,
              "financeTracker.$.expenses": expensesDiff,
            },
          },
          {
            arrayFilters: [{ "trans._id": new ObjectId(transactionId) }],
          }
        );

        if (updateResult.modifiedCount === 0) {
          return res
            .status(404)
            .json({ message: "Transaction not found or no changes made" });
        }

        // Fetch the updated user data
        const updatedUser = await userDb.findOne({ email: email });

        // Recalculate savings for the updated month
        updatedUser.financeTracker = updatedUser.financeTracker.map(
          (month) => ({
            ...month,
            savings: month.income - month.expenses,
          })
        );

        await userDb.updateOne(
          { email: email },
          { $set: { financeTracker: updatedUser.financeTracker } }
        );

        res.status(200).json({
          message: "Transaction updated successfully",
          updatedFinancialData: updatedUser.financeTracker,
        });
      } catch (error) {
        console.error("Error updating transaction:", error);
        res.status(500).json({ error: "Error updating transaction" });
      }
    });

    // --- Delete a transaction
    app.delete("/api/v1/deleteTransaction", async (req, res) => {
      const { email, monthName, transactionId } = req.body;
      console.log("🚀 ~ app.delete ~ req.body:", req.body);

      try {
        // Find the user and the specific transaction
        const user = await userDb.findOne({
          email: email,
          "financeTracker.name": monthName,
          "financeTracker.transactions._id": new ObjectId(transactionId),
        });

        if (!user) {
          return res
            .status(404)
            .json({ message: "User, month, or transaction not found" });
        }

        // Find the specific month and transaction
        const monthIndex = user.financeTracker.findIndex(
          (m) => m.name === monthName
        );
        const transaction = user.financeTracker[monthIndex].transactions.find(
          (t) => t._id.toString() === transactionId
        );

        if (!transaction) {
          return res.status(404).json({ message: "Transaction not found" });
        }

        // Calculate the adjustments needed
        const incomeAdjustment =
          transaction.type === "income" ? -transaction.amount : 0;
        const expensesAdjustment =
          transaction.type === "expenses" ? -transaction.amount : 0;

        // Remove the transaction and update month totals
        const updateResult = await userDb.updateOne(
          { email: email, "financeTracker.name": monthName },
          {
            $pull: {
              "financeTracker.$.transactions": {
                _id: new ObjectId(transactionId),
              },
            },
            $inc: {
              "financeTracker.$.income": incomeAdjustment,
              "financeTracker.$.expenses": expensesAdjustment,
            },
          }
        );

        if (updateResult.modifiedCount === 0) {
          return res
            .status(404)
            .json({ message: "Transaction not found or already deleted" });
        }

        // Fetch the updated user data
        const updatedUser = await userDb.findOne({ email: email });

        // Recalculate savings for all months
        updatedUser.financeTracker = updatedUser.financeTracker.map(
          (month) => ({
            ...month,
            savings: month.income - month.expenses,
          })
        );

        await userDb.updateOne(
          { email: email },
          { $set: { financeTracker: updatedUser.financeTracker } }
        );

        res.status(200).json({
          message: "Transaction deleted successfully",
          updatedFinancialData: updatedUser.financeTracker,
        });
      } catch (error) {
        console.error("Error deleting transaction:", error);
        res.status(500).json({ error: "Error deleting transaction" });
      }
    });

    /* ----------------------------------------------------
                  --- "Habit Tracker" api ---
    ---------------------------------------------------- */

    // --- Add Habit
    app.post("/api/v1/addHabit", async (req, res) => {
      const { habit } = req.body;
      console.log("🚀 ~ app.post ~ req.body:", req.body)
      const email = habit.email;

      try {
        const existingUser = await userDb.findOne({ email: email });
        if (!existingUser) {
          return res.status(404).json({ message: "User not found" });
        }

        // Create a new habit object
        const newHabit = {
          id: new Date(),
          name: habit.name,
          completed : habit.completed, 
          createdAt: new Date(),
        };

        // Update the user document by adding the new habit to the habits array
        await userDb.updateOne(
          { email: email },
          { $push: { habits: newHabit } }
        );

        res.status(201).json({ message: "Habit added successfully" });
      } catch (error) {
        console.error("Error adding habit to database:", error);
        res.status(500).json({ error: "Error adding habit to database" });
      }
    });

    // --- Delete Habit
    app.post("/api/v1/deleteHabit", async (req, res) => {
      const { email, habitId } = req.body;
      console.log("🚀 ~ app.post ~ req.body:", req.body)
    
      try {
        const existingUser = await userDb.findOne({ email });
        if (!existingUser) {
          return res.status(404).json({ message: "User not found" });
        }
    
        // Remove the habit by habitId
        const result = await userDb.updateOne(
          { email },
          { $pull: { habits: { id : new Date(habitId) } } }
        );
    
        res.status(200).json({ message: "Habit deleted successfully" });
      } catch (error) {
        console.error("Error deleting habit:", error);
        res.status(500).json({ error: "Error deleting habit" });
      }
    });
    

    // --- Toggle Habit Completion for a Date
    app.post("/api/v1/toggleHabit", async (req, res) => {
      const { email, habitId, date, completed } = req.body;
      console.log("🚀 ~ app.post ~ req.body:", req.body)
    
      try {
        const existingUser = await userDb.findOne({ email });
        if (!existingUser) {
          return res.status(404).json({ message: "User not found" });
        }
    
        // Update the specific day's completion status in the habits array
        const result = await userDb.updateOne(
          { email, "habits.id": new  Date(habitId) },
          { $set: { [`habits.$.days.${date}`]: { completed } } }
        );
    
        res.status(200).json({ message: "Habit status updated successfully" });
      } catch (error) {
        console.error("Error updating habit:", error);
        res.status(500).json({ error: "Error updating habit" });
      }
    });
    

    // --- Fetch Habits and History
    app.get("/api/v1/getHabits", async (req, res) => {
      const { email } = req.query;

      try {
        const user = await userDb.findOne({ email: email });
        if (!user) {
          return res.status(404).json({ message: "User not found" });
        }

        res.status(200).json({
          habits: user.habits,
          habitHistory: user.habitHistory,
        });
      } catch (error) {
        console.error("Error fetching habits from database:", error);
        res.status(500).json({ error: "Error fetching habits from database" });
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
