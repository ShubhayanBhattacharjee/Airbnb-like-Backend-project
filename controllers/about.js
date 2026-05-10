const about = (req, res) => {
  res.status(200).render("about", {
    pageTitle: "About",
    path: "/about",
    isLoggedIn: req.isLoggedIn,
    user: req.session.user
  });
};
export const aboutController = { about };