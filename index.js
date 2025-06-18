import express from'express';
import mongoose from'mongoose';
import authRoutes from './routes/authRoute.js'
import shopRoutes from './routes/shopRoutes.js'

import dotenv from 'dotenv';


dotenv.config();
const app = express();
app.use(express.json());

app.get("/", (req, res) => {
  res.send("Hello, Node.js Project!");
});
app.use('/auth',authRoutes);
app.use('/shop',shopRoutes);


mongoose.connect(process.env.MONGO_URI)
.then(() => app.listen(process.env.PORT, () => console.log(`Server running on port ${process.env.PORT}`)))
.catch(err => console.log(err));
console.log("MONGO_URI:", process.env.MONGO_URI);
console.log("PORT:", process.env.PORT);
