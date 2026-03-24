import mongoose from "mongoose"
import 'dotenv/config'

async function conectar(){
    try{
        await mongoose.connect(process.env.MONGO_URL)
        console.log("Conectado a MongoDB Atlas")
    }
    catch(err){
        console.log("Error de conexión " + err)
    }
}

export default conectar