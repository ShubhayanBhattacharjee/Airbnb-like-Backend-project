import fs from "fs";
import path from "path";
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default class Home {
    constructor(houseName, price, location, no_of_bedRooms, photoUrl) {
        this.houseName = houseName;
        this.price = price;
        this.location = location;
        this.no_of_bedRooms = no_of_bedRooms;
        this.photoUrl = photoUrl || "/images/img.jpg";
    }
    save(done) {
        Home.fetchAll(registeredHomes => {
            if (this.id) {
                const index = registeredHomes.findIndex(home => home.id === this.id);
                if (index !== -1) {
                    registeredHomes[index] = this;
                }
            } else {
                this.id = Math.random().toString();
                registeredHomes.push(this);
            }
            const filePath = path.join(__dirname, '..', 'data', 'homes.json');
            fs.writeFile(filePath, JSON.stringify(registeredHomes), err => {
                if (err) console.log(err);
                if (done) done();   // call controller callback
            });
        });
    }
    static fetchAll(callback) {
        const filePath = path.join(__dirname, '..', 'data', 'homes.json');
        fs.readFile(filePath, (err, data) => {
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
    static findById(homeId, callback) {
        this.fetchAll(homes => {
            const homeFound = homes.find(home => home.id === homeId);
            callback(homeFound);
        });
    }
    static DeleteById(homeId, callback) {
        this.fetchAll(homes => {
            homes = homes.filter(home => home.id !== homeId)
            const filePath = path.join(__dirname, '..', 'data', 'homes.json');
            fs.writeFile(filePath, JSON.stringify(homes),callback);
        });   
    }
}