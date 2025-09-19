import {MongoClient} from 'mongodb';
const MONGO_URL = "mongodb+srv://root:root@airbnb-clone-cluster.cprqz5i.mongodb.net/?retryWrites=true&w=majority&appName=Airbnb-clone-cluster";
let _db;
const mongoConnect =(callback)=>{
    MongoClient.connect(MONGO_URL)
    .then((client)=>{
        callback();
        _db=client.db("airbnb");
        console.log("Connected to MongoDB");
    })
    .catch((err)=>{
        console.log("Error while connecting to the Mongo DB :",err);
    });
};
const getDB=()=>{
    if(!_db){
        throw new Error('Mongo not connected'); 
    }
    return _db;
}
export default mongoConnect;
export {getDB};