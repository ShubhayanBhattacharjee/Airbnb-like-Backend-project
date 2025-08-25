import mysql from "mysql2";
const pool=mysql.createPool({
    host:"localhost",
    user:"root",
    password:"Expert#9",
    database:"Airbnb",
});
export default pool.promise();