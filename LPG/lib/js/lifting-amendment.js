$(document).ready(function () {
  $.ajaxSetup({ cache: false });

  // Configure Toastr
  toastr.options = {
    closeButton: true,
    progressBar: true,
    positionClass: "toast-top-right",
    timeOut: 5000, // 5 seconds
    extendedTimeOut: 2000,
  };

  let mappingData = JSON.parse(
    sessionStorage.getItem("userMappingData") || "[]"
  );

  if (!mappingData.length) {
    $("#error-message").html(
      "\u274C No mapping data found. Please log in again."
    );
    $(".btn-custom").prop("disabled", true);
    return;
  }

  // Populate Terminal dropdown using LOCATION_NAME
  const uniqueLocations = [...new Set(mappingData.map((m) => m.LOCATION_NAME))];
  const terminalSelect = $("#terminal");
  terminalSelect.empty();
  terminalSelect.append(
    `<option selected disabled value="">Select Terminal</option>`
  );
  uniqueLocations.forEach((location) => {
    terminalSelect.append(`<option value="${location}">${location}</option>`);
  });

  // On Terminal change
  terminalSelect.change(function () {
    const selectedLocation = $(this).val();

    // 1. CLEAR PRODUCT GROUP DROPDOWN & CHECKBOXES
    $("#productGroup")
      .empty()
      .append(
        `<option selected disabled value="">Select Product Group</option>`
      );
    $(".products-container").empty(); // Clear previous product checkboxes

    const locationData = mappingData.filter(
      (m) => m.LOCATION_NAME === selectedLocation
    );

    // 2. POPULATE PRODUCT GROUPS
    populateProductGroups(locationData);

    validateForm();
  });

  function populateProductGroups(locationData) {
    const productGroupSelect = $("#productGroup");
    const uniqueGroups = [
      ...new Set(locationData.map((m) => m.PRODUCT_GROUP_NAME)),
    ];

    // Append unique product groups
    uniqueGroups.forEach((group) => {
      productGroupSelect.append(`<option value="${group}">${group}</option>`);
    });

    // Define the change event (to populate products)
    productGroupSelect.off("change").on("change", function () {
      const selectedGroup = $(this).val();

      // Clear previous product checkboxes whenever user changes product group
      $(".products-container").empty();

      const groupProducts = locationData
        .filter((m) => m.PRODUCT_GROUP_NAME === selectedGroup)
        .map((m) => m.PRODUCT_CODE_NAME);

      populateProductCheckboxes([...new Set(groupProducts)]);
      validateForm();
    });

    // Auto-select if there's exactly one product group
    if (uniqueGroups.length === 1) {
      productGroupSelect.val(uniqueGroups[0]).trigger("change");
    }
  }

  function populateProductCheckboxes(products) {
    const productContainer = $(".products-container");
    productContainer.empty();

    products.forEach((product) => {
      const checkboxHtml = `
        <div class="form-check">
          <input
            class="form-check-input"
            type="checkbox"
            id="${product}"
            value="${product}"
            checked
          />
          <label class="form-check-label" for="${product}">${product}</label>
        </div>
      `;
      productContainer.append(checkboxHtml);
    });

    // When user manually checks/unchecks, re-validate form
    $(".products-container .form-check-input").change(function () {
      validateForm();
    });
  }

  // Initialize datepicker
  $("#monthPicker").datepicker({
    format: "M yyyy",
    startView: "months",
    minViewMode: "months",
    autoclose: true,
  });
  $("#monthPicker").val(moment().format("MMM YYYY")).change(validateForm);

  function validateForm() {
    let selectedTerminal = $("#terminal").val();
    let selectedProductGroup = $("#productGroup").val();
    let selectedMonth = $("#monthPicker").val();
    let selectedProducts = $(
      ".products-container .form-check-input:checked"
    ).length;

    let errors = [];
    if (!selectedTerminal) errors.push("Please select a Terminal.");
    if (!selectedProductGroup) errors.push("Please select a Product Group.");
    if (selectedProducts === 0)
      errors.push("Please select at least one Product.");
    if (!selectedMonth) errors.push("Please select a Month.");

    if (errors.length > 0) {
      $("#error-message").html(errors.join("<br>"));
      $(".btn-custom").prop("disabled", true);
      return false;
    } else {
      $("#error-message").html("");
      $(".btn-custom").prop("disabled", false);
      return true;
    }
  }

  function getSelectedValuesAndRedirect(targetPage) {
    const selectedLocationName = $("#terminal").val();
    const selectedGroupName = $("#productGroup").val();
    const selectedMonth = $("#monthPicker").val();
    const selectedProductNames = $(
      ".products-container .form-check-input:checked"
    )
      .map(function () {
        return $(this).next("label").text();
      })
      .get();

    const matched = mappingData.filter(
      (m) =>
        m.LOCATION_NAME === selectedLocationName &&
        m.PRODUCT_GROUP_NAME === selectedGroupName &&
        selectedProductNames.includes(m.PRODUCT_CODE_NAME)
    );

    if (!matched.length) {
      toastr.error("No matching mapping data found.");
      return;
    }
    
    const versionNo = matched[0].VERSION_NO;
    const locationCode = matched[0].LOCATION;
    const productGroupCode = matched[0].PRODUCT_GROUP;
    const productCodes = matched.map((m) => m.PRODUCT_CODE);

    const params = new URLSearchParams({
      terminal: selectedLocationName,
      productGroup: selectedGroupName,
      products: selectedProductNames.join(","),
      locationCode,
      productGroupCode,
      productCodes: productCodes.join(","),
      month: selectedMonth,
      versionNo,
    });

    window.location.href = `${targetPage}?${params.toString()}`;
  }

  $("#btn-view-one").click(function (e) {
    e.preventDefault();
    if (validateForm()) {
      getSelectedValuesAndRedirect("lifting-amendment-detail-view-one.html");
    }
  });

  $("#btn-view-two").click(function (e) {
    e.preventDefault();
    if (validateForm()) {
      getSelectedValuesAndRedirect("lifting-amendment-detail-view-two.html");
    }
  });
});
