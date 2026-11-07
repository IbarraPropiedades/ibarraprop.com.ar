/* Galería de la ficha de propiedad */
document.addEventListener("DOMContentLoaded", function () {
  var slider = document.querySelector(".tokko-detail-swiper");
  if (!slider || !window.Swiper) return;
  var many = Number(slider.dataset.slides) > 1;
  new Swiper(slider, {
    loop: many,
    speed: 400,
    slidesPerView: 1,
    keyboard: { enabled: true },
    navigation: { nextEl: ".tokko-detail-next", prevEl: ".tokko-detail-prev" },
    pagination: { el: ".tokko-detail-pagination", type: "fraction" },
  });
});
