$(document).ready(function () {
    $.ajaxSetup({ cache: false });

    let areaData = [];

    // Fetch JSON
    $.ajax({
        url: "../response/gosp-dropdown.json",
        dataType: "json",
        success: function (data) {
            console.log("Loaded GOSP JSON:", data);
            areaData = data.areas;
            populateAreas(areaData);
            if (areaData.length > 0) {
                $("#area").val(areaData[0].name).trigger("change"); // Trigger change to populate dependent fields
            }
        },
        error: function (xhr, status, error) {
            console.error("Error loading GOSP data:", error);
        }
    });

    // Populate Area dropdown
    function populateAreas(areas) {
        const areaSelect = $("#area");
        areaSelect.empty();
        areaSelect.append(`<option disabled selected value="">Select Area</option>`);
        areas.forEach(area => {
            areaSelect.append(`<option value="${area.name}">${area.name}</option>`);
        });
    }

    // Listen for area change
    $("#area").on("change", function () {
        const selectedArea = $(this).val();
        const matchedArea = areaData.find(a => a.name === selectedArea);
        if (matchedArea) {
            console.log("Selected Area:", matchedArea);
            populateProductGroups(matchedArea.product_groups);
            populateGOSPs(matchedArea.gosps);
        }
    });

    // Populate Product Groups
    function populateProductGroups(productGroups) {
        const productGroupSelect = $("#productGroup");
        productGroupSelect.empty().append(`<option disabled selected value="">Select Product Group</option>`);
        productGroups.forEach(group => {
            productGroupSelect.append(`<option value="${group.name}">${group.name}</option>`);
        });

        productGroupSelect.off("change").on("change", function () {
            const selectedGroup = $(this).val();
            const matchedGroup = productGroups.find(g => g.name === selectedGroup);
            if (matchedGroup) {
                populateProducts(matchedGroup.products);
            }
        });
    }

    // Populate Products
    function populateProducts(products) {
        const productSelect = $("#product");
        productSelect.empty().append(`<option disabled selected value="">Select Product</option>`);

        products.forEach(product => {
            productSelect.append(`<option value="${product}">${product}</option>`);
        });

        // ✅ Auto-select if only 1 product
        if (products.length === 1) {
            productSelect.val(products[0]).trigger("change");
        }
    }

    // Populate GOSPs
    function populateGOSPs(gosps) {
        const gospContainer = $("#gospContainer");
        const gospHeader = $(".gosp-header");
        gospContainer.empty();

        if (gosps.length > 1) {
            // Show Select All if more than 1 GOSP
            gospHeader.find("#selectAllGosp").parent().show();
        } else {
            // Hide Select All if only 1 GOSP
            gospHeader.find("#selectAllGosp").parent().hide();
        }

        gosps.forEach(gosp => {
            const checkboxHtml = `
            <div class="gosp-checkbox">
              <input type="checkbox" class="form-check-input" id="${gosp}" value="${gosp}">
              <label class="form-check-label" for="${gosp}">${gosp}</label>
            </div>
          `;
            gospContainer.append(checkboxHtml);
        });

        attachSelectAllListener(); // Always attach after generating
    }
    function populateGOSPs(gosps) {
        const gospContainer = $("#gospContainer");
        const gospHeader = $(".gosp-header");
        gospContainer.empty();

        if (gosps.length > 1) {
            gospHeader.find("#selectAllGosp").parent().show();
        } else {
            gospHeader.find("#selectAllGosp").parent().hide();
        }

        gosps.forEach(gosp => {
            const checkboxHtml = `
            <div class="gosp-checkbox">
              <input type="checkbox" class="form-check-input" id="${gosp}" value="${gosp}">
              <label class="form-check-label" for="${gosp}">${gosp}</label>
            </div>
          `;
            gospContainer.append(checkboxHtml);
        });

        // ✅ Auto-select if only 1 GOSP checkbox
        if (gosps.length === 1) {
            $("#gospContainer input[type='checkbox']").prop("checked", true);
        }

        attachSelectAllListener();
    }

    // Attach event after populating GOSP checkboxes
    function attachSelectAllListener() {
        $("#selectAllGosp").on("change", function () {
            const isChecked = $(this).is(":checked");
            $("#gospContainer input[type='checkbox']").prop("checked", isChecked);
        });

        // Sync "Select All" if manually checking/unchecking
        $("#gospContainer").on("change", "input[type='checkbox']", function () {
            const allCheckboxes = $("#gospContainer input[type='checkbox']");
            const allChecked = allCheckboxes.length === allCheckboxes.filter(":checked").length;
            $("#selectAllGosp").prop("checked", allChecked);
        });
    }

    // Initialize Datepicker & default date
    $("#monthPicker").datepicker({
        format: "M yyyy",
        startView: "months",
        minViewMode: "months",
        autoclose: true
    }).datepicker("setDate", new Date());

    // Validation + button logic
    function validateForm() {
        // Clear all existing error messages
        $(".error-message").remove();

        const errors = {
            area: "",
            productGroup: "",
            product: "",
            month: "",
            gosp: ""
        };

        if (!$("#area").val()) errors.area = "Select Area.";
        if (!$("#productGroup").val()) errors.productGroup = "Select Product Group.";
        if (!$("#product").val()) errors.product = "Select Product.";
        if (!$("#monthPicker").val()) errors.month = "Select Month.";
        if ($("#gospContainer input:checked").length === 0) errors.gosp = "Select at least one GOSP.";

        // Add error messages below each field only if there are errors
        if (errors.area) $("#area").after(`<div class="error-message text-danger">${errors.area}</div>`);
        if (errors.productGroup) $("#productGroup").after(`<div class="error-message text-danger">${errors.productGroup}</div>`);
        if (errors.product) $("#product").after(`<div class="error-message text-danger">${errors.product}</div>`);
        if (errors.month) $("#monthPicker").after(`<div class="error-message text-danger">${errors.month}</div>`);
        if (errors.gosp) $("#gospContainer").after(`<div class="error-message text-danger">${errors.gosp}</div>`);

        // Enable/disable proceed button based on validation
        const isValid = Object.values(errors).every(error => !error);
        $("#btn-proceed").prop("disabled", !isValid);

        return isValid;
    }

    // Handle View 1 button click
    $("#btn-proceed-view1").click(function (e) {
        e.preventDefault();
        if (!validateForm()) return;

        const url = generateRedirectURL("gosp-simulator-detail-view-one.html");
        window.location.href = url;
    });

    // Handle View 2 button click
    $("#btn-proceed-view2").click(function (e) {
        e.preventDefault();
        if (!validateForm()) return;

        const url = generateRedirectURL("gosp-simulator-detail-view-two.html");
        window.location.href = url;
    });

    // Utility to build the redirect URL
    function generateRedirectURL(basePage) {
        const selectedGOSPs = $("#gospContainer input:checked")
            .map(function () {
                return this.value;
            })
            .get()
            .join(",");

        return `${basePage}?area=${$("#area").val()}&productGroup=${$("#productGroup").val()}&product=${$("#product").val()}&month=${$("#monthPicker").val()}&gosp=${encodeURIComponent(selectedGOSPs)}`;
    }

});