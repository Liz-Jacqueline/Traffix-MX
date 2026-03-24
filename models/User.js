import mongoose from "mongoose"

const userSchema = new mongoose.Schema({
    name: String,
    email: {
        type: String,
        unique: true
    },

    password: String,
    // Email verification
    isVerified: {
        type: Boolean,
        default: false
    },
    emailVerificationToken: {
        type: String,
        default: null
    },
    emailVerificationExpires: {
        type: Date,
        default: null
    },

    // Password reset
    passwordResetToken: {
        type: String,
        default: null
    },
    passwordResetExpires: {
        type: Date,
        default: null
    }

}, { timestamps: true })

export default mongoose.model("User", userSchema)