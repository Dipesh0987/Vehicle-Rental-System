(function () {
  "use strict";

  function byId(id) {
    return document.getElementById(id);
  }

  function setDefaultDateInputs() {
    var startInput = byId("bookingStartDate");
    var endInput = byId("bookingEndDate");

    if (!startInput || !endInput) {
      return;
    }

    var now = new Date();
    var start = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    var end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 2);

    function toIsoDate(value) {
      var yyyy = value.getFullYear();
      var mm = String(value.getMonth() + 1).padStart(2, "0");
      var dd = String(value.getDate()).padStart(2, "0");
      return yyyy + "-" + mm + "-" + dd;
    }

    startInput.value = toIsoDate(start);
    endInput.value = toIsoDate(end);
  }

  function init() {
    setDefaultDateInputs();

    var status = byId("bookingLiveStatus");
    if (status && (!window.VehicleCatalogService || !window.VehicleBookingService)) {
      status.innerHTML = '<span class="inline-flex h-2.5 w-2.5 rounded-full bg-rose-500"></span><span>Booking services are loading</span>';
    }
  }

  window.VehicleBookingPage = {
    init: init,
  };
})();
