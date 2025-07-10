// services/aiChatbotService.js
import OpenAI from "openai";
import Product from "../models/productModel.js";
import Shop from "../models/shopModel.js";

export async function getChatbotResponse(message, user) {
  // 1. Retrieve relevant context (products + shop info)
  const keywords = message.split(/\s+/).filter(Boolean).slice(0, 7).join("|");
  let context = "";
  let contextParts = [];
  if (keywords) {
    const products = await Product.find({
      $or: [
        { title: { $regex: keywords, $options: "i" } },
        { description: { $regex: keywords, $options: "i" } },
        { design_type: { $regex: keywords, $options: "i" } },
        { category: { $regex: keywords, $options: "i" } }
      ]
    }).limit(5);
    if (products.length > 0) {
      contextParts.push(products.map(p => `Product: ${p.title}\nType: ${p.design_type}\nKarat: ${p.karat}\nWeight: ${p.weight}\nDescription: ${p.description}`).join("\n---\n"));
    }
    // Add shop info if question is about shops
    if (/shop|store|عدد|shops|stores|متجر|محل|number|count/i.test(message)) {
      const shopCount = await Shop.countDocuments();
      const shopNames = await Shop.find({}, {name:1}).limit(10);
      contextParts.push(`Number of shops: ${shopCount}`);
      if (shopNames.length > 0) {
        contextParts.push('Shop names: ' + shopNames.map(s => s.name).join(', '));
      }
    }
  }
  context = contextParts.join("\n\n");

  // 2. Build strict RAG prompt
  const prompt = `You are a helpful assistant for a digital gold platform.\nAnswer the user's question using ONLY the information in the context below.\nIf the answer is not in the context, say \"Sorry, I don't have that information.\"\n\nContext:\n${context || "No relevant data found."}\n\nUser: ${message}\nBot:`;

  // 3. Call OpenAI API
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: "You are a helpful assistant for a digital gold platform. Only answer using the provided context. If the answer is not in the context, say you don't know." },
      { role: "user", content: prompt }
    ],
    max_tokens: 300,
    temperature: 0.2
  });
  return response.choices[0].message.content.trim();
}
