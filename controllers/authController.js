const getLogin=(req, res, next) => {
    res.render("auth/login",{ 
        pageTitle: 'Login',
        isLoggedIn:false
    });
}

const postLogin = (req, res, next) => {
    req.session.isLoggedIn = true;
    req.session.save(err => {
        if(err) console.log(err);
        res.redirect("/");
    });
};


const postLogout=(req,res,next)=>{
    req.session.destroy(err => {
        if(err) console.log(err);
        res.redirect("/");
    });
}

export const authController={getLogin,postLogin,postLogout};