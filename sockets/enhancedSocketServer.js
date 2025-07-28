// import { Server } from "socket.io";
// import multer from "multer";
// import jwt from "jsonwebtoken";
// import { v4 as uuidv4 } from "uuid";
// import { MediaProcessorService } from "../Infrastructure/Services/MediaProcessorService.js";
// import { LocalStorageService } from "../Infrastructure/Services/StorageService.js";
// import { MongoMediaRepository } from "../Infrastructure/Repositories/MongoMediaRepository.js";
// import { UploadMediaUseCase } from "../Application/UseCases/UploadMediaUseCase.js";
// import { SendMediaMessageUseCase } from "../Application/UseCases/SendMediaMessageUseCase.js";
// import User from "../models/userModel.js";
// import { Message, Conversation } from "../models/chatModel.js";
// import {
//   SOCKET_SECURITY_CONFIG,
//   sanitizeInput,
//   RateLimiter,
//   SecurityLogger,
//   ConnectionMonitor
// } from "../utils/socketSecurity.js";
// import { validateMediaFile, generateThumbnail } from "../utils/mediaUtils.js";

// const MEDIA_CONFIG = {
//   MAX_FILE_SIZE: 100 * 1024 * 1024,
//   ALLOWED_TYPES: {
//     image: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
//     video: ['video/mp4', 'video/mpeg', 'video/quicktime', 'video/webm'],
//     audio: ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/mp4', 'audio/webm']
//   },
//   MAX_AUDIO_DURATION: 300,
//   MAX_VIDEO_DURATION: 600
// };

// const upload = multer({
//   storage: multer.memoryStorage(),
//   limits: {
//     fileSize: MEDIA_CONFIG.MAX_FILE_SIZE
//   },
//   fileFilter: (req, file, cb) => {
//     const allowedTypes = [
//       ...MEDIA_CONFIG.ALLOWED_TYPES.image,
//       ...MEDIA_CONFIG.ALLOWED_TYPES.audio,
//       ...MEDIA_CONFIG.ALLOWED_TYPES.video
//     ];
    
//     if (allowedTypes.includes(file.mimetype)) {
//       cb(null, true);
//     } else {
//       cb(new Error(`File type ${file.mimetype} not allowed`));
//     }
//   }
// });

// let io;
// const rateLimiter = new RateLimiter();
// const connectionMonitor = new ConnectionMonitor();

// function checkRateLimit(userId, action) {
//   const limits = {
//     'createShopConversation': { max: 10, window: 60000 },
//     'createConversation': { max: 10, window: 60000 },
//     'sendMessage': { max: 50, window: 60000 },
//     'sendMediaMessage': { max: 20, window: 60000 },
//     'joinConversation': { max: 20, window: 60000 },
//     'getMessages': { max: 100, window: 60000 },
//     'markAsRead': { max: 100, window: 60000 },
//     'sendTypingIndicator': { max: 200, window: 60000 },
//     'getShopConversations': { max: 50, window: 60000 },
//     'getConversations': {max: 100, window: 60000},
//     'uploadMedia': { max: 15, window: 60000 },
//     'uploadChunk': { max: 100, window: 60000 },
//     'startVoiceRecording': { max: 10, window: 60000 },
//     'voiceChunk': { max: 500, window: 60000 },
//     'finishVoiceRecording': { max: 10, window: 60000 }
//   };

//   return rateLimiter.isAllowed(
//     userId,
//     action,
//     limits[action]?.max || 10,
//     limits[action]?.window || 60000
//   );
// }

// setInterval(() => {
//   rateLimiter.cleanup();
// }, 60000);

// async function authenticateToken(token) {
//   try {
//     const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
//     // console.log(`Token decoded:`, { userId: decoded.id, exp: decoded.exp });

//     const user = await User.findById(decoded.id);
//     if (!user) {
//     //   console.log(`User not found for ID: ${decoded.id}`);
//       return null;
//     }

//     console.log(`User authenticated:`, {
//       id: user._id,
//       email: user.email,
//       role: user.role,
//     });

//     return user;
//   } catch (err) {
//     console.log(`Token verification error:`, err.message);
//     return null;
//   }
// }

// export const initializeEnhancedChatSocket = (server) => {
//   const mediaProcessor = new MediaProcessorService();
//   const storageService = new LocalStorageService();
//   const mediaRepository = new MongoMediaRepository();
  
//   const uploadMediaUseCase = new UploadMediaUseCase(
//     mediaRepository,
//     mediaProcessor,
//     storageService
//   );
  
//   const sendMediaMessageUseCase = new SendMediaMessageUseCase(
//     uploadMediaUseCase,
//     mediaRepository,
//     {
//       publish: async (event, data) => {
//         io.emit(event, data);
//       }
//     }
//   );

//   io = new Server(server, {
//     cors: {
//       origin: true,
//       methods: ["GET", "POST"],
//       credentials: true
//     },
//     maxHttpBufferSize: MEDIA_CONFIG.MAX_FILE_SIZE,
//     transports: ["websocket", "polling"],
//     allowUpgrades: true,
//     pingTimeout: 60000,
//     pingInterval: 25000,
//     allowRequest: async (req, callback) => {
//       try {
//         const token = req.headers.authorization?.split(' ')[1] ||
//           req._query?.token ||
//           req.cookies?.jwt;
//         if (!token) return callback("No token provided", false);

//         let decoded;
//         try {
//           decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
//         } catch (err) {
//           if (err.name === 'TokenExpiredError') {
//             const refreshToken = req.cookies?.jwt;
//             if (!refreshToken) return callback("No refresh token provided", false);

//             const refreshDecoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
//             const user = await User.findById(refreshDecoded.id);
//             if (!user || user.refreshToken !== refreshToken) {
//               return callback("Invalid refresh token", false);
//             }

//             decoded = { id: user._id };
//             const newAccessToken = jwt.sign(
//               { id: user._id, email: user.email, role: user.role },
//               process.env.JWT_ACCESS_SECRET,
//               { expiresIn: '15m' }
//             );
//             req.newAccessToken = newAccessToken;
//           } else {
//             return callback(`Authentication error: ${err.message}`, false);
//           }
//         }

//         const user = await User.findById(decoded.id);
//         if (!user) return callback("User not found", false);

//         req.user = user;
//         callback(null, true);
//       } catch (err) {
//         callback(`Authentication error: ${err.message}`, false);
//       }
//     }
//   });

//   io.use(async (socket, next) => {
//     try {
//       let token = null;
      
//       if (socket.handshake.query.token) {
//         token = socket.handshake.query.token;
//       }
      
//       if (!token && socket.handshake.auth.token) {
//         token = socket.handshake.auth.token;
//       }
      
//       if (!token && socket.handshake.headers.authorization) {
//         const authHeader = socket.handshake.headers.authorization;
//         if (authHeader.startsWith('Bearer ')) {
//           token = authHeader.substring(7);
//         }
//       }
      
//       if (!token && socket.handshake.headers['x-auth-token']) {
//         token = socket.handshake.headers['x-auth-token'];
//       }
      
//       if (!token && socket.handshake.headers.cookie) {
//         try {
//           const cookies = socket.handshake.headers.cookie.split(';');
//           for (const cookie of cookies) {
//             const [name, value] = cookie.trim().split('=');
//             if (name === 'jwt') {
//               token = value;
//               break;
//             }
//           }
//         } catch (cookieError) {
//           console.log('Error parsing cookies:', cookieError.message);
//         }
//       }
      
//       if (!token) {
//         console.log('No token found in any location');
//         return next(new Error('No authentication token provided'));
//       }

//       const user = await authenticateToken(token);
//       if (!user) {
//         return next(new Error('Invalid token'));
//       }
      
//       socket.user = user;
//       console.log('Authentication successful for user:', user.email);

//       const req = socket.request;
//       if (req && req.newAccessToken) {
//         socket.emit("newAccessToken", req.newAccessToken);
//       }

//       next();
      
//     } catch (error) {
//       console.error('Authentication error:', error.message);
//       next(new Error('Authentication failed: ' + error.message));
//     }
//   });

//   io.on("connection", (socket) => {
//     const user = socket.user;
//     console.log(`Enhanced chat connected: ${user?.email}`);

//     if (user) {
//       socket.join(user._id.toString());
//     }

//     socket.on("sendMediaMessage", async (data, callback) => {
//       try {
//         if (!checkRateLimit(user._id.toString(), 'sendMediaMessage')) {
//           return callback({ 
//             status: "error", 
//             message: "Rate limit exceeded. Please wait before sending another media message." 
//           });
//         }

//         const { 
//           conversationId, 
//           receiverId, 
//           type,
//           fileData,
//           fileName,
//           mimeType,
//           fileSize
//         } = data;

//         // console.log(`sendMediaMessage: ${JSON.stringify(data)}`);

//         if (!conversationId || !receiverId || !type || !fileData) {
//           return callback({ 
//             status: "error", 
//             message: "Missing required fields" 
//           });
//         }

//         if (!SOCKET_SECURITY_CONFIG.OBJECT_ID_PATTERN.test(conversationId)) {
//           return callback({ status: "error", message: "Invalid conversation ID format" });
//         }

//         if (!SOCKET_SECURITY_CONFIG.OBJECT_ID_PATTERN.test(receiverId)) {
//           return callback({ status: "error", message: "Invalid receiver ID format" });
//         }

//         const conversation = await Conversation.findById(conversationId);
//         if (!conversation || !conversation.participants.some(p => p._id.equals(user._id))) {
//           return callback({ 
//             status: "error", 
//             message: "Not authorized to send media to this conversation" 
//           });
//         }

//         let buffer;
//         if (typeof fileData === 'string' && fileData.startsWith('data:')) {
//           const base64Data = fileData.split(',')[1];
//           buffer = Buffer.from(base64Data, 'base64');
//         } else if (Buffer.isBuffer(fileData)) {
//           buffer = fileData;
//         } else {
//           return callback({ 
//             status: "error", 
//             message: "Invalid file data format" 
//           });
//         }

//         const file = {
//           buffer,
//           originalname: fileName,
//           mimetype: mimeType,
//           size: fileSize || buffer.length
//         };

//         const message = await sendMediaMessageUseCase.execute({
//           file,
//           senderId: user._id,
//           receiverId,
//           conversationId,
//           type
//         });

//         io.to(receiverId).emit("newMediaMessage", {
//           message,
//           type: "media"
//         });

//         socket.emit("mediaMessageSent", {
//           tempId: data.tempId,
//           message
//         });

//         callback({ 
//           status: "success", 
//           message: "Media message sent successfully",
//           messageId: message._id
//         });

//       } catch (error) {
//         console.error('Media message error:', error);
//         callback({ 
//           status: "error", 
//           message: error.message 
//         });
//       }
//     });
//     socket.on("uploadChunk", async (data, callback) => {
//       try {
//         if (!checkRateLimit(user._id.toString(), 'uploadChunk')) {
//           return callback({ 
//             status: "error", 
//             message: "Rate limit exceeded. Please wait before uploading another chunk." 
//           });
//         }

//         const { 
//           uploadId,
//           chunkIndex,
//           totalChunks,
//           chunk,
//           fileName,
//           mimeType,
//           conversationId,
//           receiverId,
//           type
//         } = data;

//         if (!uploadId || chunkIndex === undefined || !totalChunks || !chunk) {
//           return callback({ 
//             status: "error", 
//             message: "Missing required chunk data" 
//           });
//         }

//         const chunkKey = `${uploadId}_${chunkIndex}`;
//         await storageService.save(
//           `temp/chunks/${chunkKey}`, 
//           Buffer.from(chunk, 'base64')
//         );

//         const receivedChunks = await getReceivedChunks(uploadId, totalChunks);
        
//         if (receivedChunks === totalChunks) {
//           const completeFile = await reassembleFile(uploadId, totalChunks, fileName);
          
//           const message = await sendMediaMessageUseCase.execute({
//             file: completeFile,
//             senderId: user._id,
//             receiverId,
//             conversationId,
//             type
//           });

//           await cleanupChunks(uploadId, totalChunks);

//           io.to(receiverId).emit("newMediaMessage", { message, type: "media" });
//           socket.emit("uploadComplete", { uploadId, message });
//         }

//         callback({ 
//           status: "success", 
//           chunksReceived: receivedChunks,
//           totalChunks 
//         });

//       } catch (error) {
//         console.error('Chunk upload error:', error);
//         callback({ status: "error", message: error.message });
//       }
//     });

//     socket.on("startVoiceRecording", async (data, callback) => {
//       try {
//         if (!checkRateLimit(user._id.toString(), 'startVoiceRecording')) {
//           return callback({ 
//             status: "error", 
//             message: "Rate limit exceeded. Please wait before starting another recording." 
//           });
//         }

//         const { conversationId, receiverId } = data;
        
//         if (!conversationId || !receiverId) {
//           return callback({ 
//             status: "error", 
//             message: "Conversation ID and receiver ID are required" 
//           });
//         }

//         if (!SOCKET_SECURITY_CONFIG.OBJECT_ID_PATTERN.test(conversationId)) {
//           return callback({ status: "error", message: "Invalid conversation ID format" });
//         }

//         if (!SOCKET_SECURITY_CONFIG.OBJECT_ID_PATTERN.test(receiverId)) {
//           return callback({ status: "error", message: "Invalid receiver ID format" });
//         }

//         const recordingId = uuidv4();
        
//         io.to(receiverId).emit("voiceRecordingStarted", {
//           senderId: user._id,
//           senderName: user.name,
//           conversationId,
//           recordingId
//         });

//         callback({ 
//           status: "success", 
//           recordingId 
//         });
//       } catch (error) {
//         callback({ status: "error", message: error.message });
//       }
//     });

//     socket.on("voiceChunk", async (data) => {
//       try {
//         if (!checkRateLimit(user._id.toString(), 'voiceChunk')) {
//           return;
//         }

//         const { recordingId, chunk, conversationId, receiverId } = data;
        
//         if (!recordingId || !chunk) {
//           return;
//         }
        
//         await storageService.save(
//           `temp/voice/${recordingId}_${Date.now()}.webm`,
//           Buffer.from(chunk, 'base64')
//         );
        
//         io.to(receiverId).emit("liveVoiceChunk", {
//           recordingId,
//           chunk,
//           senderId: user._id
//         });
//       } catch (error) {
//         console.error('Voice chunk error:', error);
//       }
//     });

//     socket.on("finishVoiceRecording", async (data, callback) => {
//       try {
//         if (!checkRateLimit(user._id.toString(), 'finishVoiceRecording')) {
//           return callback({ 
//             status: "error", 
//             message: "Rate limit exceeded. Please wait before finishing another recording." 
//           });
//         }

//         const { recordingId, conversationId, receiverId } = data;
        
//         if (!recordingId || !conversationId || !receiverId) {
//           return callback({ 
//             status: "error", 
//             message: "Recording ID, conversation ID, and receiver ID are required" 
//           });
//         }
        
//         const voiceFile = await combineVoiceChunks(recordingId);
        
//         const message = await sendMediaMessageUseCase.execute({
//           file: voiceFile,
//           senderId: user._id,
//           receiverId,
//           conversationId,
//           type: 'audio'
//         });

//         io.to(receiverId).emit("voiceRecordingCompleted", {
//           recordingId,
//           message
//         });

//         callback({ status: "success", message });
//       } catch (error) {
//         callback({ status: "error", message: error.message });
//       }
//     });



//     socket.on("deleteMediaMessage", async ({ messageId }, callback) => {
//       try {
//         if (!messageId || !SOCKET_SECURITY_CONFIG.OBJECT_ID_PATTERN.test(messageId)) {
//           return callback({ status: "error", message: "Invalid message ID" });
//         }

//         const message = await Message.findById(messageId);
//         if (!message) {
//           return callback({ status: "error", message: "Message not found" });
//         }

//         if (!message.sender.equals(user._id)) {
//           return callback({ 
//             status: "error", 
//             message: "Not authorized to delete this message" 
//           });
//         }

//         message.deleted = true;
//         message.deletedAt = new Date();
//         await message.save();

//         io.to(message.conversation.toString()).emit("messageDeleted", { 
//           messageId,
//           deletedBy: user._id 
//         });

//         callback({ status: "success" });

//       } catch (err) {
//         console.error('Error deleting media message:', err);
//         callback({ status: "error", message: err.message });
//       }
//     });

//     socket.on("createConversation", async ({ productId, participantId }, callback) => {
//       try {
//         if (!checkRateLimit(user._id.toString(), 'createConversation')) {
//           return callback({ status: "error", message: "Rate limit exceeded. Please wait before creating another conversation." });
//         }

//         if (!productId || !participantId) {
//           return callback({ status: "error", message: "Product ID and participant ID are required" });
//         }

//         if (!SOCKET_SECURITY_CONFIG.OBJECT_ID_PATTERN.test(productId)) {
//           return callback({ status: "error", message: "Invalid product ID format" });
//         }

//         if (!SOCKET_SECURITY_CONFIG.OBJECT_ID_PATTERN.test(participantId)) {
//           return callback({ status: "error", message: "Invalid participant ID format" });
//         }

//         const participant = await User.findById(participantId);
//         if (!participant) {
//           return callback({ status: "error", message: "Participant not found" });
//         }

//         if (participant._id.equals(user._id)) {
//           return callback({ status: "error", message: "Cannot create conversation with yourself" });
//         }

//         const existingConversation = await Conversation.findOne({
//           product: productId,
//           participants: { $all: [user._id, participant._id] }
//         });

//         if (existingConversation) {
//           return callback({ status: "success", conversationId: existingConversation._id });
//         }

//         const conversation = await Conversation.create({
//           participants: [user._id, participant._id],
//           product: productId
//         });

//         socket.join(conversation._id.toString());
//         io.to(participant._id.toString()).emit("newConversation", { conversationId: conversation._id });
//         callback({ status: "success", conversationId: conversation._id });
//       } catch (err) {
//         callback({ status: "error", message: err.message });
//       }
//     });

//     socket.on("createShopConversation", async ({ productId, shopOwnerId }, callback) => {
//       try {
//         if (!checkRateLimit(user._id.toString(), 'createShopConversation')) {
//           return callback({ status: "error", message: "Rate limit exceeded. Please wait before creating another conversation." });
//         }

//         if (!productId || !shopOwnerId) {
//           return callback({ status: "error", message: "Product ID and shop owner ID are required" });
//         }

//         if (!SOCKET_SECURITY_CONFIG.OBJECT_ID_PATTERN.test(productId)) {
//           return callback({ status: "error", message: "Invalid product ID format" });
//         }

//         if (!SOCKET_SECURITY_CONFIG.OBJECT_ID_PATTERN.test(shopOwnerId)) {
//           return callback({ status: "error", message: "Invalid shop owner ID format" });
//         }

//         if (shopOwnerId === user._id.toString()) {
//           return callback({ status: "error", message: "Cannot create conversation with yourself" });
//         }

//         const shopOwner = await User.findById(shopOwnerId);
//         if (!shopOwner) {
//           return callback({ status: "error", message: "Shop owner not found" });
//         }

//         const existingConversation = await Conversation.findOne({
//           participants: { $all: [user._id, shopOwnerId] },
//           product: productId,
//           type: "shop_chat"
//         });

//         if (existingConversation) {
//           socket.join(existingConversation._id.toString());
//           return callback({ status: "success", conversationId: existingConversation._id });
//         }

//         const conversation = await Conversation.create({
//           participants: [user._id, shopOwnerId],
//           product: productId,
//           type: "shop_chat",
//           createdBy: user._id
//         });

//         socket.join(conversation._id.toString());
        
//         io.to(shopOwnerId).emit("newShopConversation", { 
//           conversationId: conversation._id,
//           customer: {
//             _id: user._id,
//             name: user.name,
//             email: user.email
//           },
//           productId: productId
//         });

//         callback({ status: "success", conversationId: conversation._id });
        
//       } catch (err) {
//         console.error('Error creating shop conversation:', err);
//         callback({ status: "error", message: err.message });
//       }
//     });

//     socket.on("joinConversation", async ({ conversationId }, callback) => {
//       try {
//         if (!checkRateLimit(user._id.toString(), 'joinConversation')) {
//           return callback({ status: "error", message: "Rate limit exceeded. Please wait before joining another conversation." });
//         }

//         if (!conversationId) {
//           return callback({ status: "error", message: "Conversation ID is required" });
//         }

//         if (!SOCKET_SECURITY_CONFIG.OBJECT_ID_PATTERN.test(conversationId)) {
//           return callback({ status: "error", message: "Invalid conversation ID format" });
//         }

//         const conversation = await Conversation.findById(conversationId)
//           .populate("participants", "name email")
//           .populate("lastMessage");
//         if (!conversation) {
//           return callback({ status: "error", message: "Conversation not found" });
//         }
//         if (!conversation.participants.some(p => p._id.equals(user._id))) {
//           return callback({ status: "error", message: "Not authorized to join this conversation" });
//         }
//         socket.join(conversation._id.toString());
//         callback({ status: "success", conversation });
//       } catch (err) {
//         callback({ status: "error", message: err.message });
//       }
//     });
//     socket.on("getConversations", async (callback) => {
//       try {
//         // Remove rate limiting for debugging initially
//         // if (!checkRateLimit(user._id.toString(), 'getConversations')) {
//         //   return callback({ status: "error", message: "Rate limit exceeded. Please wait before requesting more Conversations." });
//         // }
        
//         console.log(`Loading conversations for user: ${user.email} (ID: ${user._id})`);
        
//         // Add timeout to prevent hanging
//         const conversationPromise = Conversation.find({ participants: user._id })
//           .populate("participants", "name email avatar")
//           .populate("lastMessage")
//           .populate("product", "title name")
//           .sort({ updatedAt: -1 })
//           .lean(); // Use lean() for better performance
        
//         // Set a timeout for the database query
//         const timeoutPromise = new Promise((_, reject) => {
//           setTimeout(() => reject(new Error('Database query timeout')), 10000);
//         });
        
//         const conversations = await Promise.race([conversationPromise, timeoutPromise]);
//         console.log(`Found ${conversations.length} conversations for user ${user.email}`);
    
//         // Calculate unread count for each conversation
//         const conversationsWithUnreadCount = await Promise.all(
//           conversations.map(async (conv) => {
//             try {
//               const unreadCount = await Message.countDocuments({
//                 conversation: conv._id,
//                 receiver: user._id,
//                 read: { $ne: true },
//                 deleted: { $ne: true }
//               });
    
//               // Ensure we have a plain object
//               const convObj = typeof conv.toObject === 'function' ? conv.toObject() : conv;
//               convObj.unreadCount = unreadCount;
    
//               console.log(`Conversation ${conv._id}: ${unreadCount} unread messages`);
              
//               return convObj;
//             } catch (error) {
//               console.error(`Error calculating unread count for conversation ${conv._id}:`, error);
//               const convObj = typeof conv.toObject === 'function' ? conv.toObject() : conv;
//               convObj.unreadCount = 0;
//               return convObj;
//             }
//           })
//         );
    
//         console.log(`Successfully returning ${conversationsWithUnreadCount.length} conversations with unread counts`);
        
//         // Always ensure callback is called
//         if (typeof callback === 'function') {
//           callback({ 
//             status: "success", 
//             conversations: conversationsWithUnreadCount 
//           });
//         } else {
//           console.error('Callback is not a function:', typeof callback);
//         }
    
//       } catch (err) {
//         console.error('Error loading conversations:', err);
        
//         // Always ensure callback is called even on error
//         if (typeof callback === 'function') {
//           callback({ 
//             status: "error", 
//             message: err.message || 'Failed to load conversations',
//             conversations: [] // Return empty array on error
//           });
//         } else {
//           console.error('Callback is not a function on error:', typeof callback);
//           // If no callback, emit error to user
//           socket.emit('conversationsError', { 
//             error: err.message || 'Failed to load conversations' 
//           });
//         }
//       }
//     });

//     socket.on("getMessages", async ({ conversationId, limit = 20, skip = 0 }, callback) => {
//       try {
//         if (!checkRateLimit(user._id.toString(), 'getMessages')) {
//           return callback({ status: "error", message: "Rate limit exceeded. Please wait before requesting more messages." });
//         }

//         if (!conversationId) {
//           return callback({ status: "error", message: "Conversation ID is required" });
//         }

//         if (!SOCKET_SECURITY_CONFIG.OBJECT_ID_PATTERN.test(conversationId)) {
//           return callback({ status: "error", message: "Invalid conversation ID format" });
//         }

//         const sanitizedLimit = Math.min(Math.max(parseInt(limit) || 20, 1), 100);
//         const sanitizedSkip = Math.max(parseInt(skip) || 0, 0);

//         const conversation = await Conversation.findById(conversationId);
//         if (!conversation) {
//           return callback({ status: "error", message: "Conversation not found" });
//         }
//         if (!conversation.participants.some(p => p._id.equals(user._id))) {
//           return callback({ status: "error", message: "Not authorized to view messages" });
//         }
        
//         const messages = await Message.find({ 
//           conversation: conversationId,
//           deleted: { $ne: true }
//         })
//           .populate("sender", "name email")
//           .populate("receiver", "name email")
//           .sort({ createdAt: -1 })
//           .skip(sanitizedSkip)
//           .limit(sanitizedLimit);
          
//         callback({ status: "success", messages });
//       } catch (err) {
//         callback({ status: "error", message: err.message });
//       }
//     });

//     socket.on("sendMessage", async ({ conversationId, content, productId }, callback) => {
//       try {
//         if (!checkRateLimit(user._id.toString(), 'sendMessage')) {
//           return callback({ status: "error", message: "Rate limit exceeded. Please wait before sending another message." });
//         }

//         if (!conversationId) {
//           return callback({ status: "error", message: "Conversation ID is required" });
//         }

//         if (!SOCKET_SECURITY_CONFIG.OBJECT_ID_PATTERN.test(conversationId)) {
//           return callback({ status: "error", message: "Invalid conversation ID format" });
//         }

//         if (!content || typeof content !== 'string') {
//           return callback({ status: "error", message: "Message content is required" });
//         }

//         const sanitizedContent = sanitizeInput(content);
//         if (!sanitizedContent) {
//           return callback({ status: "error", message: "Message content cannot be empty after sanitization" });
//         }

//         let conversation = await Conversation.findById(conversationId);
//         if (!conversation) {
//           return callback({ status: "error", message: "Conversation not found" });
//         }
        
//         if (!conversation.participants.some(p => p._id.equals(user._id))) {
//           return callback({ status: "error", message: "Not authorized to send message in this conversation" });
//         }

//         const receiverId = conversation.participants.find(p => !p._id.equals(user._id));

//         const message = await Message.create({
//           sender: user._id,
//           receiver: receiverId,
//           content: sanitizedContent,
//           messageType: 'text',
//           product: productId || conversation.product,
//           conversation: conversationId
//         });

//         await Conversation.findByIdAndUpdate(conversationId, {
//           lastMessage: message._id,
//           updatedAt: new Date()
//         });

//         const populatedMessage = await Message.findById(message._id)
//           .populate("sender", "name email")
//           .populate("receiver", "name email");

//         io.to(conversationId).emit("newMessage", populatedMessage);
        
//         if (receiverId) {
//           io.to(receiverId.toString()).emit("newMessage", populatedMessage);
//         }

//         callback({ status: "success", message: populatedMessage });
        
//       } catch (err) {
//         console.error('Error sending message:', err);
//         callback({ status: "error", message: err.message });
//       }
//     });

//     socket.on("markAsRead", async ({ messageId }, callback) => {
//       try {
//         if (!checkRateLimit(user._id.toString(), 'markAsRead')) {
//           return callback({ status: "error", message: "Rate limit exceeded. Please wait before marking more messages as read." });
//         }

//         if (!messageId) {
//           return callback({ status: "error", message: "Message ID is required" });
//         }

//         if (!SOCKET_SECURITY_CONFIG.OBJECT_ID_PATTERN.test(messageId)) {
//           return callback({ status: "error", message: "Invalid message ID format" });
//         }

//         const message = await Message.findById(messageId);
//         if (!message) {
//           return callback({ status: "error", message: "Message not found" });
//         }
//         if (!message.receiver.equals(user._id)) {
//           return callback({ status: "error", message: "Not authorized to mark this message as read" });
//         }
//         message.read = true;
//         await message.save();
//         io.to(message.sender.toString()).emit("messageRead", { messageId });
//         callback({ status: "success" });
//       } catch (err) {
//         callback({ status: "error", message: err.message });
//       }
//     });

//     socket.on("markMediaAsRead", async (data, callback) => {
//       try {
//         if (!checkRateLimit(user._id.toString(), 'markAsRead')) {
//           return callback({ status: "error", message: "Rate limit exceeded." });
//         }

//         const { messageId } = data;
        
//         if (!messageId || !SOCKET_SECURITY_CONFIG.OBJECT_ID_PATTERN.test(messageId)) {
//           return callback({ status: "error", message: "Invalid message ID" });
//         }
        
//         const message = await mediaRepository.markAsRead(messageId, user._id);
        
//         if (message) {
//           io.to(message.senderId.toString()).emit("mediaMessageRead", {
//             messageId,
//             readBy: user._id,
//             readAt: new Date()
//           });
//         }

//         callback({ status: "success" });
//       } catch (error) {
//         callback({ status: "error", message: error.message });
//       }
//     });

//     socket.on("sendTypingIndicator", async ({ conversationId, isTyping }, callback) => {
//       try {
//         if (!checkRateLimit(user._id.toString(), 'sendTypingIndicator')) {
//           return;
//         }

//         if (!conversationId || !SOCKET_SECURITY_CONFIG.OBJECT_ID_PATTERN.test(conversationId)) {
//           return;
//         }

//         const conversation = await Conversation.findById(conversationId);
//         if (!conversation || !conversation.participants.some(p => p._id.equals(user._id))) {
//           return;
//         }

//         socket.to(conversationId).emit("userTyping", {
//           userId: user._id,
//           userName: user.name,
//           isTyping: Boolean(isTyping)
//         });

//         if (callback && typeof callback === 'function') {
//           callback({ status: "success" });
//         }
        
//       } catch (err) {
//         console.error('Error handling typing indicator:', err);
//         if (callback && typeof callback === 'function') {
//           callback({ status: "error", message: err.message });
//         }
//       }
//     });

//     socket.on("getShopConversations", async ({ shopId }, callback) => {
//       try {
//         if (!checkRateLimit(user._id.toString(), 'getShopConversations')) {
//           return callback({ status: "error", message: "Rate limit exceeded." });
//         }

//         if (shopId && !SOCKET_SECURITY_CONFIG.OBJECT_ID_PATTERN.test(shopId)) {
//           return callback({ status: "error", message: "Invalid shop ID format" });
//         }

//         let query = { participants: user._id, type: "shop_chat" };
//         if (shopId) {
//           query.shop = shopId;
//         }

//         const conversations = await Conversation.find(query)
//           .populate("participants", "name email")
//           .populate("lastMessage")
//           .populate("shop", "name logoUrl")
//           .populate("product", "title name")
//           .sort({ updatedAt: -1 });

//         callback({ status: "success", conversations });
        
//       } catch (err) {
//         console.error('Error getting shop conversations:', err);
//         callback({ status: "error", message: err.message });
//       }
//     });

//     socket.on("getMediaMessages", async (data, callback) => {
//       try {
//         if (!checkRateLimit(user._id.toString(), 'getMessages')) {
//           return callback({ status: "error", message: "Rate limit exceeded." });
//         }

//         const { conversationId, limit = 20, skip = 0, type = null } = data;
        
//         if (!conversationId || !SOCKET_SECURITY_CONFIG.OBJECT_ID_PATTERN.test(conversationId)) {
//           return callback({ status: "error", message: "Invalid conversation ID" });
//         }

//         let query = { conversationId, deleted: { $ne: true } };
//         if (type) {
//           query.type = type;
//         }

//         const messages = await mediaRepository.findByConversation(
//           conversationId, 
//           Math.min(parseInt(limit) || 20, 100), 
//           Math.max(parseInt(skip) || 0, 0)
//         );

//         callback({ status: "success", messages });
//       } catch (error) {
//         callback({ status: "error", message: error.message });
//       }
//     });

//     socket.on("mediaPlaybackStatus", async (data) => {
//       try {
//         const { messageId, status, currentTime, conversationId } = data;
        
//         if (!conversationId || !SOCKET_SECURITY_CONFIG.OBJECT_ID_PATTERN.test(conversationId)) {
//           return;
//         }
        
//         socket.to(conversationId).emit("mediaPlaybackUpdate", {
//           messageId,
//           status,
//           currentTime,
//           userId: user._id,
//           userName: user.name
//         });
//       } catch (error) {
//         console.error('Media playback status error:', error);
//       }
//     });

//     socket.on("ping", (cb) => {
//       if (typeof cb === "function") cb();
//     });

//     socket.on("disconnect", (reason) => {
//       console.log(`Enhanced chat disconnected: ${reason}`);
//       if (reason === "ping timeout" || reason === "transport close") {
//         console.log(`Attempting to reconnect for user: ${user?.email}`);
//       }
//     });

//     socket.on("error", (err) => {
//       console.error(`Socket error for user ${user?.email}:`, err);
//     });

//     socket.onAny((eventName, ...args) => {
//       if (eventName !== 'ping' && eventName !== 'pong') {
//         console.log(`Event: ${eventName} | User: ${user?.email} | Args: ${JSON.stringify(args)}`);
//       }
//     });

//     socket.on("reconnect_attempt", () => {
//       console.log(`Reconnection attempt for user: ${user?.email}`);
//     });

//     socket.on("reconnect", () => {
//       console.log(`Reconnected: ${user?.email}`);
//       if (user) {
//         socket.join(user._id.toString());
//       }
//     });
//   });

//   const getReceivedChunks = async (uploadId, totalChunks) => {
//     let count = 0;
//     for (let i = 0; i < totalChunks; i++) {
//       const chunkPath = `temp/chunks/${uploadId}_${i}`;
//       if (await storageService.exists(chunkPath)) {
//         count++;
//       }
//     }
//     return count;
//   };

//   const reassembleFile = async (uploadId, totalChunks, fileName) => {
//     const chunks = [];
    
//     for (let i = 0; i < totalChunks; i++) {
//       const chunkPath = `temp/chunks/${uploadId}_${i}`;
//       const chunk = await storageService.get(chunkPath);
//       chunks.push(chunk);
//     }
    
//     const completeBuffer = Buffer.concat(chunks);
    
//     return {
//       buffer: completeBuffer,
//       originalname: fileName,
//       size: completeBuffer.length
//     };
//   };

//   const cleanupChunks = async (uploadId, totalChunks) => {
//     for (let i = 0; i < totalChunks; i++) {
//       const chunkPath = `temp/chunks/${uploadId}_${i}`;
//       await storageService.delete(chunkPath);
//     }
//   };

//   const combineVoiceChunks = async (recordingId) => {
//     const chunkPattern = `temp/voice/${recordingId}_*.webm`;
//     return {
//       buffer: Buffer.alloc(0),
//       originalname: `voice_${recordingId}.webm`,
//       mimetype: 'audio/webm',
//       size: 0
//     };
//   };

//   setInterval(() => {
//     io.emit("heartbeat", Date.now());
//   }, 25000);

//   return io;
// };

// export const getChatIO = () => {
//   if (!io) throw new Error("Socket.io not initialized");
//   return io;
// };