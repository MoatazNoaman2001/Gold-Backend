import mongoose from "mongoose";
import Product from "../models/productModel.js";
import Shop from "../models/shopModel.js";
import dotenv from "dotenv";

dotenv.config();

const sampleProducts = [
  // Rings
  {
    title: "Classic Gold Ring",
    description:
      "Elegant 18k gold ring with timeless design perfect for everyday wear",
    price: 2500.0,
    karat: "18K",
    weight: 5.2,
    design_type: "rings",
    category: "rings",
    images_urls: [
      "https://images.unsplash.com/photo-1605100804763-247f67b3557e?w=400&h=400&fit=crop&crop=center&auto=format&q=60",
      "https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?w=400&h=400&fit=crop&crop=center&auto=format&q=60",
    ],
  },
  {
    title: "Diamond Engagement Ring",
    description:
      "Stunning diamond engagement ring with 14k white gold band and brilliant cut diamond",
    price: 8500.0,
    karat: "14K",
    weight: 3.8,
    design_type: "rings",
    category: "rings",
    images_urls: [
      "https://images.unsplash.com/photo-1605100804763-247f67b3557e?w=400&h=400&fit=crop&crop=center&auto=format&q=60",
    ],
  },

  // Chains
  {
    title: "Gold Chain Necklace",
    description:
      "Beautiful 22k gold chain with intricate link design and premium finish",
    price: 4200.0,
    karat: "22K",
    weight: 12.5,
    design_type: "chains",
    category: "chains",
    images_urls: [
      "https://images.unsplash.com/photo-1611652022419-a9419f74343d?w=400&h=400&fit=crop&crop=center&auto=format&q=60",
    ],
  },
  {
    title: "Silver Chain Bracelet",
    description:
      "Elegant silver chain bracelet with modern styling and secure clasp",
    price: 1800.0,
    karat: "18K",
    weight: 8.3,
    design_type: "chains",
    category: "chains",
    images_urls: [
      "https://images.unsplash.com/photo-1611652022419-a9419f74343d?w=400&h=400&fit=crop&crop=center&auto=format&q=60",
    ],
  },

  // Bracelets
  {
    title: "Gold Tennis Bracelet",
    description: "Luxurious gold tennis bracelet with diamond accents",
    price: 6500,
    karat: "18K",
    weight: 15.2,
    design_type: "bracelets",
    category: "bracelets",
    images_urls: [
      "https://images.unsplash.com/photo-1611591437281-460bfbe1220a?w=400&h=400&fit=crop&crop=center&auto=format&q=60",
    ],
  },
  {
    title: "Charm Bracelet",
    description: "Delicate charm bracelet with personalized pendants",
    price: 3200,
    karat: "14K",
    weight: 7.8,
    design_type: "bracelets",
    category: "bracelets",
    images_urls: [
      "https://images.unsplash.com/photo-1611591437281-460bfbe1220a?w=400&h=400&fit=crop&crop=center&auto=format&q=60",
    ],
  },

  // Earrings
  {
    title: "Diamond Stud Earrings",
    description: "Classic diamond stud earrings in 18k white gold",
    price: 4800,
    karat: "18K",
    weight: 2.4,
    design_type: "earrings",
    category: "earrings",
    images_urls: [
      "https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?w=400&h=400&fit=crop&crop=center&auto=format&q=60",
    ],
  },
  {
    title: "Gold Hoop Earrings",
    description: "Modern gold hoop earrings with sleek finish",
    price: 2800,
    karat: "14K",
    weight: 4.1,
    design_type: "earrings",
    category: "earrings",
    images_urls: [
      "https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?w=400&h=400&fit=crop&crop=center&auto=format&q=60",
    ],
  },

  // Necklaces
  {
    title: "Pearl Necklace",
    description: "Elegant pearl necklace with gold clasp",
    price: 3500,
    karat: "18K",
    weight: 6.7,
    design_type: "necklaces",
    category: "necklaces",
    images_urls: [
      "https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?w=400&h=400&fit=crop&crop=center&auto=format&q=60",
    ],
  },
  {
    title: "Gold Pendant Necklace",
    description: "Beautiful gold pendant necklace with heart design",
    price: 2200,
    karat: "14K",
    weight: 5.5,
    design_type: "necklaces",
    category: "necklaces",
    images_urls: [
      "https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?w=400&h=400&fit=crop&crop=center&auto=format&q=60",
    ],
  },

  // Pendants
  {
    title: "Cross Pendant",
    description: "Religious cross pendant in 18k gold",
    price: 1800,
    karat: "18K",
    weight: 3.2,
    design_type: "pendants",
    category: "pendants",
    images_urls: [
      "https://images.unsplash.com/photo-1611652022419-a9419f74343d?w=400&h=400&fit=crop&crop=center&auto=format&q=60",
    ],
  },

  // Sets
  {
    title: "Bridal Jewelry Set",
    description: "Complete bridal set with necklace, earrings, and bracelet",
    price: 12500,
    karat: "18K",
    weight: 25.8,
    design_type: "sets",
    category: "sets",
    images_urls: [
      "https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?w=400&h=400&fit=crop&crop=center&auto=format&q=60",
    ],
  },

  // Watches
  {
    title: "Gold Watch",
    description: "Luxury gold watch with leather strap",
    price: 15000,
    karat: "18K",
    weight: 45.2,
    design_type: "watches",
    category: "watches",
    images_urls: [
      "https://images.unsplash.com/photo-1524592094714-0f0654e20314?w=400&h=400&fit=crop&crop=center&auto=format&q=60",
    ],
  },
];

// Validate product data before insertion
function validateProduct(product) {
  const validDesignTypes = [
    "rings",
    "chains",
    "bracelets",
    "earrings",
    "necklaces",
    "pendants",
    "sets",
    "watches",
    "other",
  ];

  if (!validDesignTypes.includes(product.design_type)) {
    console.warn(
      `Invalid design_type: ${product.design_type}. Setting to 'other'`
    );
    product.design_type = "other";
  }

  if (!product.category) {
    product.category = product.design_type;
  }

  return product;
}

async function seedProducts() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to MongoDB");

    // Get the first shop to assign products to
    const shops = await Shop.find().limit(3);
    if (shops.length === 0) {
      console.log("No shops found. Please create shops first.");
      return;
    }

    // Clear existing products
    await Product.deleteMany({});
    console.log("Cleared existing products");

    // Validate and add shop IDs to products
    const productsWithShops = sampleProducts.map((product, index) => {
      const validatedProduct = validateProduct({ ...product });
      return {
        ...validatedProduct,
        shop: shops[index % shops.length]._id,
      };
    });

    const createdProducts = await Product.insertMany(productsWithShops);
    console.log(`Created ${createdProducts.length} products`);

    // Log categories created
    const categories = [...new Set(createdProducts.map((p) => p.design_type))];
    console.log("Categories created:", categories);

    // Log products by category
    categories.forEach((category) => {
      const count = createdProducts.filter(
        (p) => p.design_type === category
      ).length;
      console.log(`- ${category}: ${count} products`);
    });

    mongoose.disconnect();
    console.log("Seeding completed successfully!");
  } catch (error) {
    console.error("Error seeding products:", error);
    mongoose.disconnect();
  }
}

// Run the seeding function
seedProducts();
