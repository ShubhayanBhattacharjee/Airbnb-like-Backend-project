 
const getLogin=(req, res, next) => {
    res.render("auth/login",{ 
        pageTitle: 'Login',
        isLoggedIn:false
    });
}
const postLogin=(req,res,next)=>{
    res.cookie("isLoggedIn",true);
    // req.isLoggedIn=true;     was setting the isLoggedIn value true for only one requst object of post ofLogin but whenever different get requests came in it terated everything as different requests and hence the values of isLoggedIn got false each time and hence server considered the client as notlogged in and thus didnt show the different pages .
    res.redirect("/");
}
export const authController={getLogin,postLogin};