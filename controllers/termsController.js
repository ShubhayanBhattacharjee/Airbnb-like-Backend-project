const terms = (req, res) => {
  res.status(200).render("terms", {
    pageTitle: "Terms & Conditions",
    path: "/terms",
  });
};
export const termsController = { terms };