// services/aiChatbotService.js
import OpenAI from "openai";
import Product from "../models/productModel.js";
import Shop from "../models/shopModel.js";
import User from "../models/userModel.js";
import ShopRating from "../models/shopRatingModel.js";

export async function getChatbotResponse(message, user) {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  // Detect budget queries (e.g., "I have 5000 EGP and want a ring")
  const budgetPattern =
    /(budget|ميزانية|have|عندي|with|بـ|for|بـسعر|بسعر|بميزانية|بمبلغ|amount|مبلغ|price|سعر)[^\d]*(\d{2,})([^\d]+)?(ring|خاتم|bracelet|سوار|بangle|اسورة|necklace|قلادة|عقد|bridal|طقم|set|طقم عروس|bride|عروس)?/i;
  const match = message.match(budgetPattern);

  if (match) {
    // Extract budget and type
    const budget = parseFloat(match[2]);
    const type = match[4]?.toLowerCase() || "";
    // Map type to possible product categories
    const typeMap = {
      ring: ["ring", "خاتم"],
      bracelet: ["bracelet", "bangle", "سوار", "اسورة"],
      necklace: ["necklace", "قلادة", "عقد"],
      bridal: [
        "bridal",
        "set",
        "طقم",
        "طقم عروس",
        "bride",
        "عروس",
        "شبكه",
        "شبكة",
        "شبكه عروس",
        "شبكة عروس",
      ],
    };
    let typeQuery = [];
    for (const key in typeMap) {
      if (typeMap[key].some((t) => type.includes(t))) {
        typeQuery = typeMap[key];
        break;
      }
    }
    // Build query for products within budget and type
    const query = {
      price: { $lte: budget },
    };
    if (typeQuery.length > 0) {
      query.design_type = { $in: typeQuery };
    }
    // Find products
    const products = await Product.find(query).limit(10).populate({
      path: "shop",
      select: "name",
    });
    if (products.length > 0) {
      // Build friendly reply
      let reply = "Here are some pieces you might love 👇\n\n";
      reply += products
        .map((p) => {
          const shopName = p.shop?.name || "N/A";
          const productLink = `${
            process.env.FRONTEND_URL || "https://yourstore.com"
          }/product/${p._id}`;
          return `• ${p.title} (${shopName})\n${productLink}`;
        })
        .join("\n\n");
      return reply;
    } else {
      return "We couldn’t find something in that exact range right now 😔, but stay tuned! New items are added regularly 💛.";
    }
  }

  // 1. Check if the query is likely database-related
  const dbRelatedPatterns =
    /product|منتج|products|المنتجات|shop|store|متجر|محل|shops|stores|المتاجر|المحلات|owner|مالك|بائع|seller|admin|user|مستخدم|properties|خصائص|مواصفات|count|عدد|name|اسم/i;
  const isDbRelated = dbRelatedPatterns.test(message);

  let context = "";
  let contextParts = [];

  if (isDbRelated) {
    // 2. Extract keywords (limit to 5 for performance, ensure regex safety)
    const keywords = message
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 5)
      .map((word) => word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")) // Escape special chars
      .join("|");

    // 3. Build context only if keywords are present
    if (keywords) {
      // Products
      const products = await Product.find({
        $or: [
          { title: { $regex: keywords, $options: "i" } },
          { description: { $regex: keywords, $options: "i" } },
          { design_type: { $regex: keywords, $options: "i" } },
          { category: { $regex: keywords, $options: "i" } },
        ],
      })
        .limit(10)
        .populate({
          path: "shop",
          populate: { path: "owner", select: "name email" },
          select: "name owner",
        });

      if (products.length > 0) {
        contextParts.push(
          products
            .map((p) => {
              const shopName = p.shop?.name || "N/A";
              const ownerName = p.shop?.owner?.name || "N/A";
              const ownerEmail = p.shop?.owner?.email || "N/A";
              return `Product: ${p.title}\nType: ${p.design_type}\nKarat: ${p.karat}\nWeight: ${p.weight}\nDescription: ${p.description}\nShop: ${shopName}\nOwner: ${ownerName} (${ownerEmail})`;
            })
            .join("\n---\n")
        );
      }

      // Shops
      if (
        /shop|store|shops|stores|متجر|محل|number|count|owner|مالك|اسم المتجر|اسم المحل|اسم البائع/i.test(
          message
        )
      ) {
        const shopCount = await Shop.countDocuments();
        const shops = await Shop.find({})
          .populate("owner", "name email")
          .limit(10); // Reduced limit for performance
        contextParts.push(`Total shops: ${shopCount}`);
        if (shops.length > 0) {
          contextParts.push(
            `Shops: ${shops
              .map(
                (s) =>
                  `${s.name} (Owner: ${s.owner?.name || "N/A"}, Email: ${
                    s.owner?.email || "N/A"
                  })`
              )
              .join("; ")}`
          );
        }
      }

      // Owners
      if (
        /owner|مالك|بائع|seller|admin|user|مستخدم|اسم البائع|اسم المالك/i.test(
          message
        )
      ) {
        const owners = await User.find(
          {},
          { name: 1, email: 1, role: 1 }
        ).limit(10);
        if (owners.length > 0) {
          contextParts.push(
            `Owners: ${owners
              .map((o) => `${o.name} (${o.role}, ${o.email})`)
              .join("; ")}`
          );
        }
      }

      // Products by shop
      const allShops = await Shop.find({}, { name: 1 });
      const matchedShop = allShops.find(
        (shop) => shop.name && new RegExp(shop.name, "i").test(message)
      );
      if (matchedShop) {
        const shopProducts = await Product.find({ shop: matchedShop._id })
          .limit(10)
          .populate({
            path: "shop",
            populate: { path: "owner", select: "name email" },
            select: "name owner",
          });
        contextParts.push(`Products for shop '${matchedShop.name}':`);
        if (shopProducts.length > 0) {
          contextParts.push(
            shopProducts
              .map((p) => {
                const shopName = p.shop?.name || "N/A";
                const ownerName = p.shop?.owner?.name || "N/A";
                const ownerEmail = p.shop?.owner?.email || "N/A";
                return `Product: ${p.title}\nType: ${p.design_type}\nKarat: ${p.karat}\nWeight: ${p.weight}\nDescription: ${p.description}\nShop: ${shopName}\nOwner: ${ownerName} (${ownerEmail})`;
              })
              .join("\n---\n")
          );
        } else {
          contextParts.push("No products found for this shop.");
        }
      }
    }

    context = contextParts.join("\n\n") || "No relevant data found.";
  }

  // 4. Build prompt based on query type
  let prompt;
  if (isDbRelated) {
    // Strict RAG prompt for database-related queries
    prompt = `You are a helpful assistant for a digital gold platform.\nAnswer the user's question using ONLY the information in the context below.\nIf the answer is not in the context, say \"Sorry, I don't have that information.\"\n\nContext:\n${context}\n\nUser: ${message}\nBot:`;
  } else {
    // General prompt for non-database queries
    prompt = `You are a helpful assistant for a digital gold platform. Answer the user's question to the best of your ability. If the question is unrelated to the platform's products, shops, or owners, provide a general helpful response.\n\nUser: ${message}\nBot:`;
  }

  // 5. Call OpenAI API
  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: isDbRelated
          ? "You are a helpful assistant for a digital gold platform. Only answer using the provided context. If the answer is not in the context, say you don't know."
          : "You are a helpful assistant for a digital gold platform. Provide helpful and accurate answers, even for general questions unrelated to the platform.",
      },
      { role: "user", content: prompt },
    ],
    max_tokens: 300,
    temperature: 0.3, // Slightly increased for more natural responses
  });

  const answer = response.choices[0].message.content.trim();

  // 6. Fallback responses for database queries with no context
  if (isDbRelated && !contextParts.length) {
    if (/product|منتج|products|المنتجات/i.test(message)) {
      return "Sorry, I couldn't find any product information matching your request. Please try specifying a product name, shop, or ask about something else.";
    }
    if (/shop|store|متجر|محل|shops|stores|المتاجر|المحلات/i.test(message)) {
      return "Sorry, I couldn't find any shop information matching your request. Please try specifying a shop name or ask about something else.";
    }
    if (/owner|مالك|بائع|seller|admin|user|مستخدم|ادمن/i.test(message)) {
      return "Sorry, I couldn't find any owner or user information matching your request. Please try specifying a name or ask about something else.";
    }
    return "Sorry, I don't have that information. Please try rephrasing your question or ask about products, shops, or owners.";
  }

  return answer;
}
