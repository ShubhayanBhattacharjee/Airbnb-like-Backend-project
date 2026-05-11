import User from "../models/user.js";
const hosts = async (req, res) => {
    try{
        const hosts=await User.find({role:"host"});
        const countries = [...new Set(
            hosts
                .map(host => host.country)
                .filter(country => country && country.trim() !== "")
        )];
        res.status(200).render("hosts", {
            pageTitle: "Hosts",
            path: "/Hosts",
            isLoggedIn: req.isLoggedIn,
            user: req.session.user,
            hosts,
            countries
        });
    }catch(err){
        console.log(err);
        res.status(500).send("Server Error");
    }
  
};
export const hostsController = { hosts };