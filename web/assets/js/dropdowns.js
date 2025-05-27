document.addEventListener("DOMContentLoaded", function () {
  // Abrir/cerrar dropdown
  function toggleDropdown(id) {
    const dropdown = document.getElementById("dropdown-" + id);
    if (dropdown) {
      const isVisible = dropdown.style.display === "block";
      closeAllDropdowns();
      dropdown.style.display = isVisible ? "none" : "block";
    }
  }

  // Cerrar todos los dropdowns
  function closeAllDropdowns() {
    document.querySelectorAll(".dropdown-options").forEach((dropdown) => {
      dropdown.style.display = "none";
    });
  }

  // Escuchar clicks afuera para cerrar dropdowns
  document.addEventListener("click", function (event) {
    document.querySelectorAll(".custom-multiselect").forEach((wrapper) => {
      if (!wrapper.contains(event.target)) {
        wrapper.querySelector(".dropdown-options").style.display = "none";
      }
    });
  });

  // Inicializar cada multiselect con contador dinámico
  function initCustomMultiselects() {
    document.querySelectorAll(".custom-multiselect").forEach((wrapper) => {
      const id = wrapper.dataset.id;
      const dropdown = wrapper.querySelector(".dropdown-options");
      const checkboxes = dropdown.querySelectorAll("input[type='checkbox']");
      const countSpan = document.getElementById(`${id}-count`);

      checkboxes.forEach((checkbox) => {
        checkbox.addEventListener("change", () => {
          const selectedCount = [...checkboxes].filter(
            (cb) => cb.checked
          ).length;
          countSpan.textContent =
            selectedCount > 0 ? `(${selectedCount}) ▼` : "▼";
        });
      });
    });
  }

  // Exponer globalmente toggleDropdown (para usarlo en HTML)
  window.toggleDropdown = toggleDropdown;

  // Inicializar todo
  initCustomMultiselects();

  window.resetFiltros = function () {
    // Deselecciona todos los checkboxes de los dropdowns personalizados
    document
      .querySelectorAll('.dropdown-options input[type="checkbox"]')
      .forEach((cb) => {
        cb.checked = false;
      });

    // Reinicia los contadores de los botones
    document.querySelectorAll(".custom-multiselect").forEach((wrapper) => {
      const id = wrapper.dataset.id;
      const countSpan = document.getElementById(`${id}-count`);
      if (countSpan) {
        countSpan.textContent = "▼";
      }
    });

    // También resetea selects normales si tenés
    document.querySelectorAll(".filtro-select").forEach((select) => {
      select.selectedIndex = 0;
    });

    // TODO opcional: volver a mostrar todas las propiedades
    // filtrarPropiedades(); // si usás JS para eso
  };
});
