import express from'express';
import mongoose from'mongoose';
import authRoutes from './routes/authRoute.js'
import dotenv from 'dotenv';


dotenv.config();
const app = express();
app.use(express.json());

app.get("/", (req, res) => {
  res.send("Hello, Node.js Project!");
});
app.use('/auth',authRoutes);


mongoose.connect(process.env.MONGO_URL)
.then(() => app.listen(process.env.PORT, () => console.log('Server running on port 3000')))
.catch(err => console.log(err));
