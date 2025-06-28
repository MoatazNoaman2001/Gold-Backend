import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema({
    sender: {
        type: mongoose.Schema.Types.ObjectId,
        ref : "User",
        required : true
    },
    receiver: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    content: {
        type: String,
        required: true
      },
      read: {
        type: Boolean,
        default: false
      },
      product: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Product"
      }
    }, {
      timestamps: true
    }
);


const conversationSchema = new mongoose.Schema({
    participants: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    }],
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product"
    },
    lastMessage: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Message"
    }
  }, {
    timestamps: true
  });
  
  const Message = mongoose.model("Message", messageSchema);
  const Conversation = mongoose.model("Conversation", conversationSchema);
  
  export { Message, Conversation };