const pageNotFound= (req, res) => {
    res.status(404).render("404", {
        pageTitle: "Page Not Found",
        path: "/404",
        isLoggedIn:req.isLoggedIn
    });
};
export const errorController = {pageNotFound};