import bcrypt from "bcrypt"
import crypto from "crypto"
import User from "../models/User.js"

// ── Helpers ─────────────────────────────────────────────────────────────────
function generateToken() {
    return crypto.randomBytes(32).toString("hex")
}

// ── Crear usuario (registro) ─────────────────────────────────────────────────
export async function create({ name, email, password }) {
    const exists = await User.findOne({ email })
    if (exists) throw new Error("El correo ya está registrado")

    const hashedPassword = await bcrypt.hash(password, 10)

    const verificationToken = generateToken()
    const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24h

    const user = new User({
        name,
        email,
        password: hashedPassword,
        isVerified: false,
        emailVerificationToken: verificationToken,
        emailVerificationExpires: verificationExpires
    })

    await user.save()

    return { user, verificationToken }
}

// ── Login ────────────────────────────────────────────────────────────────────
export async function login({ email, password }) {
    const user = await User.findOne({ email })
    if (!user) throw new Error("Credenciales incorrectas")
    const valid = await bcrypt.compare(password, user.password)
    if (!valid) throw new Error("Credenciales incorrectas")
    if (!user.isVerified) {
        throw new Error("Debes verificar tu correo antes de iniciar sesión")
    }
    return user
}

// ── Verificar correo electrónico ─────────────────────────────────────────────
export async function verifyEmail(token) {
    const user = await User.findOne({
        emailVerificationToken: token,
        emailVerificationExpires: { $gt: new Date() }
    })

    if (!user) throw new Error("El enlace es inválido o ha expirado")

    user.isVerified = true
    user.emailVerificationToken = null
    user.emailVerificationExpires = null
    await user.save()

    return user
}

// ── Solicitar recuperación de contraseña ────────────────────────────────────
export async function requestPasswordReset(email) {
    const user = await User.findOne({ email })
    // No revelar si el correo existe o no por seguridad
    if (!user) return null

    const resetToken = generateToken()
    user.passwordResetToken = resetToken
    user.passwordResetExpires = new Date(Date.now() + 60 * 60 * 1000) // 1h
    await user.save()

    return { user, resetToken }
}

// ── Restablecer contraseña ───────────────────────────────────────────────────
export async function resetPassword(token, newPassword) {
    const user = await User.findOne({
        passwordResetToken: token,
        passwordResetExpires: { $gt: new Date() }
    })

    if (!user) throw new Error("El enlace es inválido o ha expirado")

    user.password = await bcrypt.hash(newPassword, 10)
    user.passwordResetToken = null
    user.passwordResetExpires = null
    await user.save()

    return user
}
