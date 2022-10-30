// TODO: Remove TailwindCSS
const modalScreen = document.getElementById("modalScreen");
const closeModalBtn = document.getElementById("modal-close");
const inputSearch = document.getElementById("searchInput");

/**
 * Toggle the modal
 */
const toggleModal = () =>
  modalScreen.style.display === "block"
    ? (modalScreen.style.display = "none")
    : (modalScreen.style.display = "block");

modalScreen.style.display = "none";
closeModalBtn.addEventListener("click", toggleModal);
inputSearch.addEventListener("input", (event) => {
  const { value } = event.target;
  const suggestionsContainer = document.getElementById("suggestions");

  if (value.length >= 2) {
    // Display suggestions
    suggestionsContainer.style.display = "block";

    // Only keep buildings with non undefined name
    let suggestions = buildings.features.filter(
      (feature) => feature.properties.name !== undefined
    );
    suggestions = suggestions.filter((feature) => {
      const { name, short_name } = feature.properties;
      return (
        name.toLowerCase().includes(value.toLowerCase()) ||
        (short_name && short_name.toLowerCase().includes(value.toLowerCase()))
      );
    });

    // Inject suggestions into the DOM
    suggestionsContainer.innerHTML = "";
    suggestions.forEach((suggestion) => {
      const suggestionEl = document.createElement("li");
      suggestionEl.innerHTML = suggestion.properties.name;
      suggestionEl.addEventListener("click", () => {
        // Close suggestions
        suggestionsContainer.style.display = "none";

        const { name } = suggestion.properties;
        inputSearch.value = name;
        suggestionsContainer.innerHTML = "";

        // Center the map to the building
        const building2d = map
          .getLayer("2d-buildings")
          ._geoList.filter((feature) => feature.properties.name === name)[0];
        map.setCenter(building2d.getCenter());

        // Focus on the building and flash the building
        const building3D = map
          .getLayer("3d-buildings")
          .getMeshes()
          .filter(
            (mesh) => mesh.options?.polygon?.properties?.name === name
          )[0];

        building3D
          .animateShow({
            duration: 1000,
            easing: "out",
          })
          .play();
        building2d.flash(150, 4);
      });
      suggestionsContainer.appendChild(suggestionEl);
    });
  } else {
    suggestionsContainer.style.display = "none";
    suggestionsContainer.innerHTML = "";
  }
});

/**
 * Change title and description of modal
 * @param {string} title
 * @param {string} content
 */
const injectModal = (title, content) => {
  document.getElementById("modalTitle").innerText = title;
  document.getElementById("modalContent").innerHTML = content;
};

// Tile services
const TILES = {
  f43D: "https://tile.f4map.com/tiles/f4_3d/{z}/{x}/{y}.png",
  osm: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
  cartoDbVoyager:
    "https://cartodb-basemaps-{s}.global.ssl.fastly.net/rastertiles/voyager_labels_under/{z}/{x}/{y}.png",
};

const CENTER = [1.468, 43.5696];
const ZOOM = 18;
const MINZOOM = ZOOM;
const MAXZOOM = 20;
const PITCH = 45;
const BEARING = 0;

// Map
const map = new maptalks.Map("map", {
  center: CENTER,
  zoom: ZOOM,
  minZoom: MINZOOM,
  maxZoom: MAXZOOM,
  pitch: PITCH,
  bearing: BEARING,

  baseLayer: new maptalks.TileLayer("tile", {
    urlTemplate: TILES.f43D,
    subdomains: ["a", "b", "c", "d"],
  }),
  layers: [
    new maptalks.VectorLayer("bounds"),
    new maptalks.VectorLayer("2d-buildings"),
  ],
  attribution: {
    content:
      '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, &copy; <a href="https://carto.com/attributions">CARTO</a>',
  },
});

// Bounds
const extent = map.getExtent();
extent.xmin = 1.464;
extent.xmax = 1.4715;
extent.ymin = 43.567;
extent.ymax = 43.574;
map.setMaxExtent(extent);
map.getLayer("bounds").addGeometry(
  new maptalks.Polygon(extent.toArray(), {
    symbol: { polygonOpacity: 0, lineWidth: 0 },
  })
);

// 2D buildings Layer
buildings.features.forEach((feature) => {
  const building2D = new maptalks.GeoJSON.toGeometry(feature);
  building2D.setSymbol({
    polygonFill: "#f6efe4",
  });
  building2D.addTo(map.getLayer("2d-buildings"));
});

// 3D Buildings Layer
const threeLayer = new maptalks.ThreeLayer("3d-buildings", {
  forceRenderOnMoving: true,
  forceRenderOnRotating: true,
  animation: true,
});
threeLayer.prepareToDraw = function (gl, scene, camera) {
  const light = new THREE.DirectionalLight(0xf6efe4, 1);
  light.position.set(1, 0, 1);
  scene.add(light);

  buildings.features.forEach(function (building) {
    const height = building.properties.height * 2;

    const meshBuilding = threeLayer.toExtrudePolygon(
      building,
      {
        height: height,
        bloom: true,
        top: "#f00",
        asynchronous: true,
      },
      new THREE.MeshPhongMaterial({
        color: 0xffffff,
      })
    );

    meshBuilding.on("mouseover", (e) => e.target.setHeight(height * 1.25));
    meshBuilding.on("mouseout", (e) => e.target.setHeight(height));

    // Extrude the building on 1st spawn
    meshBuilding.animateShow({
      duration: 3000,
    });

    // Display a tooltip when hovering the building
    building.properties.name &&
      meshBuilding.setToolTip(building.properties.name, {
        showTimeout: 0,
        eventsPropagation: true,
        dx: 15,
        dy: 15,
      });

    // Display a message box when clicking the building
    building.properties.name &&
      meshBuilding.setInfoWindow({
        title: building.properties.name,
        content: building.properties.description || "Pas de description",
      });

    threeLayer.addMesh(meshBuilding);
  });
};
map.addLayer(threeLayer);

// Controls
const up = () => map.panBy([0, 200]);
const down = () => map.panBy([0, -200]);
const left = () => map.panBy([200, 0]);
const right = () => map.panBy([-200, 0]);
const zoomIn = () => map.setZoom(map.getZoom() + 0.5);
const zoomOut = () => map.setZoom(map.getZoom() - 0.5);
const reset = () => {
  map.setCenter(CENTER);
  map.setZoom(ZOOM);
  map.setPitch(PITCH);
  map.setBearing(BEARING);
};

/**
 * Change the base layer
 * @param {string} tileService
 */
const changeTileService = (tileService) => {
  const baseLayer = map.getBaseLayer();
  baseLayer.options.urlTemplate = tileService;
  map.setBaseLayer(baseLayer);
};

// Show or Hide 3D layer based on pitch value
map.on("pitch", ({ from, to }) => {
  const planeLayer = map.getLayer("2d-buildings");

  // Convert to degrees
  to = (to * 180) / Math.PI;
  if (to <= 2) {
    threeLayer.hide();
    planeLayer.show();
    changeTileService(TILES.cartoDbVoyager);
  } else if (from <= 2) {
    threeLayer.show();
    planeLayer.hide();
    changeTileService(TILES.f43D);
  }
});

/**
 * Toggle the about modal
 */
const showInfoModal = () => {
  toggleModal();
  injectModal(
    "A Propos",
    "<p>Ce projet a été réalisé par des membres du Club Info de l'INSA Toulouse. Il a pour but de vous permettre de découvrir le campus de l'INSA Toulouse en 2D et 3D.</p><p>Pour plus d'informations, n'hésitez pas à contacter le <a href='https://discord.gg/9G8cWyK'>Club Info</a>.</p><p>Toute contribution est la bienvenue, vous pouvez retrouver le code source du site sur notre <a href='https://github.com/ClubInfoInsaT/Map-INSA'>GitHub</a>.</p>"
  );
};
