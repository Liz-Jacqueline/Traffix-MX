dotenv.config()
import express from "express"
import dotenv from "dotenv"

import cookieParser from "cookie-parser"
import jwt from "jsonwebtoken"
import rutas from "./routes/rutas.js"
import conectar from "./database/db.js"
import { PORT, JWT_SECRET } from "./config.js"



const app = express()

// conectar base de datos
conectar()

app.set("view engine","ejs")

app.use(express.json())
app.use(express.urlencoded({extended:true}))
app.use(cookieParser())

// middleware sesión
app.use((req,res,next)=>{
    const token = req.cookies.access_token
    req.session = { user:null }
    if(!token){
        return next()
    }
    try{
        const data = jwt.verify(token,JWT_SECRET)
        req.session.user = data
    }
    catch{
        req.session.user = null
    }
    next()
})

app.use(express.static("public"))

app.use("/",rutas)

app.listen(PORT,()=>{

    console.log("Servidor en http://localhost:"+PORT)

})
