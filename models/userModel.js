import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import { AppError } from '../controllers/errorController.js';

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Please provide your name'],
        trim: true,
        minlength: [4, 'Name must be at least 4 characters'],
        maxlength: [50, 'Name cannot exceed 50 characters']
    },

    email: {
        type: String,
        required: [true, 'Please provide your email'],
        unique: [true, 'This email is already registered'],
        lowercase: true,
        trim: true,
        validate: {
            validator: function(v) {
                return /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/.test(v);
            },
            message: 'Please enter a valid email address'
        }
    },

    phone: {
        type: String,
        trim: true,
        validate: {
            validator: function(v) {
                if (!v) return true; // Optional field
                return /^[\+]?0(10|11|12|15)\d{8}$/.test(v);
            },
            message: 'Please enter a valid Egyptian phone number (11 digits, starting with 010, 011, 012, or 015)'
        }
    },

    role: {
        type: String,
        enum: {
            values: ['admin', 'seller', 'customer'],
            message: 'Role must be either admin, seller, or customer'
        },
        default: 'customer'
    },

    password: {
        type: String,
        required: [true, 'Please provide a password'],
        minlength: [6, 'Password must be at least 6 characters'],
        select: false,
        validate: {
            validator: function(v) {
                return /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{6,}$/.test(v);
            },
            message: 'Password must contain at least one uppercase letter, one lowercase letter, and one number'
        }
    },

    googleId: {
        type: String, 
        unique: true,
        sparse: true,
    },

    isVerified: {
        type: Boolean,
        default: false,
    },

    refreshToken: {
        type: String,
        select: false
    }
}, {
    timestamps: true,
    collection: 'users',
    // Transform the output to remove version and password fields
    toJSON: {
        transform: function(doc, ret) {
            delete ret.__v;
            delete ret.password;
            return ret;
        }
    },
    toObject: {
        transform: function(doc, ret) {
            delete ret.__v;
            delete ret.password;
            return ret;
        }
    }
});

userSchema.index({ email: 3 }, { unique: true });
userSchema.index({ role: 1 });

userSchema.pre('save', async function (next) {
    if (!this.isModified('password')) return next();

    try {
        const hashedPassword = await bcrypt.hash(this.password, 12);
        this.password = hashedPassword;
        next();
    } catch (error) {
        next(error);
    }
});

userSchema.methods.comparePassword = async function (candidatePassword) {
    return await bcrypt.compare(candidatePassword, this.password);
};

userSchema.statics.findByEmail = function (email) {
    return this.findOne({ email: email.toLowerCase() });
};

userSchema.statics.findByRole = function (role) {
    return this.find({ role });
};

userSchema.post('save', function(error, doc, next) {
  if (error.name === 'MongoServerError' && error.code === 11000) {
    const field = Object.keys(error.keyPattern)[0];
    next(new AppError(`The ${field} is already registered. Please use a different ${field}.`, 400));
  } else if (error.name === 'ValidationError') {
    const errors = {};
    Object.keys(error.errors).forEach((key) => {
      errors[key] = error.errors[key].message;
    });
    const message = 'Validation failed';
    const validationError = new AppError(message, 400);
    validationError.errors = errors;
    next(validationError);
  } else {
    next(error);
  }
});
  
const User = mongoose.model('User', userSchema);

export default User;