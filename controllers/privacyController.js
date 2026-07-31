const privacy = (req, res) => {
  res.status(200).render("privacy", {
    pageTitle: "Privacy Policy",
    path: "/privacy",
  });
};
export const privacyController = { privacy };