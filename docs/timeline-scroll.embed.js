(function () {
  var src = "https://cdn.jsdelivr.net/gh/amperedigital/myforexfunds@v1.1/docs/timeline-scroll.min.js";
  fetch(src)
    .then(function (response) { return response.text(); })
    .then(function (code) {
      Function(code + "\n//# sourceURL=timeline-scroll.js").call(window);
    })
    .catch(function (err) {
      console.error("Failed to load timeline script:", err);
    });
})();
