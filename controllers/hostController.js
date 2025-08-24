import Home from '../models/home.js';
 
const getaddHome=(req, res, next) => {
    res.render("host/editHome",{ pageTitle: 'Add Home',editing:false});
}

const getEditHome=(req, res, next) => {
    const homeId=req.params.homeId;
    const editing=req.query.editing==='true';
    Home.findById(homeId,home=>{
        if(!home){
            console.log("Home not found for editing.\n");
            return res.redirect("/host/hostHomeList");
        }else{
            console.log(homeId,editing,home);
            res.render("host/editHome",{ 
                home:home,
                pageTitle: 'Edit Home',
                editing:editing,
            });
        }
    }); 
}

const postaddHome=(req, res, next) => {
    const {houseName,price,location,no_of_bedRooms,photoUrl} =req.body;
    const home = new Home(houseName,price,location,no_of_bedRooms,photoUrl);
    home.save();    
    res.redirect('/host/hostHomeList');

}

const hostHomeList=(req, res, next) => {
    const homes=Home.fetchAll(homes=>{
        res.render("host/hostHomeList",{ 
            pageTitle: 'Host Home List', 
            registeredHomes: homes 
        });
    });
}

const postEditHome=(req, res, next) => {
    const {id,houseName,price,location,no_of_bedRooms,photoUrl} =req.body;
    const home = new Home(houseName,price,location,no_of_bedRooms,photoUrl);
    home.id=id;
    home.save(()=>{
        res.redirect('/host/hostHomeList');
    });    
}

const postDeleteHome=(req, res, next) => {
    const homeId=req.params.homeId;
    Home.DeleteById(homeId,error=>{
        if(error){
            console.log("Error while the home\n",error);
        }
        res.redirect('/host/hostHomeList');
    }) 
}

export const hostController={postDeleteHome,getaddHome,postaddHome,hostHomeList,getEditHome,postEditHome};