// services/aiChatbotService.js
import OpenAI from "openai";
import Product from "../models/productModel.js";
import Shop from "../models/shopModel.js";
import User from "../models/userModel.js";

export async function getChatbotResponse(message, user) {
  // 1. Retrieve relevant context (products + shop info + owners)
  const keywords = message.split(/\s+/).filter(Boolean).slice(0, 7).join("|");
  let context = "";
  let contextParts = [];
  if (keywords) {
    // Products (populate shop and owner)
    const products = await Product.find({
      $or: [
        { title: { $regex: keywords, $options: "i" } },
        { description: { $regex: keywords, $options: "i" } },
        { design_type: { $regex: keywords, $options: "i" } },
        { category: { $regex: keywords, $options: "i" } }
      ]
    })
      .limit(10)
      .populate({
        path: "shop",
        populate: { path: "owner", select: "name email" },
        select: "name owner"
      });
    if (products.length > 0) {
      contextParts.push(products.map(p => {
        const shopName = p.shop?.name || "N/A";
        const ownerName = p.shop?.owner?.name || "N/A";
        const ownerEmail = p.shop?.owner?.email || "N/A";
        return `Product: ${p.title}\nType: ${p.design_type}\nKarat: ${p.karat}\nWeight: ${p.weight}\nDescription: ${p.description}\nShop: ${shopName}\nOwner: ${ownerName} (${ownerEmail})`;
      }).join("\n---\n"));
    }
    // Shops
    if (/shop|store|عدد|shops|stores|متجر|محل|number|count|owner|مالك|اسم المتجر|اسم المحل|اسم البائع/i.test(message)) {
      const shops = await Shop.find({}).populate("owner", "name email").limit(20);
      contextParts.push(`Number of shops: ${await Shop.countDocuments()}`);
      if (shops.length > 0) {
        contextParts.push('Shop details: ' + shops.map(s => `${s.name} (Owner: ${s.owner?.name || "N/A"}, Email: ${s.owner?.email || "N/A"})`).join('; '));
      }
    }
    // Owners
    if (/owner|مالك|بائع|seller|admin|user|مستخدم|اسم البائع|اسم المالك/i.test(message)) {
      const owners = await User.find({}, {name:1, email:1, role:1}).limit(20);
      if (owners.length > 0) {
        contextParts.push('Owners: ' + owners.map(o => `${o.name} (${o.role}, ${o.email})`).join('; '));
      }
    }
    // Products (by keyword)
    if (
      /product|عدد|products|منتج|number|count|اسم المنتج|اسم البرودكت/i.test(
        message
      )
    ) {
      const products = await Product.find({}).limit(20);
      const productCount = await Product.countDocuments();
      contextParts.push(`Number of products: ${productCount}`);
      if (products.length > 0) {
        contextParts.push(
          "Product details: " + products.map((p) => `${p.name || p.title || p._id}`).join("; ")
        );
      }
    }
    // Products for a specific shop
    // Try to find a shop name in the message
    const allShops = await Shop.find({}, { name: 1 });
    let matchedShop = null;
    if (allShops && allShops.length > 0) {
      matchedShop = allShops.find(shop =>
        shop.name && new RegExp(shop.name, "i").test(message)
      );
    }
    if (matchedShop) {
      // If a shop is mentioned, get only its products
      const shopProducts = await Product.find({ shop: matchedShop._id })
        .limit(20)
        .populate({
          path: "shop",
          populate: { path: "owner", select: "name email" },
          select: "name owner"
        });
      contextParts.push(`Products for shop '${matchedShop.name}':`);
      if (shopProducts.length > 0) {
        contextParts.push(shopProducts.map(p => {
          const shopName = p.shop?.name || "N/A";
          const ownerName = p.shop?.owner?.name || "N/A";
          const ownerEmail = p.shop?.owner?.email || "N/A";
          return `Product: ${p.title}\nType: ${p.design_type}\nKarat: ${p.karat}\nWeight: ${p.weight}\nDescription: ${p.description}\nShop: ${shopName}\nOwner: ${ownerName} (${ownerEmail})`;
        }).join("\n---\n"));
      } else {
        contextParts.push("No products found for this shop.");
      }
    }
  }
  context = contextParts.join("\n\n");

  // If the user asks for properties of each product in each shop, but no data is found, generate a more helpful response
  if (/properties.*product.*shop|خصائص.*منتج.*محل|مواصفات.*منتج.*متجر/i.test(message) && !context) {
    return "I can provide product details for each shop if you specify a shop name, or ask about products in general. Please mention a specific shop or product for more information.";
  }

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
