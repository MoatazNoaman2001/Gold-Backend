import mongoose from "mongoose";
import User from "../models/userModel.js";
import Shop from "../models/shopModel.js";
import Product from "../models/productModel.js";
import Booking from "../models/bookingModel.js";
import ShopRating from "../models/shopRatingModel.js";
import dotenv from "dotenv";

dotenv.config();

// بيانات المستخدمين
const sampleUsers = [
  // المدراء
  {
    name: "أحمد محمد الإداري",
    email: "admin@goldmarket.com",
    phone: "01012345678",
    role: "admin",
    password: "Admin123",
    isVerified: true,
    paid: true
  },

  // البائعين
  {
    name: "محمد أحمد صالح",
    email: "mohamed.saleh@gmail.com",
    phone: "01123456789",
    role: "seller",
    password: "Seller123",
    isVerified: true,
    paid: true
  },
  {
    name: "فاطمة علي حسن",
    email: "fatma.ali@gmail.com",
    phone: "01234567890",
    role: "seller",
    password: "Seller123",
    isVerified: true,
    paid: true
  },
  {
    name: "خالد عبد الرحمن",
    email: "khaled.abdelrahman@gmail.com",
    phone: "01098765432",
    role: "seller",
    password: "Seller123",
    isVerified: true,
    paid: true
  },
  {
    name: "نورا إبراهيم محمد",
    email: "nora.ibrahim@gmail.com",
    phone: "01187654321",
    role: "seller",
    password: "Seller123",
    isVerified: true,
    paid: true
  },

  // العملاء
  {
    name: "سارة أحمد محمود",
    email: "sara.ahmed@gmail.com",
    phone: "01156789012",
    role: "customer",
    password: "Customer123",
    isVerified: true
  },
  {
    name: "عمر حسام الدين",
    email: "omar.hossam@gmail.com",
    phone: "01245678901",
    role: "customer",
    password: "Customer123",
    isVerified: true
  },
  {
    name: "مريم عبد الله",
    email: "mariam.abdullah@gmail.com",
    phone: "01134567890",
    role: "customer",
    password: "Customer123",
    isVerified: true
  },
  {
    name: "يوسف محمد علي",
    email: "youssef.mohamed@gmail.com",
    phone: "01023456789",
    role: "customer",
    password: "Customer123",
    isVerified: true
  },
  {
    name: "هدى سامي أحمد",
    email: "hoda.samy@gmail.com",
    phone: "01112345678",
    role: "customer",
    password: "Customer123",
    isVerified: true
  },
  {
    name: "كريم عادل محمد",
    email: "karim.adel@gmail.com",
    phone: "01201234567",
    role: "customer",
    password: "Customer123",
    isVerified: true
  }
];

// بيانات المحلات
const sampleShops = [
  {
    name: "مجوهرات الذهب الملكي",
    description: "متخصصون في أفخر أنواع المجوهرات الذهبية والماسية منذ عام 1985. نقدم تشكيلة واسعة من الخواتم والقلائد والأساور بأعلى معايير الجودة.",
    city: "القاهرة",
    area: "مصر الجديدة",
    address: "شارع الحجاز، مصر الجديدة، القاهرة",
    phone: "0227776666",
    whatsapp: "01012345678",
    specialties: ["خواتم الزفاف", "قلائد ذهبية", "أساور ماسية", "طقم عرائس"],
    workingHours: "9:00 ص - 10:00 م",
    subscriptionPlan: "Premium",
    isApproved: true,
    averageRating: 4.8,
    rating: 4.8,
    reviewCount: 45,
    location: {
      type: "Point",
      coordinates: [31.3157, 30.0444] // القاهرة
    },
    commercialRecord: "/uploads/commercial-records/royal-gold-cr.pdf"
  },
  {
    name: "مجوهرات النيل الذهبية",
    description: "أحدث تصاميم المجوهرات العصرية والكلاسيكية. نوفر خدمات التصميم حسب الطلب وصيانة المجوهرات.",
    city: "الإسكندرية",
    area: "سيدي جابر",
    address: "طريق الكورنيش، سيدي جابر، الإسكندرية",
    phone: "0334445555",
    whatsapp: "01123456789",
    specialties: ["تصميم حسب الطلب", "مجوهرات عصرية", "ساعات ذهبية", "هدايا مناسبات"],
    workingHours: "10:00 ص - 11:00 م",
    subscriptionPlan: "Gold",
    isApproved: true,
    averageRating: 4.6,
    rating: 4.6,
    reviewCount: 32,
    location: {
      type: "Point",
      coordinates: [29.9187, 31.2001] // الإسكندرية
    },
    commercialRecord: "/uploads/commercial-records/nile-gold-cr.pdf"
  },
  {
    name: "بيت الذهب العربي",
    description: "تراث عريق في صناعة المجوهرات العربية الأصيلة. متخصصون في القطع التراثية والعصرية بأجود أنواع الذهب.",
    city: "الجيزة",
    area: "المهندسين",
    address: "شارع جامعة الدول العربية، المهندسين، الجيزة",
    phone: "0233334444",
    whatsapp: "01234567890",
    specialties: ["مجوهرات تراثية", "ذهب عيار 21", "قطع أثرية", "مجوهرات رجالية"],
    workingHours: "9:30 ص - 9:30 م",
    subscriptionPlan: "Premium",
    isApproved: true,
    averageRating: 4.7,
    rating: 4.7,
    reviewCount: 28,
    location: {
      type: "Point",
      coordinates: [31.2001, 30.0626] // الجيزة
    },
    commercialRecord: "/uploads/commercial-records/arab-gold-cr.pdf"
  },
  {
    name: "مجوهرات الأناقة الحديثة",
    description: "أحدث صيحات الموضة في عالم المجوهرات. تشكيلة متنوعة من القطع العصرية للشباب والفتيات.",
    city: "القاهرة",
    area: "التجمع الخامس",
    address: "التجمع الخامس، القاهرة الجديدة",
    phone: "0225556666",
    whatsapp: "01098765432",
    specialties: ["مجوهرات شبابية", "إكسسوارات عصرية", "هدايا التخرج", "مجوهرات ملونة"],
    workingHours: "11:00 ص - 12:00 ص",
    subscriptionPlan: "Basic",
    isApproved: true,
    averageRating: 4.4,
    rating: 4.4,
    reviewCount: 19,
    location: {
      type: "Point",
      coordinates: [31.4486, 30.0131] // التجمع الخامس
    },
    commercialRecord: "/uploads/commercial-records/modern-elegance-cr.pdf"
  }
];

// بيانات المنتجات
const sampleProducts = [
  // خواتم
  {
    title: "خاتم ذهب كلاسيكي عيار 18",
    description: "خاتم ذهب أنيق بتصميم كلاسيكي مناسب للارتداء اليومي، مصنوع من الذهب الخالص عيار 18 قيراط",
    price: 2500.0,
    karat: "18",
    weight: 5.2,
    design_type: "rings",
    category: "rings",
    images_urls: [
      "https://images.unsplash.com/photo-1605100804763-247f67b3557e?w=400&h=400&fit=crop&crop=center&auto=format&q=60"
    ],
    isAvailable: true
  },
  {
    title: "خاتم خطوبة بالماس",
    description: "خاتم خطوبة فاخر مرصع بالماس الطبيعي، تصميم عصري يناسب المناسبات الخاصة",
    price: 8500.0,
    karat: "18",
    weight: 3.8,
    design_type: "rings",
    category: "rings",
    images_urls: [
      "https://images.unsplash.com/photo-1605100804763-247f67b3557e?w=400&h=400&fit=crop&crop=center&auto=format&q=60"
    ],
    isAvailable: true
  },
  {
    title: "خاتم ذهب أبيض بالزمرد",
    description: "خاتم من الذهب الأبيض مرصع بحجر الزمرد الطبيعي، قطعة فنية رائعة",
    price: 6200.0,
    karat: "18",
    weight: 4.5,
    design_type: "rings",
    category: "rings",
    images_urls: [
      "https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?w=400&h=400&fit=crop&crop=center&auto=format&q=60"
    ],
    isAvailable: true
  },

  // سلاسل
  {
    title: "سلسلة ذهب عيار 21 قيراط",
    description: "سلسلة ذهبية فاخرة بتصميم حلقات متداخلة، مصنوعة من أجود أنواع الذهب عيار 21",
    price: 4200.0,
    karat: "21",
    weight: 12.5,
    design_type: "chains",
    category: "chains",
    images_urls: [
      "https://images.unsplash.com/photo-1611652022419-a9419f74343d?w=400&h=400&fit=crop&crop=center&auto=format&q=60"
    ],
    isAvailable: true
  },
  {
    title: "سلسلة فضة بقلادة ذهبية",
    description: "سلسلة أنيقة من الفضة مع قلادة ذهبية صغيرة، تصميم عصري ومميز",
    price: 1800.0,
    karat: "18",
    weight: 8.3,
    design_type: "chains",
    category: "chains",
    images_urls: [
      "https://images.unsplash.com/photo-1611652022419-a9419f74343d?w=400&h=400&fit=crop&crop=center&auto=format&q=60"
    ],
    isAvailable: true
  },
  {
    title: "سلسلة ذهب بحروف عربية",
    description: "سلسلة ذهبية مع قلادة على شكل حروف عربية، يمكن تخصيصها حسب الطلب",
    price: 3500.0,
    karat: "18",
    weight: 10.2,
    design_type: "chains",
    category: "chains",
    images_urls: [
      "https://images.unsplash.com/photo-1611652022419-a9419f74343d?w=400&h=400&fit=crop&crop=center&auto=format&q=60"
    ],
    isAvailable: true
  },

  // أساور
  {
    title: "سوار ذهب تنس بالماس",
    description: "سوار ذهبي فاخر مرصع بالماس، تصميم تنس كلاسيكي يناسب المناسبات الرسمية",
    price: 6500.0,
    karat: "18",
    weight: 15.2,
    design_type: "bracelets",
    category: "bracelets",
    images_urls: [
      "https://images.unsplash.com/photo-1611591437281-460bfbe1220a?w=400&h=400&fit=crop&crop=center&auto=format&q=60"
    ],
    isAvailable: true
  },
  {
    title: "سوار بدلايات شخصية",
    description: "سوار أنيق مع دلايات صغيرة قابلة للتخصيص، هدية مثالية للمناسبات الخاصة",
    price: 3200.0,
    karat: "18",
    weight: 7.8,
    design_type: "bracelets",
    category: "bracelets",
    images_urls: [
      "https://images.unsplash.com/photo-1611591437281-460bfbe1220a?w=400&h=400&fit=crop&crop=center&auto=format&q=60"
    ],
    isAvailable: true
  },
  {
    title: "سوار ذهب عربي تقليدي",
    description: "سوار ذهبي بتصميم عربي تقليدي، يحمل طابع التراث العربي الأصيل",
    price: 4800.0,
    karat: "21",
    weight: 18.5,
    design_type: "bracelets",
    category: "bracelets",
    images_urls: [
      "https://images.unsplash.com/photo-1611591437281-460bfbe1220a?w=400&h=400&fit=crop&crop=center&auto=format&q=60"
    ],
    isAvailable: true
  },

  // أقراط
  {
    title: "أقراط ماسية كلاسيكية",
    description: "أقراط من الذهب الأبيض مرصعة بالماس، تصميم كلاسيكي أنيق يناسب جميع المناسبات",
    price: 4800.0,
    karat: "18",
    weight: 2.4,
    design_type: "earrings",
    category: "earrings",
    images_urls: [
      "https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?w=400&h=400&fit=crop&crop=center&auto=format&q=60"
    ],
    isAvailable: true
  },
  {
    title: "أقراط ذهبية دائرية",
    description: "أقراط ذهبية عصرية بشكل دائري، تصميم بسيط وأنيق للارتداء اليومي",
    price: 2800.0,
    karat: "18",
    weight: 4.1,
    design_type: "earrings",
    category: "earrings",
    images_urls: [
      "https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?w=400&h=400&fit=crop&crop=center&auto=format&q=60"
    ],
    isAvailable: true
  },
  {
    title: "أقراط لؤلؤ طبيعي",
    description: "أقراط من اللؤلؤ الطبيعي مع إطار ذهبي، قطعة كلاسيكية خالدة",
    price: 3500.0,
    karat: "18",
    weight: 3.2,
    design_type: "earrings",
    category: "earrings",
    images_urls: [
      "https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?w=400&h=400&fit=crop&crop=center&auto=format&q=60"
    ],
    isAvailable: true
  },

  // قلائد
  {
    title: "قلادة لؤلؤ طبيعي",
    description: "قلادة أنيقة من اللؤلؤ الطبيعي مع إغلاق ذهبي، قطعة كلاسيكية فاخرة",
    price: 3500.0,
    karat: "18",
    weight: 6.7,
    design_type: "necklaces",
    category: "necklaces",
    images_urls: [
      "https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?w=400&h=400&fit=crop&crop=center&auto=format&q=60"
    ],
    isAvailable: true
  },
  {
    title: "قلادة ذهبية بقلب",
    description: "قلادة ذهبية جميلة مع دلاية على شكل قلب، هدية مثالية للأحباء",
    price: 2200.0,
    karat: "18",
    weight: 5.5,
    design_type: "necklaces",
    category: "necklaces",
    images_urls: [
      "https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?w=400&h=400&fit=crop&crop=center&auto=format&q=60"
    ],
    isAvailable: true
  },
  {
    title: "قلادة ذهبية بآية قرآنية",
    description: "قلادة ذهبية مع دلاية محفور عليها آية قرآنية، قطعة روحانية مميزة",
    price: 4200.0,
    karat: "21",
    weight: 8.3,
    design_type: "necklaces",
    category: "necklaces",
    images_urls: [
      "https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?w=400&h=400&fit=crop&crop=center&auto=format&q=60"
    ],
    isAvailable: true
  },

  // دلايات
  {
    title: "دلاية صليب ذهبية",
    description: "دلاية دينية من الذهب عيار 18، تصميم كلاسيكي أنيق",
    price: 1800.0,
    karat: "18",
    weight: 3.2,
    design_type: "pendants",
    category: "pendants",
    images_urls: [
      "https://images.unsplash.com/photo-1611652022419-a9419f74343d?w=400&h=400&fit=crop&crop=center&auto=format&q=60"
    ],
    isAvailable: true
  },
  {
    title: "دلاية هلال ونجمة",
    description: "دلاية إسلامية بشكل الهلال والنجمة، رمز إسلامي جميل من الذهب الخالص",
    price: 2100.0,
    karat: "21",
    weight: 4.1,
    design_type: "pendants",
    category: "pendants",
    images_urls: [
      "https://images.unsplash.com/photo-1611652022419-a9419f74343d?w=400&h=400&fit=crop&crop=center&auto=format&q=60"
    ],
    isAvailable: true
  },

  // طقم مجوهرات
  {
    title: "طقم عروس كامل",
    description: "طقم مجوهرات كامل للعروس يشمل قلادة وأقراط وسوار، تصميم فاخر للمناسبات الخاصة",
    price: 12500.0,
    karat: "18",
    weight: 25.8,
    design_type: "sets",
    category: "sets",
    images_urls: [
      "https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?w=400&h=400&fit=crop&crop=center&auto=format&q=60"
    ],
    isAvailable: true
  },
  {
    title: "طقم مجوهرات يومي",
    description: "طقم مجوهرات بسيط للارتداء اليومي، يشمل سلسلة وأقراط صغيرة",
    price: 5500.0,
    karat: "18",
    weight: 12.3,
    design_type: "sets",
    category: "sets",
    images_urls: [
      "https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?w=400&h=400&fit=crop&crop=center&auto=format&q=60"
    ],
    isAvailable: true
  },

  // ساعات
  {
    title: "ساعة ذهبية فاخرة",
    description: "ساعة ذهبية فاخرة بحزام جلدي، قطعة كلاسيكية للرجال الأنيقين",
    price: 15000.0,
    karat: "18",
    weight: 45.2,
    design_type: "watches",
    category: "watches",
    images_urls: [
      "https://images.unsplash.com/photo-1524592094714-0f0654e20314?w=400&h=400&fit=crop&crop=center&auto=format&q=60"
    ],
    isAvailable: true
  },
  {
    title: "ساعة نسائية بالماس",
    description: "ساعة نسائية أنيقة مرصعة بالماس، تصميم عصري يناسب المرأة العملية",
    price: 18500.0,
    karat: "18",
    weight: 32.1,
    design_type: "watches",
    category: "watches",
    images_urls: [
      "https://images.unsplash.com/photo-1524592094714-0f0654e20314?w=400&h=400&fit=crop&crop=center&auto=format&q=60"
    ],
    isAvailable: true
  }
];

// بيانات الحجوزات النموذجية
const sampleBookings = [
  {
    date: new Date("2024-08-15"),
    time: "10:00 ص",
    type: "consultation",
    status: "confirmed",
    notes: "استشارة حول خاتم الخطوبة",
    customerName: "سارة أحمد",
    customerPhone: "01156789012",
    customerEmail: "sara.ahmed@gmail.com"
  },
  {
    date: new Date("2024-08-20"),
    time: "2:00 م",
    type: "viewing",
    status: "pending",
    notes: "مشاهدة طقم المجوهرات",
    customerName: "مريم عبد الله",
    customerPhone: "01134567890",
    customerEmail: "mariam.abdullah@gmail.com"
  },
  {
    date: new Date("2024-08-25"),
    time: "4:00 م",
    type: "purchase",
    status: "completed",
    notes: "شراء سوار ذهبي",
    customerName: "هدى سامي",
    customerPhone: "01112345678",
    customerEmail: "hoda.samy@gmail.com"
  }
];

// بيانات التقييمات النموذجية
const sampleRatings = [
  {
    rating: 5,
    comment: "خدمة ممتازة ومجوهرات عالية الجودة. أنصح بشدة بالتعامل مع هذا المحل."
  },
  {
    rating: 4,
    comment: "تشكيلة رائعة من المجوهرات وأسعار معقولة. الموظفون متعاونون جداً."
  },
  {
    rating: 5,
    comment: "أفضل محل مجوهرات تعاملت معه. جودة عالية وصدق في التعامل."
  },
  {
    rating: 4,
    comment: "مجوهرات جميلة وتصاميم عصرية. سأعود للشراء مرة أخرى بالتأكيد."
  },
  {
    rating: 5,
    comment: "طقم العروس كان رائع جداً. شكراً لكم على الخدمة المميزة."
  }
];

// دالة التحقق من صحة البيانات
function validateProduct(product) {
  const validDesignTypes = [
    "rings", "chains", "bracelets", "earrings",
    "necklaces", "pendants", "sets", "watches", "other"
  ];

  if (!validDesignTypes.includes(product.design_type)) {
    console.warn(`نوع التصميم غير صحيح: ${product.design_type}. سيتم تعيينه إلى 'other'`);
    product.design_type = "other";
  }

  if (!product.category) {
    product.category = product.design_type;
  }

  return product;
}

// دالة إنشاء البيانات النموذجية
async function seedDatabase() {
  try {
    // الاتصال بقاعدة البيانات
    await mongoose.connect(process.env.MONGO_URI);
    console.log("تم الاتصال بقاعدة البيانات بنجاح");

    // حذف البيانات الموجودة
    await User.deleteMany({});
    await Shop.deleteMany({});
    await Product.deleteMany({});
    await Booking.deleteMany({});
    await ShopRating.deleteMany({});
    console.log("تم حذف البيانات الموجودة");

    // إنشاء المستخدمين
    const createdUsers = await User.insertMany(sampleUsers);
    console.log(`تم إنشاء ${createdUsers.length} مستخدم`);

    // تصنيف المستخدمين حسب الدور
    const sellers = createdUsers.filter(user => user.role === 'seller');
    const customers = createdUsers.filter(user => user.role === 'customer');

    console.log(`البائعين: ${sellers.length}`);
    console.log(`العملاء: ${customers.length}`);

    // إنشاء المحلات وربطها بالبائعين
    const shopsWithOwners = sampleShops.map((shop, index) => ({
      ...shop,
      owner: sellers[index % sellers.length]._id
    }));

    const createdShops = await Shop.insertMany(shopsWithOwners);
    console.log(`تم إنشاء ${createdShops.length} محل`);

    // إنشاء المنتجات وربطها بالمحلات
    const productsWithShops = sampleProducts.map((product, index) => {
      const validatedProduct = validateProduct({ ...product });
      return {
        ...validatedProduct,
        shop: createdShops[index % createdShops.length]._id
      };
    });

    const createdProducts = await Product.insertMany(productsWithShops);
    console.log(`تم إنشاء ${createdProducts.length} منتج`);

    // إنشاء الحجوزات
    const bookingsWithData = sampleBookings.map((booking, index) => ({
      ...booking,
      user: customers[index % customers.length]._id,
      shop: createdShops[index % createdShops.length]._id
    }));

    const createdBookings = await Booking.insertMany(bookingsWithData);
    console.log(`تم إنشاء ${createdBookings.length} حجز`);

    // إنشاء التقييمات
    const ratingsWithData = sampleRatings.map((rating, index) => ({
      ...rating,
      user: customers[index % customers.length]._id,
      shop: createdShops[index % createdShops.length]._id
    }));

    const createdRatings = await ShopRating.insertMany(ratingsWithData);
    console.log(`تم إنشاء ${createdRatings.length} تقييم`);

    // طباعة إحصائيات المنتجات حسب الفئة
    const categories = [...new Set(createdProducts.map(p => p.design_type))];
    console.log("\nإحصائيات المنتجات حسب الفئة:");
    categories.forEach(category => {
      const count = createdProducts.filter(p => p.design_type === category).length;
      console.log(`- ${category}: ${count} منتج`);
    });

    console.log("\nتم إنشاء جميع البيانات النموذجية بنجاح! 🎉");
    console.log("يمكنك الآن تشغيل التطبيق واستكشاف البيانات");

  } catch (error) {
    console.error("خطأ في إنشاء البيانات النموذجية:", error);
  } finally {
    await mongoose.disconnect();
    console.log("تم قطع الاتصال بقاعدة البيانات");
  }
}

// تشغيل دالة إنشاء البيانات
seedDatabase();