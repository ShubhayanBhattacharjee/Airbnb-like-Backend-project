const contact = (req, res) => {
  res.status(200).render("contact", {
    pageTitle: "Contact",
    path: "/contact",
    isLoggedIn: req.isLoggedIn,
    user: req.session.user
  });
};
export const contactController = { contact };