/**
 * Brand settings — change these two values to rename the product.
 * This is the only file you need to edit for the name and tagline.
 * HTML uses data-brand and data-brand-tagline attributes, which this script fills in.
 */
window.BRAND = {
  name: "AO Intelligence",
  tagline: "An AI agent for your business, set up and looked after for you."
};

(function applyBrand() {
  var brand = window.BRAND || { name: "AO Intelligence", tagline: "" };

  document.querySelectorAll("[data-brand]").forEach(function (el) {
    el.textContent = brand.name;
  });

  document.querySelectorAll("[data-brand-tagline]").forEach(function (el) {
    el.textContent = brand.tagline;
  });

  document.querySelectorAll("[data-brand-title]").forEach(function (el) {
    var suffix = el.getAttribute("data-brand-title") || "";
    document.title = suffix ? brand.name + " — " + suffix : brand.name;
  });

  if (!document.querySelector("[data-brand-title]") && document.title.indexOf("{{brand}}") !== -1) {
    document.title = document.title.replace("{{brand}}", brand.name);
  }
})();
