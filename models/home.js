import fs from "fs";
import { register } from "module";
import path from "path";
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default class Home{
    constructor(houseName,price,location,no_of_bedRooms,photoUrl){
        this.houseName=houseName;
        this.price=price;
        this.location=location;
        this.no_of_bedRooms=no_of_bedRooms;
        this.photoUrl=photoUrl || "/images/img.jpg";
    }
    save(){
        Home.fetchAll(registeredHomes=>{
            registeredHomes.push(this);
            const filePath=path.join(__dirname,'..','data','homes.json');
            fs.writeFile(filePath,JSON.stringify(registeredHomes),(err)=>{
            console.log(err);
        });
    });    
    }
    static fetchAll(callback){
        const filePath=path.join(__dirname,'..','data','homes.json');
        fs.readFile(filePath,(err,data)=>{
            if (err || data.length === 0) {
            callback([]);
            } else {
                try {
                    callback(JSON.parse(data));
                } catch (e) {
                    callback([]);
                }
            }
        });
    }
}