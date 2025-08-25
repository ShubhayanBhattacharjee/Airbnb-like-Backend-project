import db from "../utils/databaseUtil.js";

export default class Home {
    constructor(houseName, price, location, no_of_bedroom, photoUrl,description,id=null) {
        this.houseName = houseName;
        this.price = price;
        this.location = location;
        this.no_of_bedroom= no_of_bedroom;
        this.photoUrl = photoUrl || "/images/img.jpg";
        this.description = description || "";
        this.id=id;
    }   
     save() {
        if (this.id) {
            // Update existing home
            return db.execute(
                `UPDATE homes 
                SET houseName = ?, price = ?,location = ?,  no_of_bedroom = ?, photoUrl= ?, description = ? 
                WHERE id = ?`,
                [this.houseName, this.price,this.location, this.no_of_bedroom, this.photoUrl, this.description, this.id]
            );
        } else {
            // Insert new home
            return db.execute(
                `INSERT INTO homes (houseName, price,location, no_of_bedroom, photoUrl, description) 
                VALUES (?, ?, ?, ?, ?, ?)`,
                [this.houseName, this.price,this.location, this.no_of_bedroom, this.photoUrl, this.description]
            );
        }
    }
    static fetchAll() {
        return db.execute('SELECT *FROM homes');
    }
    static findById(id) {
        return db.execute("SELECT * FROM homes WHERE id = ?", [id]);
    }
    static DeleteById(id) {
           return db.execute("DELETE FROM homes WHERE id = ?", [id]);
    }
}