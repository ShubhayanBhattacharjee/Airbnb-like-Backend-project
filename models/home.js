const registeredHomes=[]

export default class Home{
    constructor(houseName,price,location,no_of_bedRooms,photoUrl){
        this.houseName=houseName;
        this.price=price;
        this.location=location;
        this.no_of_bedRooms=no_of_bedRooms;
        this.photoUrl=photoUrl || "/images/img.jpg";
    }
    save(){
        registeredHomes.push(this);
    }
    static fetchAll(){
        return registeredHomes;
    }
}