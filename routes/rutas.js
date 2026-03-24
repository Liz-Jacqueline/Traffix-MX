import { Router } from "express"
import jwt from "jsonwebtoken"
import { JWT_SECRET } from "../config.js"

import * as UserRepository from "../repository/user-repository.js"
import { sendVerificationEmail, sendPasswordResetEmail } from "../services/emailService.js"

const router = Router()

// HOME
router.get("/", (req, res) => {
    res.render("home")
})

// LOGIN GET
router.get("/login", (req, res) => {
    res.render("login", { query: req.query })
})

// REGISTER POST
router.post("/register", async (req, res) => {
    const { name, email, password } = req.body

    try {
        const { verificationToken } = await UserRepository.create({ name, email, password })

        console.log("Token generado:", verificationToken)

        await sendVerificationEmail(email, verificationToken)
            .then(() => console.log("Correo enviado correctamente"))
            .catch(err => console.error("Error enviando correo:", err))

        // 🔥 IMPORTANTE: NO entrar directo
        res.redirect("/login?verify=1")

    } catch (error) {
        console.error("Error al registrar:", error.message)
        res.redirect("/login?error=" + encodeURIComponent(error.message))
    }
})

// VERIFY EMAIL
router.get("/verify-email", async (req, res) => {
    const { token } = req.query

    try {
        await UserRepository.verifyEmail(token)
        res.redirect("/login?verified=1")
    } catch (error) {
        res.redirect("/login?error=" + encodeURIComponent(error.message))
    }
})

// LOGIN POST
router.post("/login", async (req, res) => {
    const { email, password } = req.body

    try {
        const user = await UserRepository.login({ email, password })

        const token = jwt.sign(
            { id: user._id, email: user.email },
            JWT_SECRET,
            { expiresIn: "1h" }
        )

        res.cookie("access_token", token, {
            httpOnly: true,
            sameSite: "lax"
        })

        res.redirect("/control")

    } catch (error) {
        console.error("Error al iniciar sesión:", error.message)
        res.redirect("/login?error=" + encodeURIComponent(error.message))
    }
})

// SIMULADOR
router.get("/control", (req, res) => {
    const token = req.cookies?.access_token
    if (!token) return res.redirect("/login")

    try {
        jwt.verify(token, JWT_SECRET)
        res.render("simulador", { query: req.query })
    } catch {
        res.redirect("/login")
    }
})

// FORGOT PASSWORD GET
router.get("/forgot-password", (req, res) => {
    res.render("forgot-password", { query: req.query })
})

// FORGOT PASSWORD POST
router.post("/forgot-password", async (req, res) => {
    const { email } = req.body

    try {
        const result = await UserRepository.requestPasswordReset(email)

        if (result) {
            await sendPasswordResetEmail(result.user.email, result.resetToken)
        }

        res.redirect("/forgot-password?sent=1")

    } catch (error) {
        console.error("Error al solicitar reset:", error.message)
        res.redirect("/forgot-password?error=1")
    }
})

// RESET PASSWORD GET
router.get("/reset-password", (req, res) => {
    const { token } = req.query
    if (!token) return res.redirect("/login")
    res.render("reset-password", { token, query: req.query })
})

// RESET PASSWORD POST
router.post("/reset-password", async (req, res) => {
    const { token, password, confirmPassword } = req.body

    if (password !== confirmPassword) {
        return res.redirect(`/reset-password?token=${token}&error=Las+contraseñas+no+coinciden`)
    }

    try {
        await UserRepository.resetPassword(token, password)
        res.redirect("/login?reset=1")
    } catch (error) {
        console.error("Error al restablecer contraseña:", error.message)
        res.redirect(`/reset-password?token=${token}&error=` + encodeURIComponent(error.message))
    }
})

// LOGOUT
router.get("/logout", (req, res) => {
    res.clearCookie("access_token")
    res.redirect("/login")
})

export default router