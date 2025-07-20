import mongoose from 'mongoose';
import Shop from './models/shopModel.js';
import dotenv from 'dotenv';

dotenv.config();

// Sample locations in Egypt (major cities)
const egyptianLocations = [
  { name: "Cairo", coordinates: [31.2357, 30.0444] },
  { name: "Alexandria", coordinates: [29.9187, 31.2001] },
  { name: "Giza", coordinates: [31.2089, 30.0131] },
  { name: "Shubra El Kheima", coordinates: [31.2441, 30.1287] },
  { name: "Port Said", coordinates: [32.3019, 31.2565] },
  { name: "Suez", coordinates: [32.5498, 29.9668] },
  { name: "Luxor", coordinates: [32.6396, 25.6872] },
  { name: "Mansoura", coordinates: [31.0364, 31.0409] },
  { name: "El Mahalla El Kubra", coordinates: [31.1669, 30.9722] },
  { name: "Tanta", coordinates: [31.0004, 30.7865] },
  { name: "Asyut", coordinates: [31.1837, 27.1783] },
  { name: "Ismailia", coordinates: [32.2722, 30.5965] },
  { name: "Fayyum", coordinates: [30.8418, 29.3084] },
  { name: "Zagazig", coordinates: [31.5021, 30.5877] },
  { name: "Aswan", coordinates: [32.8998, 24.0889] }
];

const addLocationsToShops = async () => {
  try {
    console.log('🔗 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');

    // Find all shops without location data
    const shopsWithoutLocation = await Shop.find({
      $or: [
        { location: { $exists: false } },
        { 'location.coordinates': { $exists: false } },
        { 'location.coordinates': { $size: 0 } }
      ]
    });

    console.log(`📍 Found ${shopsWithoutLocation.length} shops without location data`);

    if (shopsWithoutLocation.length === 0) {
      console.log('✅ All shops already have location data');
      return;
    }

    // Update each shop with a random Egyptian location
    for (let i = 0; i < shopsWithoutLocation.length; i++) {
      const shop = shopsWithoutLocation[i];
      const randomLocation = egyptianLocations[i % egyptianLocations.length];
      
      // Add some random offset to make locations more realistic
      const latOffset = (Math.random() - 0.5) * 0.02; // ±0.01 degrees (~1km)
      const lngOffset = (Math.random() - 0.5) * 0.02;
      
      const coordinates = [
        randomLocation.coordinates[0] + lngOffset, // longitude
        randomLocation.coordinates[1] + latOffset  // latitude
      ];

      shop.location = {
        type: "Point",
        coordinates: coordinates
      };

      // Also ensure the shop is approved for public viewing
      if (!shop.isApproved) {
        shop.isApproved = true;
      }

      await shop.save();
      
      console.log(`✅ Updated shop "${shop.name}" with location near ${randomLocation.name}`);
      console.log(`   Coordinates: [${coordinates[0].toFixed(4)}, ${coordinates[1].toFixed(4)}]`);
    }

    console.log(`🎉 Successfully updated ${shopsWithoutLocation.length} shops with location data`);

    // Display summary of all shops with locations
    const allShops = await Shop.find({ 'location.coordinates': { $exists: true } });
    console.log(`\n📊 Summary: ${allShops.length} shops now have location data`);
    
    allShops.forEach(shop => {
      const [lng, lat] = shop.location.coordinates;
      console.log(`   - ${shop.name}: [${lng.toFixed(4)}, ${lat.toFixed(4)}]`);
    });

  } catch (error) {
    console.error('❌ Error adding locations to shops:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
    process.exit(0);
  }
};

// Run the script
addLocationsToShops();
