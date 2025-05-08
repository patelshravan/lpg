import { BASE_URL, API_ENDPOINTS } from '../api/api-config.js';

$(document).ready(function () {
  $.ajaxSetup({ cache: false });

  let customerAmendmentModalInstance = null;

  // 1) Open the modal & build the table
  $('.btn:contains("Select Customer Amendment Requests")').on("click", function () {
    const $tbody = $("#customerAmendmentTable tbody");

    if ($tbody.length === 0) {
      console.error("Table body #customerAmendmentTable tbody not found in the DOM.");
      toastr.error("Table element not found. Please check the HTML structure.");
      return;
    }

    $tbody.empty();

    $.ajax({
      url: API_ENDPOINTS.CUSTOMER_AMENDMENT_REQUESTS,
      method: "GET",
      dataType: "json",
      cache: false,
      success: function (data) {
        const amendmentRequests = data["CUSTOMERAMENDMENTREQUESTS"];
        window.latestAmendmentRequests = amendmentRequests;

        if (!Array.isArray(amendmentRequests)) {
          toastr.error("Invalid data format.");
          return;
        }

        if (amendmentRequests.length === 0) {
          $tbody.append("<tr><td colspan='7' class='text-center'>No amendment requests available.</td></tr>");
          return;
        }

        amendmentRequests.forEach((row) => {
          const {
            NOMINATION_NO,
            SHIP_NAME,
            DATE_VALUE,
            SCHEDULED_QTY,
            DATE_VALUE_ADJ,
            SCHEDULED_QTY_ADJ
          } = row;

          const dateChanged = DATE_VALUE !== DATE_VALUE_ADJ;
          const qtyChanged = SCHEDULED_QTY !== SCHEDULED_QTY_ADJ;
          let type = "—";
          if (dateChanged && qtyChanged) type = "Both Changed";
          else if (dateChanged) type = "Date Changed";
          else if (qtyChanged) type = "Qty Changed";

          const $tr = $("<tr>")
            .append(`<td>${NOMINATION_NO} / ${SHIP_NAME}</td>`)
            .append(`<td>${DATE_VALUE} | ${SCHEDULED_QTY}</td>`)
            .append(`<td>${DATE_VALUE_ADJ} | ${SCHEDULED_QTY_ADJ}</td>`)
            .append(`<td>${type}</td>`)
            .append(`<td><input type="checkbox" class="apply-both-checkbox" id="applyBoth_${NOMINATION_NO}" /></td>`)
            .append(`<td><input type="checkbox" class="apply-qty-checkbox" id="applyQty_${NOMINATION_NO}" /></td>`)
            .append(`<td><input type="checkbox" class="apply-date-checkbox" id="applyDate_${NOMINATION_NO}" /></td>`);

          $tbody.append($tr);
        });

        $("#checkAllBoth").off("change").on("change", function () {
          $(".apply-both-checkbox").prop("checked", this.checked);
        });
        $("#checkAllQty").off("change").on("change", function () {
          $(".apply-qty-checkbox").prop("checked", this.checked);
        });
        $("#checkAllDate").off("change").on("change", function () {
          $(".apply-date-checkbox").prop("checked", this.checked);
        });

        if (!customerAmendmentModalInstance) {
          customerAmendmentModalInstance = new bootstrap.Modal(document.getElementById("customerAmendmentModal"));
        }
        customerAmendmentModalInstance.show();
      },
      error: function (xhr, status, error) {
        console.error("Failed to load customer amendment requests:", status, error);
        toastr.error("Failed to load amendment requests: " + error);
        $tbody.append("<tr><td colspan='7' class='text-center'>Error loading data. Please try again.</td></tr>");
      }
    });
  });

  $("#viewInScenarioBtn").off("click").on("click", function () {
    const missingNominations = [];

    $("#customerAmendmentTable tbody tr").each(function () {
      const $row = $(this);
      const nominationText = $row.find("td:first").text().trim(); // NOM123 / Ship A
      const [nominationNumber, shipName] = nominationText.split(" / ").map((s) => s.trim());

      const originalDate = parseInt($row.find("td").eq(1).text().split("|")[0].trim());
      const revisedDate = parseInt($row.find("td").eq(2).text().split("|")[0].trim());

      const originalQty = parseFloat($row.find("td").eq(1).text().split("|")[1].trim()) || 0;
      const revisedQty = parseFloat($row.find("td").eq(2).text().split("|")[1].trim()) || 0;

      const applyBoth = $row.find(".apply-both-checkbox").is(":checked");
      const applyQty = $row.find(".apply-qty-checkbox").is(":checked");
      const applyDate = $row.find(".apply-date-checkbox").is(":checked");

      if (!(applyBoth || applyQty || applyDate)) return;

      let matchFound = false;

      for (let row of liftingAmendmentData) {
        if (!Array.isArray(row.nomination)) continue;

        const nominationIndex = row.nomination.findIndex(
          (n) => n.nominationNumber === nominationNumber
        );
        if (nominationIndex === -1) continue;

        const match = row.nomination[nominationIndex];
        matchFound = true;

        // 🧮 Apply Qty
        if (applyBoth || applyQty) {
          const productKey = Object.keys(match).find((k) => k.startsWith("adjustedQty_"));
          if (productKey) {
            match[productKey] = revisedQty;
          }
        }

        // 📅 Apply Date + Move logic
        if ((applyBoth || applyDate) && revisedDate !== originalDate) {
          // Remove from old row
          const nomination = row.nomination.splice(nominationIndex, 1)[0];
          nomination.DATE_VALUE_ADJ = revisedDate;

          // Push to target row
          let targetRow = liftingAmendmentData.find((r) => r.date === revisedDate);
          if (!targetRow) {
            targetRow = { date: revisedDate, id: "row_" + revisedDate, nomination: [] };
            liftingAmendmentData.push(targetRow);
          }
          if (!Array.isArray(targetRow.nomination)) targetRow.nomination = [];
          targetRow.nomination.push(nomination);

          // Update customer lifting adjustments on both rows
          const productKey = Object.keys(nomination).find((k) => k.startsWith("adjustedQty_"));
          const product = productKey?.split("_")[1];
          if (product) {
            row[`adjustment_${product}CL`] = (row.nomination || []).reduce(
              (sum, n) => sum + (n[`adjustedQty_${product}`] || 0), 0
            );
            targetRow[`adjustment_${product}CL`] = (targetRow.nomination || []).reduce(
              (sum, n) => sum + (n[`adjustedQty_${product}`] || 0), 0
            );
          }
        }

        break; // Done for this row
      }

      if (!matchFound) {
        missingNominations.push(nominationNumber);
      }
    });

    if (missingNominations.length > 0) {
      toastr.warning("Some nominations not found in scenario: " + missingNominations.join(", "));
    } else {
      toastr.success("Scenario updated with selected amendment requests.");
    }

    updateLiftingGrid();
    renderAllKpiCards();
    if (customerAmendmentModalInstance) {
      customerAmendmentModalInstance.hide();
    }
  });

  // footer button handlers
  $("#sendEmailBtn").on("click", () => {
    const selected = $(".apply-both-checkbox:checked")
      .closest("tr")
      .map((_, tr) => $(tr).find("td:first").text())
      .get();
    console.log("Send email for:", selected);
  });

  let inventoryData = [];

  var currentUnit = "MB";
  var unitConversionFactors = {};
  let userUpdatedUOMFactors = {};
  let minMaxPercentageData = [];
  let activeVersionFromReadAPI = null;

  // Configure Toastr
  toastr.options = {
    closeButton: true,
    progressBar: true,
    positionClass: "toast-top-right",
    timeOut: 5000, // 5 seconds
    extendedTimeOut: 2000,
  };

  function getQueryParams() {
    let params = new URLSearchParams(window.location.search);

    return {
      terminal: params.get("terminal"),
      locationCode: params.get("locationCode"),
      productGroup: params.get("productGroup"),
      productGroupCode: params.get("productGroupCode"),
      products: params.get("productCodes")?.split(",") || [],
      productCodes: params.get("productCodes")?.split(",") || [],
      month: params.get("month"),
      versionNo: params.get("versionNo"),
    };
  }

  const selection = getQueryParams();
  console.log(getQueryParams());

  function unique(array) {
    return Array.from(new Set(array));
  }

  selection.products = unique(selection.products);

  callReadAPIWithSelection(selection);

  // Bind Save button
  $("#saveButton").on("click", function () {
    saveData();
  });

  async function saveData() {
    $("#loadingSpinner").show();
    let nominationAggregate = [];

    // Rebuild inventoryData to preserve all original fields AND inject adjusted values
    inventoryData = inventoryData.map((inv) => {
      const date = inv.DATE_VALUE;
      const product = inv.PRODUCT_CODE;

      const matchingRow = liftingAmendmentData.find((r) => r.date === date);

      return {
        ...inv,
        TERMINAL_AVAILS_ADJ: matchingRow?.[`adjustment_${product}TA`] || 0,
        CUSTOMER_LIFTING_ADJ: matchingRow?.[`adjustment_${product}CL`] || 0,
      };
    });

    liftingAmendmentData.forEach((row) => {
      if (!Array.isArray(row.nomination)) return;

      row.nomination.forEach((nom) => {
        const allProductCodesInNom = new Set();

        Object.keys(nom).forEach((key) => {
          if (
            key.startsWith("scheduledQty_") ||
            key.startsWith("adjustedQty_")
          ) {
            const productCode = key.split("_")[1];
            allProductCodesInNom.add(productCode);
          }
        });

        allProductCodesInNom.forEach((productCode) => {
          const originalMeta = originalNominationList.find(
            (item) =>
              item.NOMINATION_NO === nom.nominationNumber &&
              item.PRODUCT_CODE === productCode
          );

          nominationAggregate.push({
            ...(originalMeta || {}),
            nominationNumber: nom.nominationNumber,
            customerName: nom.customerName,
            shipName: nom.shipName,
            scheduledTotal: nom.scheduledTotal,
            productCode: productCode,
            SCHEDULED_QTY: nom[`scheduledQty_${productCode}`] || 0,
            SCHEDULED_QTY_ADJ: nom[`adjustedQty_${productCode}`] || 0,
            DATE_VALUE: originalMeta?.DATE_VALUE ?? row.date,
            DATE_VALUE_ADJ: nom.DATE_VALUE_ADJ ?? row.date,
          });
        });
      });
    });

    let transformedOpeningInventory = [];

    if (openingInventoryData && Array.isArray(openingInventoryData)) {
      openingInventoryData.forEach((item) => {
        const { Date, ...productEntries } = item;
        const dateDay = Number(Date);

        Object.entries(productEntries).forEach(([productCode, value]) => {
          const meta = (inventoryData || []).find(
            (inv) =>
              inv.DATE_VALUE === dateDay && inv.PRODUCT_CODE === productCode
          );

          transformedOpeningInventory.push({
            VERSION_NO:
              meta?.VERSION_NO ?? activeVersionFromReadAPI?.VERSION_NO ?? -1,
            HISTORY_NO: meta?.HISTORY_NO ?? null,
            PRODUCT_GROUP: meta?.PRODUCT_GROUP ?? selection.productGroupCode,
            LOCATION: meta?.LOCATION ?? selection.locationCode,
            MONTH_VALUE:
              meta?.MONTH_VALUE ?? selection.month.replace(" ", "").toUpperCase(),
            KS_ROW_NUM: meta?.KS_ROW_NUM ?? null,
            DATE_VALUE: dateDay,
            PRODUCT_CODE: productCode,
            OPENING_INVENTORY: value || 0,
          });
        });
      });
    }

    const workingCapacityPayload = [];
    workingCapacityData.forEach((row) => {
      const date = row.Date;
      selection.products.forEach((product) => {
        workingCapacityPayload.push({
          DATE_VALUE: date,
          PRODUCT_CODE: product,
          WORKING_CAPACITY: row[product] || 0,
        });
      });
    });

    const payload = {
      VERSION: activeVersionFromReadAPI,
      INVENTORY: inventoryData,
      OPENING_INVENTORY: transformedOpeningInventory,
      WORKING_CAPACITY: workingCapacityPayload,
      NOMINATION: nominationAggregate,
      MIN_MAX_PERCENTAGE: minMaxPercentageData,
    };

    console.log("📤 Final Save Payload:", payload);

    try {
      const csrfToken = await fetchCSRFToken();
      const response = await fetch(`${BASE_URL}${API_ENDPOINTS.SAVE}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-TOKEN": csrfToken,
          "Cache-Control": "no-cache",
        },
        credentials: "include",
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error("Save API failed with status: " + response.status);
      }

      const result = await response.json();
      console.log("✅ Save Success:", result);
      toastr.success("Data saved successfully!");

      await handleReadApiData(result);
    } catch (error) {
      console.error("❌ Save Failed:", error);
      toastr.error("Failed to save data.");
    } finally {
      $("#loadingSpinner").fadeOut();
    }
  };

  const [monthStr, yearStr] = selection.month.split(" ");
  // Define a mapping for month abbreviations to month numbers
  const monthMap = {
    Jan: 0,
    Feb: 1,
    Mar: 2,
    Apr: 3,
    May: 4,
    Jun: 5,
    Jul: 6,
    Aug: 7,
    Sep: 8,
    Oct: 9,
    Nov: 10,
    Dec: 11,
  };

  // Create a date for the planning month (first day of that month)
  const planningDate = new Date(parseInt(yearStr), monthMap[monthStr], 1);

  // Get today's date (set time to midnight for accurate comparisons)
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Create a date representing the current month (first day)
  const currentMonthDate = new Date(today.getFullYear(), today.getMonth(), 1);

  // Set editingEnabled to true only if the planning month is current or in the future
  const editingEnabled = planningDate >= currentMonthDate;

  if (!editingEnabled) {
    $(
      "#resetOpeningInventory, #saveOpeningInventory, " +
      "#resetWorkingCapacity, #saveWorkingCapacity, " +
      "#resetInventoryPlanning, #saveInventoryPlanning"
    )
      .prop("disabled", true)
      .css("cursor", "not-allowed");
  }

  function updateHeader(selection) {
    $("#app-header .title").html(`
      <strong>Lifting Amendment Simulator</strong> -
      <strong>Planning:</strong> ${selection.month} |
      <strong>Terminal:</strong> ${selection.terminal} |
      <strong>Group:</strong> ${selection.productGroup} |
      <strong>Products:</strong> ${selection.products.join(", ")} |
      <strong>Version:</strong> ${activeVersionFromReadAPI?.VERSION_NAME || "N/A"
      } |
      <strong>Description:</strong> ${activeVersionFromReadAPI?.VERSION_DESCRIPTION || "No description"
      }
    `);
  }

  let savedVersions = [];

  $("#openButton").on("click", function () {
    const $select = $("#versionSelect").empty();
    const $message = $("#noVersionsMessage");

    if (savedVersions.length > 0) {
      savedVersions.forEach((v) => {
        $select.append(
          `<option value="${String(v.id)}">${v.name || "Unnamed Version"
          }</option>`
        );
      });
      $select.show();
      $message.hide();
    } else {
      $select.hide();
      $message.show();
    }

    $("#openVersionModal").modal("show");
  });

  $("#confirmOpenVersion").on("click", function () {
    const selectedId = $("#versionSelect").val();
    const selectedVersion = savedVersions.find(
      (v) => String(v.id) === selectedId
    );

    if (!selectedVersion) {
      toastr.error("Please select a version.");
      return;
    }

    const newSelection = { ...selection, versionNo: selectedVersion.id };

    callReadAPIWithSelection(newSelection);

    $("#openVersionModal").modal("hide");
  });

  // SAVE AS
  $("#saveAsButton").on("click", function () {
    $("#saveName").val("");
    $("#saveDescription").val("");
    $("#saveAsModal").modal("show");
  });

  $("#saveAsForm").on("submit", async function (e) {
    e.preventDefault();

    const name = $("#saveName").val().trim();
    const description = $("#saveDescription").val().trim();

    if (!name) {
      toastr.error("Please enter a name");
      return;
    }

    // Show spinner and disable button
    $("#saveAsSubmitBtn").prop("disabled", true);
    $("#saveAsLoadingSpinner").removeClass("d-none");
    $("#saveAsBtnText").text("Saving...");

    let nominationAggregate = [];

    liftingAmendmentData.forEach((row) => {
      if (!Array.isArray(row.nomination)) return;
      row.nomination.forEach((nom) => {
        Object.keys(nom).forEach((key) => {
          if (key.startsWith("scheduledQty_")) {
            const productCode = key.split("_")[1];
            const matchingRaw = (originalNominationList || []).find(
              (n) =>
                n.NOMINATION_NO === nom.nominationNumber &&
                n.PRODUCT_CODE === productCode &&
                Number(n.DATE_VALUE) === row.date
            );

            nominationAggregate.push({
              VERSION_NO:
                matchingRaw?.VERSION_NO ??
                activeVersionFromReadAPI?.VERSION_NO ??
                -1,
              HISTORY_NO: matchingRaw?.HISTORY_NO ?? null,
              PRODUCT_GROUP:
                matchingRaw?.PRODUCT_GROUP ?? selection.productGroupCode,
              LOCATION: matchingRaw?.LOCATION ?? selection.locationCode,
              MONTH_VALUE:
                matchingRaw?.MONTH_VALUE ??
                selection.month.replace(" ", "").toUpperCase(),
              KS_ROW_NUM: matchingRaw?.KS_ROW_NUM ?? null,
              DATE_VALUE: row.date,
              DATE_VALUE_ADJ: nom.DATE_VALUE_ADJ ?? row.date,
              NOMINATION_NO: nom.nominationNumber,
              CUSTOMER_NAME: nom.customerName,
              SHIP_NAME: nom.shipName,
              PRODUCT_CODE: productCode,
              SCHEDULED_QTY: nom[`scheduledQty_${productCode}`] || 0,
              SCHEDULED_QTY_ADJ: nom[`adjustedQty_${productCode}`] || 0,
              ACTUAL_QTY:
                matchingRaw?.ACTUAL_QTY ??
                (nom[`scheduledQty_${productCode}`] || 0),
            });
          }
        });
      });
    });

    let transformedOpeningInventory = [];
    if (openingInventoryData && Array.isArray(openingInventoryData)) {
      openingInventoryData.forEach((item) => {
        const { Date, ...productEntries } = item;
        Object.entries(productEntries).forEach(([productCode, value]) => {
          transformedOpeningInventory.push({
            Date,
            productCode,
            value,
          });
        });
      });
    }

    const workingCapacityPayload = [];
    workingCapacityData.forEach((row) => {
      const date = row.Date;
      selection.products.forEach((product) => {
        workingCapacityPayload.push({
          DATE_VALUE: date,
          PRODUCT_CODE: product,
          WORKING_CAPACITY: row[product] || 0,
        });
      });
    });

    const versionPayload = {
      VERSION: {
        VERSION_NO: -1,
        VERSION_NAME: name,
        VERSION_DESCRIPTION: description,
      },
      INVENTORY: inventoryData,
      OPENING_INVENTORY: transformedOpeningInventory,
      WORKING_CAPACITY: workingCapacityPayload,
      NOMINATION: nominationAggregate,
      MIN_MAX_PERCENTAGE: minMaxPercentageData,
    };

    try {
      // Fetch CSRF token
      const csrfResponse = await fetch(`${BASE_URL}${API_ENDPOINTS.CSRF}?_t=${Date.now()}`, {
        method: "GET",
        credentials: "include",
        headers: { "Cache-Control": "no-cache" },
      });
      const csrfToken = csrfResponse.headers.get("X-CSRF-TOKEN");
      if (!csrfToken) {
        throw new Error("Failed to fetch CSRF token");
      }

      // Make API request
      const response = await fetch(`${BASE_URL}${API_ENDPOINTS.SAVE}?_t=${Date.now()}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-TOKEN": csrfToken,
          "Cache-Control": "no-cache",
        },
        credentials: "include",
        body: JSON.stringify(versionPayload),
      });

      if (!response.ok) {
        throw new Error("Save API failed with status: " + response.status);
      }

      const result = await response.json();
      console.log("✅ Save As Success:", result);
      toastr.success(`Saved as "${name}"`);
      $("#saveAsModal").modal("hide");

      await handleReadApiData(result);
    } catch (error) {
      console.error("Save As Failed:", error);
      toastr.error("Failed to save version.");
    } finally {
      $("#saveAsSubmitBtn").prop("disabled", false);
      $("#saveAsLoadingSpinner").addClass("d-none");
      $("#saveAsBtnText").text("Save");
    }
  });

  let liftingAmendmentData = [],
    openingInventoryData = [],
    workingCapacityData = [],
    inventoryPlanningData = [],
    originalNominationList = [],
    productCountryMap = {};

  let originalOpeningInventoryData = [],
    originalWorkingCapacityData = [],
    originalInventoryPlanningData = [];

  // Attach event to Change Unit button
  $("#changeUnitBtn").on("click", function () {
    $("#unitFactorTableBody").empty();

    selection.products.forEach(function (product) {
      const key = `${product}_${currentUnit}`;
      const backendFactor =
        availableUOMData.find(
          (item) =>
            item.PRODUCT_CODE === product &&
            item.CONVERSION_UNIT === currentUnit
        )?.CONVERSION_FACTOR || 1;

      const factor = userUpdatedUOMFactors[key] ?? backendFactor;

      $("#unitFactorTableBody").append(`
          <tr>
            <td>${product}</td>
            <td>
              <input type="text" class="form-control factor-input" value="${factor}" />
            </td>
          </tr>
        `);
    });

    $("#unitSelect").val(currentUnit);

    $("#unitSelect")
      .off("change")
      .on("change", function () {
        const selectedUnit = $(this).val();
        $("#unitFactorTableBody").empty();

        selection.products.forEach(function (product) {
          const key = `${product}_${selectedUnit}`;
          const backendFactor =
            availableUOMData.find(
              (item) =>
                item.PRODUCT_CODE === product &&
                item.CONVERSION_UNIT === selectedUnit
            )?.CONVERSION_FACTOR || 1;

          const factor = userUpdatedUOMFactors[key] ?? backendFactor;

          $("#unitFactorTableBody").append(`
            <tr>
              <td>${product}</td>
              <td>
                <input type="text" class="form-control factor-input" value="${factor}" />
              </td>
            </tr>
          `);
        });
      });

    // Open the modal popup
    $("#changeUnitModal").modal("show");
  });

  $("#saveUnitChanges").on("click", function () {
    let selectedUnit = $("#unitSelect").val();
    let factors = {};

    $("#unitFactorTableBody tr").each(function () {
      let product = $(this).find("td:first").text();
      let factor = parseFloat($(this).find("input.factor-input").val()) || 1;

      // ✅ Save user's latest factor for this product + unit combo
      userUpdatedUOMFactors[`${product}_${selectedUnit}`] = factor;

      factors[product] = factor;
    });

    currentUnit = selectedUnit;
    unitConversionFactors = factors;

    console.log("New unit:", currentUnit);
    console.log("Conversion factors:", unitConversionFactors);
    toastr.success("Unit conversion applied: " + currentUnit);

    $("#liftingAmendmentGrid").dxDataGrid("instance").refresh();
    renderAllKpiCards();
    $("#changeUnitModal").modal("hide");
  });

  $("#updateUnitChanges").on("click", async function () {
    const updateBtn = $(this);
    const saveBtn = $("#saveUnitChanges");
    const closeBtn = $("#closeUnitModalBtn");
    closeBtn.prop("disabled", true);

    // Show loading state
    updateBtn
      .prop("disabled", true)
      .html(
        '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Updating...'
      );
    saveBtn.prop("disabled", true);
    closeBtn.prop("disabled", false);

    let selectedUnit = $("#unitSelect").val();
    let factors = {};
    $("#unitFactorTableBody tr").each(function () {
      let product = $(this).find("td:first").text();
      let factor = parseFloat($(this).find("input.factor-input").val()) || 1;
      factors[product] = factor;
    });

    const csrfToken = await fetchCSRFToken();

    const payload = {
      FACTORS: Object.entries(factors).map(([productCode, factor]) => ({
        PRODUCT_CODE: productCode,
        CONVERSION_FACTOR: factor,
        PRODUCT_GROUP: selection.productGroupCode,
        CONVERSION_UNIT: selectedUnit,
      })),
    };

    try {
      const response = await fetch(`${BASE_URL}${API_ENDPOINTS.UPDATE_UOM}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-TOKEN": csrfToken,
          "Cache-Control": "no-cache",
        },
        credentials: "include",
        body: JSON.stringify(payload),
      });

      if (!response.ok) throw new Error("Failed to update UOM");

      const contentType = response.headers.get("Content-Type") || "";
      if (contentType.includes("application/json")) {
        const result = await response.json();
        console.log("✅ UOM Update Success:", result);
      } else {
        console.log("✅ UOM Update Success: No response body");
      }

      toastr.success("Unit conversion updated successfully!");
      currentUnit = selectedUnit;
      unitConversionFactors = factors;

      $("#liftingAmendmentGrid").dxDataGrid("instance").refresh();
      renderAllKpiCards();
    } catch (error) {
      console.error("❌ UOM Update Failed:", error);
      toastr.error("Failed to update unit conversion.");
    } finally {
      updateBtn.prop("disabled", false).html("Update");
      saveBtn.prop("disabled", false);
      closeBtn.prop("disabled", false);
      $("#changeUnitModal").modal("hide");
    }
  });

  async function handleReadApiData(data) {
    console.log("📥 handleReadApiData input:", data);

    try {
      $("#loadingSpinner").show();

      const productConversionMap = {};
      data.UOM?.forEach((item) => {
        window.availableUOMData = data.UOM || [];
        const key = `${item.PRODUCT_CODE}_${item.CONVERSION_UNIT}`;
        productConversionMap[key] = item.CONVERSION_FACTOR;
      });

      // Apply selected unit's factors
      selection.products.forEach((product) => {
        const key = `${product}_${currentUnit}`;
        unitConversionFactors[product] = productConversionMap[key] || 1;
      });

      toastr.success("Unit conversion mapping applied.");

      // INVENTORY
      liftingAmendmentData = [];
      data.INVENTORY.forEach((inv) => {
        const date = Number(inv.DATE_VALUE);
        let row = liftingAmendmentData.find((r) => r.date === date);
        if (!row) {
          row = { date, id: "row_" + date };
          liftingAmendmentData.push(row);
        }
        const p = inv.PRODUCT_CODE;
        row[`terminalAvails_${p}`] = inv.TERMINAL_AVAILS || 0;
        row[`adjustment_${p}TA`] = inv.TERMINAL_AVAILS_ADJ || 0;
        row[`customerLifting_${p}`] = inv.CUSTOMER_LIFTING || 0;
        row[`adjustment_${p}CL`] = inv.CUSTOMER_LIFTING_ADJ || 0;
        row[`closingInventory_${p}`] = inv.CLOSING_INVENTORY || 0;
      });

      inventoryData = data.INVENTORY.map((inv) => {
        const includeOnlyAdj =
          !inv.TERMINAL_AVAILS &&
          !inv.CUSTOMER_LIFTING &&
          !inv.CLOSING_INVENTORY &&
          !inv.MIN_CAPACITY &&
          !inv.MAX_CAPACITY;

        if (includeOnlyAdj) {
          return {
            VERSION_NO: inv.VERSION_NO,
            HISTORY_NO: inv.HISTORY_NO,
            PRODUCT_GROUP: inv.PRODUCT_GROUP,
            LOCATION: inv.LOCATION,
            MONTH_VALUE: inv.MONTH_VALUE,
            KS_ROW_NUM: inv.KS_ROW_NUM,
            DATE_VALUE: inv.DATE_VALUE,
            PRODUCT_CODE: inv.PRODUCT_CODE,
            TERMINAL_AVAILS_ADJ: inv.TERMINAL_AVAILS_ADJ,
            CUSTOMER_LIFTING_ADJ: inv.CUSTOMER_LIFTING_ADJ,
          };
        } else {
          return { ...inv };
        }
      });

      // WORKING CAPACITY
      workingCapacityData = [];
      const workingCapacityMap = {};

      data.INVENTORY.forEach((inv) => {
        const date = Number(inv.DATE_VALUE);
        const product = inv.PRODUCT_CODE;

        if (!workingCapacityMap[date]) {
          workingCapacityMap[date] = { Date: date };
        }

        const min = Number(inv.MIN_CAPACITY) || 0;
        const max = Number(inv.MAX_CAPACITY) || 0;
        const capacity = max - min;

        workingCapacityMap[date][product] = capacity;
      });

      workingCapacityData = Object.values(workingCapacityMap);

      // NOMINATION
      const getDayFromDateStr = (str) => Number(str);
      if (Array.isArray(data.NOMINATION)) {
        originalNominationList = data.NOMINATION;

        liftingAmendmentData.forEach((row) => {
          const match = data.NOMINATION.filter(
            (n) => getDayFromDateStr(n.DATE_VALUE) === row.date
          );
          if (match.length) {
            const nominationMap = {};

            match.forEach((n) => {
              const nomNo = n.NOMINATION_NO;
              if (!nominationMap[nomNo]) {
                nominationMap[nomNo] = {
                  nominationNumber: nomNo,
                  customerName: n.CUSTOMER_NAME,
                  shipName: n.SHIP_NAME,
                  scheduledTotal: 0,
                  DATE_VALUE_ADJ: n.DATE_VALUE_ADJ || n.DATE_VALUE,
                };
              }

              const productField = `scheduledQty_${n.PRODUCT_CODE}`;
              const adjustedField = `adjustedQty_${n.PRODUCT_CODE}`;

              nominationMap[nomNo][productField] = n.SCHEDULED_QTY;
              nominationMap[nomNo][adjustedField] = n.SCHEDULED_QTY_ADJ || 0;
              nominationMap[nomNo].scheduledTotal += n.SCHEDULED_QTY || 0;
            });

            row.nomination = Object.values(nominationMap);
          }
        });
      }

      // OPENING INVENTORY
      openingInventoryData = [];
      data.OPENING_INVENTORY.forEach((item) => {
        const date = Number(item.DATE_VALUE);
        let row = openingInventoryData.find((r) => r.Date === date);
        if (!row) {
          row = { Date: date };
          openingInventoryData.push(row);
        }
        row[item.PRODUCT_CODE] = item.OPENING_INVENTORY || 0;
      });

      if (
        Array.isArray(data.MIN_MAX_PERCENTAGE) &&
        data.MIN_MAX_PERCENTAGE.length
      ) {
        let minRow = { Type: "Min" };
        let maxRow = { Type: "Max" };

        data.MIN_MAX_PERCENTAGE.forEach((item) => {
          const p = item.PRODUCT_CODE;
          minRow[p] = item.MIN_PERC || 0;
          maxRow[p] = item.MAX_PERC || 100;
        });

        minMaxPercentageData = data.MIN_MAX_PERCENTAGE;

        inventoryPlanningData = [minRow, maxRow];
      } else {
        minMaxPercentageData = [];
        inventoryPlanningData = [];
        console.warn("⚠️ MIN_MAX_PERCENTAGE missing or empty in response");
      }

      // Saved Versions
      savedVersions = (data.LIST_VERSIONS || []).map((v) => ({
        id: String(v.VERSION_NO),
        name: v.VERSION_NAME,
        description: v.VERSION_DESCRIPTION,
      }));

      if (Array.isArray(data.VERSION) && data.VERSION.length > 0) {
        activeVersionFromReadAPI = {
          VERSION_NO: data.VERSION[0].VERSION_NO,
          VERSION_NAME: data.VERSION[0].VERSION_NAME,
          VERSION_DESCRIPTION: data.VERSION[0].VERSION_DESCRIPTION,
        };
      }

      // Deep clone for reset buttons
      originalOpeningInventoryData = JSON.parse(
        JSON.stringify(openingInventoryData)
      );
      originalWorkingCapacityData = JSON.parse(
        JSON.stringify(workingCapacityData)
      );
      originalInventoryPlanningData = JSON.parse(
        JSON.stringify(inventoryPlanningData)
      );

      recalculateLiftingData();
      console.log("🔍 MIN_MAX_PERCENTAGE loaded:", minMaxPercentageData);

      initializeApp();
      storeOriginalNominationState();
    } catch (error) {
      console.error("❌ handleReadApiData Failed:", error);
      toastr.error(`Failed to load response data.\n${error}`);
    } finally {
      $("#loadingSpinner").fadeOut();
    }
  }

  // Get CSRF token first
  async function fetchCSRFToken() {
    const csrfURL = `${BASE_URL}${API_ENDPOINTS.CSRF}?_t=${Date.now()}`;
    const res = await fetch(csrfURL, {
      method: "GET",
      credentials: "include",
      headers: { "Cache-Control": "no-cache" },
    });
    return res.headers.get("X-CSRF-TOKEN");
  }
  let countriesData = [];
  // ✅ Replace this at the top of your script (if not using ES modules)
  async function callReadAPIWithSelection(selection) {
    try {
      $("#loadingSpinner").show();
      // const csrfToken = await fetchCSRFToken();

      // const response = await fetch(
      //   `${BASE_URL}${API_ENDPOINTS.READ}&_t=${Date.now()}`,
      //   {
      //     method: "POST",
      //     headers: {
      //       "Content-Type": "application/json",
      //       "X-CSRF-TOKEN": csrfToken,
      //       "Cache-Control": "no-cache",
      //     },
      //     credentials: "include",
      //     body: JSON.stringify({
      //       LOCATION: selection.locationCode,
      //       PRODUCT_GROUP: selection.productGroupCode,
      //       PRODUCT_CODE: selection.productCodes,
      //       MONTH_VALUE: selection.month.replace(" ", "").toUpperCase(),
      //       VERSION_NO: Number(selection.versionNo),
      //     }),
      //   }
      // );
      // if (!response.ok) {
      //   throw new Error(`API request failed with status: ${response.status}`);
      // }
      // const data = await response.json();

      // ✅ Option 2: Local mock JSON instead of API
      const response = await fetch(API_ENDPOINTS.LIFTING_AMENDMENT);
      const data = await response.json();

      countriesData = data.COUNTRIES || [];

      const productConversionMap = {};
      data.UOM?.forEach((item) => {
        window.availableUOMData = data.UOM || [];
        const key = `${item.PRODUCT_CODE}_${item.CONVERSION_UNIT}`;
        productConversionMap[key] = item.CONVERSION_FACTOR;
      });

      selection.products.forEach((product) => {
        const key = `${product}_${currentUnit}`;
        unitConversionFactors[product] = productConversionMap[key] || 1;
      });

      toastr.success("Unit conversion mapping applied.");

      liftingAmendmentData = [];
      data.INVENTORY.forEach((inv) => {
        const date = Number(inv.DATE_VALUE);
        let row = liftingAmendmentData.find((r) => r.date === date);
        if (!row) {
          row = { date, id: "row_" + date };
          liftingAmendmentData.push(row);
        }
        const p = inv.PRODUCT_CODE;
        row[`terminalAvails_${p}`] = inv.TERMINAL_AVAILS || 0;
        row[`adjustment_${p}TA`] = inv.TERMINAL_AVAILS_ADJ || 0;
        row[`customerLifting_${p}`] = inv.CUSTOMER_LIFTING || 0;
        row[`adjustment_${p}CL`] = inv.CUSTOMER_LIFTING_ADJ || 0;
        row[`closingInventory_${p}`] = inv.CLOSING_INVENTORY || 0;
      });

      inventoryData = data.INVENTORY.map((inv) => {
        const includeOnlyAdj =
          !inv.TERMINAL_AVAILS &&
          !inv.CUSTOMER_LIFTING &&
          !inv.CLOSING_INVENTORY &&
          !inv.MIN_CAPACITY &&
          !inv.MAX_CAPACITY;

        if (includeOnlyAdj) {
          return {
            VERSION_NO: inv.VERSION_NO,
            HISTORY_NO: inv.HISTORY_NO,
            PRODUCT_GROUP: inv.PRODUCT_GROUP,
            LOCATION: inv.LOCATION,
            MONTH_VALUE: inv.MONTH_VALUE,
            KS_ROW_NUM: inv.KS_ROW_NUM,
            DATE_VALUE: inv.DATE_VALUE,
            PRODUCT_CODE: inv.PRODUCT_CODE,
            TERMINAL_AVAILS_ADJ: inv.TERMINAL_AVAILS_ADJ,
            CUSTOMER_LIFTING_ADJ: inv.CUSTOMER_LIFTING_ADJ,
          };
        } else {
          return { ...inv };
        }
      });

      workingCapacityData = [];
      const workingCapacityMap = {};

      data.INVENTORY.forEach((inv) => {
        const date = Number(inv.DATE_VALUE);
        const product = inv.PRODUCT_CODE;

        if (!workingCapacityMap[date]) {
          workingCapacityMap[date] = { Date: date };
        }

        const min = Number(inv.MIN_CAPACITY) || 0;
        const max = Number(inv.MAX_CAPACITY) || 0;
        const capacity = max - min;

        workingCapacityMap[date][product] = capacity;
      });

      workingCapacityData = Object.values(workingCapacityMap);

      const getDayFromDateStr = (str) => Number(str);
      if (Array.isArray(data.NOMINATION)) {
        originalNominationList = data.NOMINATION;

        liftingAmendmentData.forEach((row) => {
          const match = data.NOMINATION.filter(
            (n) => getDayFromDateStr(n.DATE_VALUE) === row.date
          );
          if (match.length) {
            const nominationMap = {};

            match.forEach((n) => {
              const nomNo = n.NOMINATION_NO;
              if (!nominationMap[nomNo]) {
                nominationMap[nomNo] = {
                  nominationNumber: nomNo,
                  customerName: n.CUSTOMER_NAME,
                  shipName: n.SHIP_NAME,
                  scheduledTotal: 0,
                  DATE_VALUE_ADJ: n.DATE_VALUE_ADJ || n.DATE_VALUE,
                };
              }

              const productField = `scheduledQty_${n.PRODUCT_CODE}`;
              const adjustedField = `adjustedQty_${n.PRODUCT_CODE}`;

              nominationMap[nomNo][productField] = n.SCHEDULED_QTY;
              nominationMap[nomNo][adjustedField] = n.SCHEDULED_QTY_ADJ || 0;

              nominationMap[nomNo].scheduledTotal += n.SCHEDULED_QTY || 0;
            });

            row.nomination = Object.values(nominationMap);
          }
        });
      }

      openingInventoryData = [];
      data.OPENING_INVENTORY.forEach((item) => {
        const date = Number(item.DATE_VALUE);
        let row = openingInventoryData.find((r) => r.Date === date);
        if (!row) {
          row = { Date: date };
          openingInventoryData.push(row);
        }
        row[item.PRODUCT_CODE] = item.OPENING_INVENTORY || 0;
      });

      let minRow = { Type: "Min" };
      let maxRow = { Type: "Max" };
      data.MIN_MAX_PERCENTAGE.forEach((item) => {
        const p = item.PRODUCT_CODE;
        minRow[p] = item.MIN_PERC || 0;
        maxRow[p] = item.MAX_PERC || 100;
      });
      inventoryPlanningData = [minRow, maxRow];
      minMaxPercentageData = data.MIN_MAX_PERCENTAGE;

      savedVersions = (data.LIST_VERSIONS || []).map((v) => ({
        id: String(v.VERSION_NO),
        name: v.VERSION_NAME,
        description: v.VERSION_DESCRIPTION,
      }));

      if (Array.isArray(data.VERSION) && data.VERSION.length > 0) {
        activeVersionFromReadAPI = {
          VERSION_NO: data.VERSION[0].VERSION_NO,
          VERSION_NAME: data.VERSION[0].VERSION_NAME,
          VERSION_DESCRIPTION: data.VERSION[0].VERSION_DESCRIPTION,
        };
      }

      updateHeader(selection);

      openingInventoryData.forEach((item) => {
        const day = parseInt(item.Date);
        const parsedDate = new Date(parseInt(yearStr), monthMap[monthStr], day);
        item.Date = parsedDate.getDate();
      });

      originalOpeningInventoryData = JSON.parse(JSON.stringify(openingInventoryData));
      originalWorkingCapacityData = JSON.parse(JSON.stringify(workingCapacityData));
      originalInventoryPlanningData = JSON.parse(JSON.stringify(inventoryPlanningData));
      recalculateLiftingData();
      initializeApp();
      storeOriginalNominationState();
    } catch (error) {
      console.error("❌ read_api Call Failed:", error);
      toastr.error(`Failed to load data from backend.\n${error}`);
    } finally {
      $("#loadingSpinner").fadeOut();
    }
  };

  function initializeApp() {
    $("#resetOpeningInventory").on("click", function () {
      openingInventoryData = JSON.parse(
        JSON.stringify(originalOpeningInventoryData)
      );
      $("#openingInventoryGrid")
        .dxDataGrid("instance")
        .option("dataSource", openingInventoryData);

      recalculateLiftingData();
      $("#liftingAmendmentGrid").dxDataGrid("instance").refresh();
      renderAllKpiCards();
    });

    $("#resetWorkingCapacity").on("click", function () {
      workingCapacityData = JSON.parse(
        JSON.stringify(originalWorkingCapacityData)
      );
      $("#workingCapacityGrid")
        .dxDataGrid("instance")
        .option("dataSource", workingCapacityData);

      recalculateLiftingData();
      $("#liftingAmendmentGrid").dxDataGrid("instance").refresh();
      renderAllKpiCards();
    });

    $("#resetInventoryPlanning").on("click", function () {
      inventoryPlanningData = JSON.parse(
        JSON.stringify(originalInventoryPlanningData)
      );
      $("#inventoryPlanningGrid")
        .dxDataGrid("instance")
        .option("dataSource", inventoryPlanningData);

      // 🔄 Also update violation highlights and KPI cards
      recalculateLiftingData();
      $("#liftingAmendmentGrid").dxDataGrid("instance").refresh();
      renderAllKpiCards();
    });

    setupModals();
    renderAllKpiCards();
    initializeLiftingAmendmentGrid();

    $("#printToPDF").on("click", function () {
      generatePDF();
    });

    // Open confirmation modal (Bootstrap 4)
    $("#resetAdjustmentsBtn").on("click", function () {
      $("#resetAdjustmentsConfirmModal").modal("show");
    });

    // Handle confirm reset
    $("#confirmResetAdjustmentsBtn").on("click", function () {
      $("#resetAdjustmentsConfirmModal").modal("hide"); // close the modal

      if (!Array.isArray(liftingAmendmentData)) return;

      liftingAmendmentData.forEach((row) => {
        selection.products.forEach((product) => {
          row[`adjustment_${product}TA`] = 0;
          row[`adjustment_${product}CL`] = 0;

          if (Array.isArray(row.nomination)) {
            row.nomination.forEach((nomination) => {
              nomination[`adjustedQty_${product}`] = 0;
            });
          }
        });
      });

      recalculateLiftingData();
      const grid = $("#liftingAmendmentGrid").dxDataGrid("instance");
      grid.option("dataSource", liftingAmendmentData);
      grid.refresh();

      storeOriginalNominationState();
      renderAllKpiCards();

      toastr.success("All adjustments have been reset.");
    });
  }

  function generatePDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({
      orientation: "landscape",
      unit: "mm",
      format: "a4",
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 10;
    const usableWidth = pageWidth - 2 * margin;

    // Header
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("Lifting Amendment Report", margin, 15);

    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    const headerLines = [
      `Date: ${new Date().toLocaleDateString()}`,
      `Terminal: ${selection.terminal} | Group: ${selection.productGroup}`,
      `Planning: ${selection.month} | Products: ${selection.products.join(
        ", "
      )}`,
    ];
    headerLines.forEach((line, index) => {
      doc.text(line, margin, 22 + index * 5);
    });

    // KPI Summary
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("KPI Summary", margin, 40);

    const kpiData = [
      [
        "Total Cargoes",
        liftingAmendmentData.reduce((sum, r) => sum + r.numberOfShips, 0),
      ],
      [
        "Violation Days",
        liftingAmendmentData.filter((row) =>
          selection.products.some((p) => {
            const percent = parseInt(row[`closingPercentage_${p}`]) || 0;
            const min = parseInt(inventoryPlanningData[0][p]);
            const max = parseInt(inventoryPlanningData[1][p]);
            return percent < min || percent > max;
          })
        ).length,
      ],
    ];

    doc.autoTable({
      startY: 45,
      head: [["Metric", "Value"]],
      body: kpiData,
      theme: "grid",
      margin: { left: margin, right: margin },
      styles: {
        fontSize: 8,
        cellPadding: 2,
        font: "helvetica",
      },
      headStyles: {
        fillColor: [200, 200, 200],
        textColor: [0, 0, 0],
        fontStyle: "bold",
      },
      columnStyles: {
        0: { cellWidth: 40 },
        1: { cellWidth: 30 },
      },
    });

    // Main Table
    let columns = [{ header: "Date", dataKey: "date", width: 15 }];

    selection.products.forEach((product) => {
      columns.push(
        {
          header: `${product} Term`,
          dataKey: `terminalAvails_${product}`,
          width: 15,
        },
        { header: `Adj TA`, dataKey: `adjustment_${product}TA`, width: 15 },
        { header: `Cust`, dataKey: `customerLifting_${product}`, width: 15 },
        { header: `Adj CL`, dataKey: `adjustment_${product}CL`, width: 15 },
        {
          header: `Clos Inv`,
          dataKey: `closingInventory_${product}`,
          width: 18,
        },
        { header: `%`, dataKey: `closingPercentage_${product}`, width: 12 }
      );
    });

    columns.push(
      { header: "Ships", dataKey: "numberOfShips", width: 12 },
      { header: "Total Lift", dataKey: "totalLifting", width: 15 },
      { header: "Lift/2D", dataKey: "liftingPer2Days", width: 15 }
    );

    const tableData = liftingAmendmentData.map((row) => {
      let rowData = {
        date: String(row.date).padStart(2, "0"),
      };
      selection.products.forEach((product) => {
        rowData[`terminalAvails_${product}`] =
          row[`terminalAvails_${product}`]?.toLocaleString() || "0";
        rowData[`adjustment_${product}TA`] =
          row[`adjustment_${product}TA`]?.toLocaleString() || "0";
        rowData[`customerLifting_${product}`] =
          row[`customerLifting_${product}`]?.toLocaleString() || "0";
        rowData[`adjustment_${product}CL`] =
          row[`adjustment_${product}CL`]?.toLocaleString() || "0";
        rowData[`closingInventory_${product}`] =
          row[`closingInventory_${product}`]?.toLocaleString() || "0";
        rowData[`closingPercentage_${product}`] =
          row[`closingPercentage_${product}`] || "0%";
      });
      rowData.numberOfShips = row.numberOfShips?.toLocaleString() || "0";
      rowData.totalLifting = row.totalLifting?.toLocaleString() || "0";
      rowData.liftingPer2Days = row.liftingPer2Days?.toLocaleString() || "0";
      return rowData;
    });

    // Calculate total width and split if necessary
    const totalWidth = columns.reduce((sum, col) => sum + col.width, 0);
    const maxColumnsPerPage = Math.floor(usableWidth / 12);

    if (totalWidth > usableWidth) {
      let startY = doc.lastAutoTable.finalY + 5;
      const chunkSize = maxColumnsPerPage;

      for (let i = 0; i < columns.length; i += chunkSize) {
        const columnChunk = columns.slice(i, i + chunkSize);
        const tableChunk = tableData.map((row) => {
          const chunkRow = {};
          columnChunk.forEach((col) => {
            chunkRow[col.dataKey] = row[col.dataKey];
          });
          return chunkRow;
        });

        doc.autoTable({
          startY: startY,
          head: [columnChunk.map((col) => col.header)],
          body: tableChunk.map((row) =>
            columnChunk.map((col) => row[col.dataKey])
          ),
          theme: "grid",
          margin: { left: margin, right: margin },
          styles: {
            fontSize: 6,
            cellPadding: 1,
            font: "helvetica",
            overflow: "linebreak",
          },
          headStyles: {
            fillColor: [200, 200, 200],
            textColor: [0, 0, 0],
            fontStyle: "bold",
            fontSize: 6,
          },
          columnStyles: columnChunk.reduce((acc, col, index) => {
            acc[index] = { cellWidth: col.width };
            return acc;
          }, {}),
          didDrawPage: function (data) {
            doc.setFontSize(8);
            doc.text(
              `Page ${data.pageNumber} - Part ${Math.floor(i / chunkSize) + 1}`,
              pageWidth - margin - 30,
              pageHeight - 5
            );
          },
        });

        startY = margin;
        if (i + chunkSize < columns.length) {
          doc.addPage();
        }
      }
    } else {
      doc.autoTable({
        startY: doc.lastAutoTable.finalY + 5,
        head: [columns.map((col) => col.header)],
        body: tableData.map((row) => columns.map((col) => row[col.dataKey])),
        theme: "grid",
        margin: { left: margin, right: margin },
        styles: {
          fontSize: 6,
          cellPadding: 1,
          font: "helvetica",
          overflow: "linebreak",
        },
        headStyles: {
          fillColor: [200, 200, 200],
          textColor: [0, 0, 0],
          fontStyle: "bold",
          fontSize: 6,
        },
        columnStyles: columns.reduce((acc, col, index) => {
          acc[index] = { cellWidth: col.width };
          return acc;
        }, {}),
        didDrawPage: function (data) {
          doc.setFontSize(8);
          doc.text(
            `Page ${data.pageNumber}`,
            pageWidth - margin - 20,
            pageHeight - 5
          );
        },
      });
    }

    doc.save(`Lifting_Amendment_${selection.month.replace(" ", "_")}.pdf`);
  }

  function setupModals() {
    $("#btnOpeningInventory").click(() =>
      $("#openingInventoryModal").modal("show")
    );
    $("#btnWorkingCapacity").click(() =>
      $("#workingCapacityModal").modal("show")
    );
    $("#btnInventoryPlanning").click(() =>
      $("#inventoryPlanningModal").modal("show")
    );

    // 🔹 Opening Inventory Modal
    $("#openingInventoryModal").on("shown.bs.modal", () => {
      const tempOpeningData = JSON.parse(JSON.stringify(openingInventoryData));

      createGrid(
        "#openingInventoryGrid",
        tempOpeningData,
        "Opening Inventory",
        false,
        true
      );

      $("#saveOpeningInventory")
        .off("click")
        .on("click", function () {
          const grid = $("#openingInventoryGrid").dxDataGrid("instance");
          grid.saveEditData(); // ✅ Commit edits

          openingInventoryData = JSON.parse(JSON.stringify(tempOpeningData));
          $("#openingInventoryModal").modal("hide");
          recalculateLiftingData();
          $("#liftingAmendmentGrid").dxDataGrid("instance").refresh();
          renderAllKpiCards();
        });
    });

    // 🔹 Working Capacity Modal
    $("#workingCapacityModal").on("shown.bs.modal", () => {
      const tempWorkingCapacity = JSON.parse(
        JSON.stringify(workingCapacityData)
      );
      const totalHeight = Math.min(tempWorkingCapacity.length * 35 + 40, 500);

      createGrid(
        "#workingCapacityGrid",
        tempWorkingCapacity,
        "Working Capacity",
        false,
        true,
        totalHeight
      );

      $("#saveWorkingCapacity")
        .off("click")
        .on("click", function () {
          const grid = $("#workingCapacityGrid").dxDataGrid("instance");
          grid.saveEditData(); // ✅ Commit edits

          workingCapacityData = JSON.parse(JSON.stringify(tempWorkingCapacity));
          $("#workingCapacityModal").modal("hide");
          recalculateLiftingData();
          $("#liftingAmendmentGrid").dxDataGrid("instance").refresh();
          renderAllKpiCards();
        });
    });

    // 🔹 Inventory Planning Modal
    $("#inventoryPlanningModal").on("shown.bs.modal", () => {
      const tempInventoryPlanning = JSON.parse(
        JSON.stringify(inventoryPlanningData)
      );

      createGrid(
        "#inventoryPlanningGrid",
        tempInventoryPlanning,
        "Inventory Planning %",
        true
      );

      $("#saveInventoryPlanning")
        .off("click")
        .on("click", function () {
          const grid = $("#inventoryPlanningGrid").dxDataGrid("instance");
          grid.saveEditData(); // ✅ Commit edits

          inventoryPlanningData = JSON.parse(
            JSON.stringify(tempInventoryPlanning)
          );
          $("#inventoryPlanningModal").modal("hide");
          recalculateLiftingData();
          $("#liftingAmendmentGrid").dxDataGrid("instance").refresh();
          renderAllKpiCards();
        });
    });
  }

  function createGrid(
    selector,
    dataSource,
    title,
    isInventoryPlanning = false,
    hasDate = false,
    totalGridHeight
  ) {
    $(selector).dxDataGrid({
      dataSource,
      showBorders: true,
      paging: false,
      columnAutoWidth: true,
      width: "100%",
      height: totalGridHeight || "100%",
      editing: { mode: "cell", allowUpdating: editingEnabled },
      columns: generateColumns(),
      onEditingStart: function (e) {
        const rowDay = parseInt(e.data.Date, 10);

        // If the planning month is entirely in the past, block editing.
        if (planningDate < currentMonthDate) {
          e.cancel = true;
          return;
        }

        // If the planning month is the current month, only allow editing on dates >= today.
        const isSameMonth =
          planningDate.getFullYear() === today.getFullYear() &&
          planningDate.getMonth() === today.getMonth();

        if (isSameMonth && rowDay < today.getDate()) {
          e.cancel = true;
          return;
        }
      },
      onCellPrepared: function (e) {
        if (e.rowType === "data") {
          const rowDay = parseInt(e.data.Date, 10);

          // If the entire planning month is in the past…
          if (planningDate < currentMonthDate) {
            $(e.cellElement).css({
              backgroundColor: "#eee",
              color: "#999",
              cursor: "not-allowed",
            });
          } else {
            // For the current month, if the row is prior to today, style it as non-editable.
            const isSameMonth =
              planningDate.getFullYear() === today.getFullYear() &&
              planningDate.getMonth() === today.getMonth();
            if (isSameMonth && rowDay < today.getDate()) {
              $(e.cellElement).css({
                backgroundColor: "#eee",
                color: "#999",
                cursor: "not-allowed",
              });
            }
          }
        }
      },
      onContentReady: function () {
        if (!$(selector).find(".custom-header").length) {
          $(selector).prepend(
            `<h6 class="custom-header text-center">${title}</h6>`
          );
        }
      },
    });

    function generateColumns() {
      // For opening inventory, we want to always show the Date column
      console.log(
        "🔍 openingInventoryData before modal open",
        openingInventoryData
      );

      const dateCol =
        hasDate || selector === "#openingInventoryGrid"
          ? [
            {
              dataField: "Date",
              caption: "Date",
              alignment: "center",
              width: 100,
              allowEditing: false,
              allowSorting: false,
              cellTemplate: function (container, options) {
                const day = Number(options.value);
                const fullDate = new Date(
                  parseInt(yearStr),
                  monthMap[monthStr],
                  day
                );
                $(container).text(
                  fullDate.toLocaleDateString("en-GB", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  })
                );
              },
            },
          ]
          : [];

      if (isInventoryPlanning) {
        return dateCol.concat([
          {
            dataField: "Type",
            caption: "",
            width: 50,
            alignment: "center",
            allowEditing: false,
            allowSorting: false,
          },
          ...selection.products.map((p) => ({
            dataField: p,
            caption: p,
            alignment: "center",
            editorType: "dxNumberBox",
            allowEditing: editingEnabled,
            allowSorting: false,
            editorOptions: {
              min: 0,
              max: 100,
              showSpinButtons: false,
              format: "#0.##",
              inputAttr: {
                style: "background-color: #f6edc8; font-weight: bold;",
              },
            },
            cellTemplate(container, options) {
              const val = Number(options.value || 0);
              const factor =
                currentUnit !== "MB" &&
                  unitConversionFactors[options.column.dataField]
                  ? unitConversionFactors[options.column.dataField]
                  : 1;
              const converted = currentUnit === "MB" ? val : val / factor;
              $(container)
                .css({ "background-color": "#f6edc8", "font-weight": "bold" })
                .text(converted.toFixed(2));
            },
          })),
        ]);
      }

      return dateCol.concat(
        selection.products.map((p) => ({
          dataField: p,
          caption: p,
          alignment: "center",
          allowEditing:
            hasDate || selector === "#openingInventoryGrid"
              ? editingEnabled // only allow editing if editingEnabled is true
              : false,
          editorType: "dxNumberBox",
          allowSorting: false,
          editorOptions: {
            min: 0,
            showSpinButtons: false,
            format: "#,##0.##",
            inputAttr: {
              style: "background-color: #f6edc8; font-weight: bold;",
            },
          },
          cellTemplate(container, options) {
            $(container)
              .css({ "background-color": "#f6edc8", "font-weight": "bold" })
              .text(Number(options.value || 0).toFixed(2));
          },
        }))
      );
    }
  }

  function recalculateLiftingData(startIndex = 0) {
    // Create working capacity map by date string
    const workingCapMap = {};
    workingCapacityData.forEach((row) => {
      workingCapMap[row.Date] = row; // Use 'Date' for working capacity mapping
    });

    // Get today's date and planning month details
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const [monthStr, yearStr] = selection.month.split(" ");
    const monthIndex = monthMap[monthStr];
    const planningYear = parseInt(yearStr);

    for (let i = startIndex; i < liftingAmendmentData.length; i++) {
      const row = liftingAmendmentData[i];
      const currentDay = row.date; // Numeric day of the month (e.g., 1, 2, ..., 31)

      // Determine if the current day is in the past (before today)
      const currentDate = new Date(planningYear, monthIndex, currentDay);
      currentDate.setHours(0, 0, 0, 0);
      const isPastDay = currentDate < today;
      const isToday = currentDate.getTime() === today.getTime();

      selection.products.forEach((product) => {
        let closing;

        if (isPastDay) {
          // For past days, take closing inventory from inventoryData
          const inventoryRecord = inventoryData.find(
            (inv) => inv.DATE_VALUE === currentDay && inv.PRODUCT_CODE === product
          );
          closing = inventoryRecord?.CLOSING_INVENTORY || 0;
        } else {
          // For today and future days, calculate closing inventory
          let opening;

          if (isToday) {
            // For today, use opening inventory from openingInventoryData as the starting point
            const openingRecord = openingInventoryData.find(
              (r) => r.Date === currentDay
            );
            opening = openingRecord?.[product] || 0;
          } else {
            // For future days, use the previous day's closing inventory as the opening inventory
            opening = liftingAmendmentData[i - 1][`closingInventory_${product}`] || 0;
          }

          const terminal = row[`terminalAvails_${product}`] || 0;
          const customer = row[`customerLifting_${product}`] || 0;
          const adjTA = row[`adjustment_${product}TA`] || 0;
          const adjCL = row[`adjustment_${product}CL`] || 0;

          // Calculate closing inventory
          closing = opening + terminal + adjTA - customer - adjCL;
        }

        // Store closing inventory
        row[`closingInventory_${product}`] = closing;

        // Calculate closing percentage
        const workingCap = workingCapMap[currentDay]?.[product] || 0;
        row[`closingPercentage_${product}`] = workingCap
          ? Math.round((closing / workingCap) * 100) + "%"
          : "0%";

        // Log for debugging
        if (workingCap === 0) {
          console.log(`No working capacity found for day ${currentDay}, product ${product}. workingCapMap:`, workingCapMap);
        }

        // Recalculate customer lifting from nominations (if present)
        const calculatedCustomerLifting =
          Array.isArray(row.nomination) && row.nomination.length > 0
            ? row.nomination.reduce(
              (sum, n) => sum + (Number(n[`scheduledQty_${product}`]) || 0),
              0
            )
            : row[`customerLifting_${product}`] || 0;

        row[`customerLifting_${product}`] = calculatedCustomerLifting;
      });

      // Ships & totals
      row.numberOfShips = Array.isArray(row.nomination)
        ? row.nomination.length
        : 0;

      row.totalLifting = selection.products.reduce((sum, p) => {
        return sum + (row[`customerLifting_${p}`] || 0);
      }, 0);
    }

    // Recalculate 2-day rolling lifting totals
    liftingAmendmentData.forEach((row, i) => {
      const todayLifting = row.totalLifting || 0;
      const tomorrowLifting = liftingAmendmentData[i + 1]?.totalLifting || 0;
      row.liftingPer2Days = todayLifting + tomorrowLifting;
    });
  };

  let originalNominationMap = {};

  function storeOriginalNominationState() {
    originalNominationMap = {};
    liftingAmendmentData.forEach((row) => {
      if (Array.isArray(row.nomination)) {
        row.nomination.forEach((nom) => {
          originalNominationMap[nom.nominationNumber] = {
            originalDate: nom.parentRowDate || row.date,
            adjustedQty: selection.products.reduce((acc, p) => {
              acc[p] = nom[`adjustedQty_${p}`] || 0;
              return acc;
            }, {}),
          };
        });
      }
    });
  }

  // Delegate the click event on the modal container. This will handle clicks on dynamically added reset buttons.
  $("#adjustedNominationsModal").on(
    "click",
    ".reset-nomination-btn",
    function () {
      const $row = $(this).closest("tr");
      const nomId = $row.data("nom-id").toString(); // Ensure nomId is a string
      console.log("Attempting reset for nomId:", nomId);
      const original = originalNominationMap[nomId];
      if (!original) {
        toastr.error("Original nomination data not found.");
        return;
      }

      // Get the current date from the modal row (where the reset button was clicked)
      const currentDate = Number($row.find("td:nth-child(5)").text()); // Column 5 is the "New Date"
      console.log("Current date from modal:", currentDate);

      // Find the current row based on the date from the modal
      let currentRow = liftingAmendmentData.find(
        (row) => Number(row.date) === currentDate
      );
      if (!currentRow) {
        toastr.error("Current row not found for date: " + currentDate);
        return;
      }

      // Debug the nomination array
      console.log(
        "Nomination array for date",
        currentDate,
        ":",
        currentRow.nomination
      );

      // Find the current nomination in the current row
      let currentNomination = currentRow.nomination.find(
        (n) => n.nominationNumber.toString() === nomId
      );
      if (!currentNomination) {
        console.log("liftingAmendmentData:", liftingAmendmentData);
        console.log(
          "Current nomination not found in row with date:",
          currentDate,
          "for nomId:",
          nomId
        );
        toastr.error("Current nomination not found.");
        return;
      }

      // Remove nomination from current row
      const nominationIndex = currentRow.nomination.findIndex(
        (n) => n.nominationNumber.toString() === nomId
      );
      if (nominationIndex !== -1) {
        currentNomination = currentRow.nomination.splice(nominationIndex, 1)[0];
      } else {
        toastr.error("Nomination not found in current row for removal.");
        return;
      }

      // Find the original (target) row
      const targetRow = liftingAmendmentData.find(
        (row) => Number(row.date) === original.originalDate
      );
      if (!targetRow) {
        toastr.error("Original date not found.");
        return;
      }

      // Reset adjusted quantities
      selection.products.forEach((p) => {
        currentNomination[`adjustedQty_${p}`] = original.adjustedQty[p];
      });

      // Add nomination to target row
      if (!Array.isArray(targetRow.nomination)) targetRow.nomination = [];
      targetRow.nomination.push(currentNomination);

      // Recalculate adjustments
      selection.products.forEach((product) => {
        const adjustmentKey = `adjustment_${product}CL`;
        currentRow[adjustmentKey] = currentRow.nomination.reduce(
          (sum, n) => sum + (Number(n[`adjustedQty_${product}`]) || 0),
          0
        );
        targetRow[adjustmentKey] = targetRow.nomination.reduce(
          (sum, n) => sum + (Number(n[`adjustedQty_${product}`]) || 0),
          0
        );
      });

      // Recalculate and refresh
      recalculateLiftingData();
      $("#liftingAmendmentGrid").dxDataGrid("instance").refresh();
      renderAllKpiCards();

      // Re-render the modal table
      const tableBody = $("#adjustedNominationsTableBody").empty();
      liftingAmendmentData.forEach((row) => {
        if (!Array.isArray(row.nomination)) return;
        row.nomination.forEach((nom) => {
          const original = originalNominationMap[nom.nominationNumber];
          if (!original) return;
          const currentDate = row.date;
          const originalDate = original.originalDate;
          const changedDate = currentDate !== originalDate;
          let changedQty = false;
          selection.products.forEach((p) => {
            const prev = parseFloat(original.adjustedQty[p] || 0);
            const now = parseFloat(nom[`adjustedQty_${p}`] || 0);
            if (prev !== now) changedQty = true;
          });
          const isFutureMove = originalDate >= today.getDate();
          if ((changedDate && isFutureMove) || (changedQty && isFutureMove)) {
            let action = "";
            if (changedDate && changedQty) action = "Both Changed";
            else if (changedDate) action = "Date Changed";
            else if (changedQty) action = "Qty Changed";
            tableBody.append(
              `<tr data-nom-id="${nom.nominationNumber}">
              <td>${nom.nominationNumber}</td>
              <td>${nom.customerName || "-"}</td>
              <td>${nom.shipName || "-"}</td>
              <td>${originalDate}</td>
              <td>${currentDate}</td>
              <td><strong>${action}</strong></td>
              <td><button class="btn btn-sm btn-warning reset-nomination-btn">Reset</button></td>
            </tr>`
            );
          }
        });
      });
    }
  );

  function renderAllKpiCards() {
    const container = $("#kpiScrollContainer").empty();

    // Total Cargoes per Product
    const cargoesPerProduct = {};
    selection.products.forEach((product) => {
      const seenNominations = new Set();

      liftingAmendmentData.forEach((row) => {
        if (!Array.isArray(row.nomination)) return;

        row.nomination.forEach((nom) => {
          const qty = Number(nom[`scheduledQty_${product}`]) || 0;
          if (qty > 0) {
            const key = `${nom.nominationNumber}_${nom.shipName}`;
            seenNominations.add(key);
          }
        });
      });

      cargoesPerProduct[product] = seenNominations.size;
    });

    // Violation per product
    const violationPerProduct = selection.products.map((product) => {
      const min =
        parseInt(
          inventoryPlanningData.find((r) => r.Type === "Min")[product]
        ) || 0;
      const max =
        parseInt(
          inventoryPlanningData.find((r) => r.Type === "Max")[product]
        ) || 100;

      const count = liftingAmendmentData.reduce((sum, row) => {
        const val = parseInt(row[`closingPercentage_${product}`]) || 0;
        return val < min || val > max ? sum + 1 : sum;
      }, 0);

      return { name: product, value: count };
    });

    // KPI: Total Cargoes
    const cargoesHeader = selection.products
      .map((p) => `<th>${p}</th>`)
      .join("");

    const cargoesValues = selection.products
      .map(
        (p) =>
          `<td style="color: ${cargoesPerProduct[p] > 0 ? "blue" : "#333"
          }"><strong>${cargoesPerProduct[p]}</strong></td>`
      )
      .join("");

    container.append(`
    <div class="kpi-card">
      <div class="card-title">Total Cargoes</div>
      <div class="kpi-table-wrapper">
        <table class="table table-sm text-center mb-0">
          <thead><tr>${cargoesHeader}</tr></thead>
          <tbody><tr>${cargoesValues}</tr></tbody>
        </table>
      </div>
    </div>
    `);

    // KPI: Violation Days per product (table)
    const violationHeader = violationPerProduct
      .map((v) => `<th>${v.name}</th>`)
      .join("");
    const violationValues = violationPerProduct
      .map(
        (v) =>
          `<td style="color: ${v.value > 0 ? "red" : "#333"};"><strong>${v.value
          }</strong></td>`
      )
      .join("");

    container.append(`
      <div class="kpi-card">
        <div class="card-title">Closing Inv. Violation (Days)</div>
        <div class="kpi-table-wrapper">
          <table class="table table-sm text-center mb-0">
            <thead><tr>${violationHeader}</tr></thead>
            <tbody><tr>${violationValues}</tr></tbody>
          </table>
        </div>
      </div>
    `);

    // Demand per product
    const demand = selection.products.map((p) => {
      const rawValue = liftingAmendmentData.reduce(
        (sum, r) => sum + (Number(r[`customerLifting_${p}`]) || 0),
        0
      );
      // If the current unit is not MB and we have a conversion factor for product p, apply it.
      const factor =
        currentUnit !== "MB" && unitConversionFactors[p]
          ? unitConversionFactors[p]
          : 1;
      return {
        name: p,
        value: parseFloat(
          currentUnit === "MB" ? rawValue : rawValue / factor
        ).toFixed(2),
      };
    });

    // Available For Export per product
    const available = selection.products.map((p) => {
      const rawValue = liftingAmendmentData.reduce(
        (sum, r) => sum + (Number(r[`terminalAvails_${p}`]) || 0),
        0
      );
      // Apply conversion if unit is not MB and factor exists, otherwise use rawValue
      const factor =
        currentUnit !== "MB" && unitConversionFactors[p]
          ? unitConversionFactors[p]
          : 1;
      return {
        name: p,
        value: currentUnit === "MB" ? rawValue : rawValue / factor,
      };
    });

    // Demand card
    const demandHeader = demand.map((v) => `<th>${v.name}</th>`).join("");
    const demandValues = demand
      .map((v) => `<td><strong>${v.value.toLocaleString()}</strong></td>`)
      .join("");

    container.append(`
        <div class="kpi-card">
          <div class="card-title">Demand (${currentUnit})</div>
          <div class="kpi-table-wrapper">
            <table class="table table-sm text-center mb-0">
              <thead><tr>${demandHeader}</tr></thead>
              <tbody><tr>${demandValues}</tr></tbody>
            </table>
          </div>
        </div>
      `);

    // Available card
    const availHeader = available.map((v) => `<th>${v.name}</th>`).join("");
    const availValues = available
      .map((v) => `<td><strong>${v.value.toLocaleString()}</strong></td>`)
      .join("");

    container.append(`
      <div class="kpi-card">
        <div class="card-title">Available For Export (${currentUnit})</div>
          <div class="kpi-table-wrapper">
            <table class="table table-sm text-center mb-0">
              <thead><tr>${availHeader}</tr></thead>
              <tbody><tr>${availValues}</tr></tbody>
            </table>
          </div>
      </div>
    `);

    // Count Adjusted Nominations (where any adjustedQty_<product> > 0)
    let dateChangedCount = 0;
    let qtyChangedCount = 0;

    liftingAmendmentData.forEach((row) => {
      if (!Array.isArray(row.nomination)) return;

      row.nomination.forEach((nom) => {
        const original = originalNominationMap[nom.nominationNumber];
        if (!original) return;

        const currentDate = row.date;
        const originalDate = original.originalDate;
        const isDateChanged = currentDate !== originalDate;

        let isQtyChanged = false;
        selection.products.forEach((p) => {
          const originalVal = parseFloat(original.adjustedQty[p] || 0);
          const currentVal = parseFloat(nom[`adjustedQty_${p}`] || 0);
          if (originalVal !== currentVal) isQtyChanged = true;
        });

        if (isDateChanged) dateChangedCount++;
        if (isQtyChanged) qtyChangedCount++;
      });
    });

    container.append(`
    <div class="kpi-card" id="adjustedNominationsCard" style="cursor: pointer;">
      <div class="card-title">Adjusted Nominations</div>
      <div class="kpi-table-wrapper">
        <table class="table table-sm text-center mb-0">
          <thead><tr><th>Qty Changed</th><th>Date Changed</th></tr></thead>
          <tbody><tr>
            <td><strong>${qtyChangedCount}</strong></td>
            <td><strong>${dateChangedCount}</strong></td>
          </tr></tbody>
        </table>
      </div>
    </div>
    `);

    $("#adjustedNominationsCard").on("click", function () {
      const tableBody = $("#adjustedNominationsTableBody").empty();

      liftingAmendmentData.forEach((row) => {
        if (!Array.isArray(row.nomination)) return;

        row.nomination.forEach((nom) => {
          const original = originalNominationMap[nom.nominationNumber];
          if (!original) return;

          const currentDate = row.date;
          const originalDate = Number(original.originalDate);
          const changedDate = currentDate !== originalDate;

          let changedQty = false;
          selection.products.forEach((p) => {
            const prev = parseFloat(original.adjustedQty[p] || 0);
            const now = parseFloat(nom[`adjustedQty_${p}`] || 0);
            if (prev !== now) changedQty = true;
          });

          const isFutureMove =
            new Date(parseInt(yearStr), monthMap[monthStr], originalDate) >=
            today;

          if ((changedDate && isFutureMove) || (changedQty && isFutureMove)) {
            let action = "";
            if (changedDate && changedQty) action = "Both Changed";
            else if (changedDate) action = "Date Changed";
            else if (changedQty) action = "Qty Changed";

            tableBody.append(`
              <tr data-nom-id="${nom.nominationNumber}">
                <td>${nom.nominationNumber}</td>
                <td>${nom.customerName || "-"}</td>
                <td>${nom.shipName || "-"}</td>
                <td>${originalDate}</td>
                <td>${currentDate}</td>
                <td><strong>${action}</strong></td>
                <td><button class="btn btn-sm btn-warning reset-nomination-btn">Reset</button></td>
              </tr>
            `);
          }
        });
      });

      $("#adjustedNominationsModal").modal("show");
    });
  }

  function generateColumns(products) {
    const columns = [
      {
        dataField: "date",
        caption: "Date",
        width: 90,
        fixed: true,
        fixedPosition: "left",
        allowSorting: false,
        allowEditing: false,
        cellTemplate: function (container, options) {
          let $link = $("<a>")
            .text(options.value)
            .addClass("date-link")
            .on("click", function () {
              const grid = $("#liftingAmendmentGrid").dxDataGrid("instance");
              const isExpanded = grid.isRowExpanded(options.key);
              isExpanded ? grid.collapseRow(options.key) : grid.expandRow(options.key);
            });
          $(container).append($link);
        },
      },
    ];

    const sectionTitles = [
      { key: "terminalAvails", title: "Terminal Avails" },
      { key: "adjustment_TA", title: "Terminal Avails Adjustment" },
      { key: "customerLifting", title: "Customer Liftings" },
      { key: "adjustment_CL", title: "Customer Liftings Adjustment" },
      { key: "closingInventory", title: "Closing Inventory" },
      { key: "closingPercentage", title: "Closing Percentage" },
    ];

    const isInternational = selection.terminal?.toLowerCase() === "international";

    if (isInternational) {
      // When terminal is International, group products under countries
      function groupProductsByCountry(products) {
        const grouped = {};
        products.forEach((product) => {
          const countries = productCountryMap[product] || ["Unknown"];
          const countryKey = countries.join(","); // combine multiple countries
          if (!grouped[countryKey]) {
            grouped[countryKey] = [];
          }
          grouped[countryKey].push(product);
        });
        return grouped;
      }

      const groupedProducts = groupProductsByCountry(products);

      Object.entries(groupedProducts).forEach(([countryGroup, countryProducts]) => {
        columns.push({
          caption: countryGroup,
          alignment: "center",
          columns: sectionTitles.map((section) => ({
            caption: section.title,
            alignment: "center",
            columns: countryProducts.map((product) => createColumnConfig(section.key, product)),
          })),
        });
      });

    } else {
      // Local terminal - normal without country grouping
      columns.push(
        ...sectionTitles.map((section) => ({
          caption: section.title,
          alignment: "center",
          columns: products.map((product) => createColumnConfig(section.key, product)),
        }))
      );
    }

    // ➡️ Add summary at end
    columns.push({
      caption: "Summary",
      fixed: true,
      fixedPosition: "right",
      columns: [
        { dataField: "numberOfShips", caption: "Number of Ships", width: 140, allowEditing: false, allowSorting: false, format: "#,##0" },
        { dataField: "totalLifting", caption: "Total Lifting", width: 100, allowEditing: false, allowSorting: false, format: "#,##0" },
        { dataField: "liftingPer2Days", caption: "Lifting Per 2 Days", width: 140, allowEditing: false, allowSorting: false, format: "#,##0" },
      ],
    });

    return columns;

    function createColumnConfig(sectionKey, product) {
      let dataField = `${sectionKey}_${product}`;
      if (sectionKey.includes("adjustment")) {
        dataField = `adjustment_${product}${sectionKey.split("_")[1]}`;
      }

      const columnConfig = {
        dataField: dataField,
        caption: product,
        alignment: "center",
        format: "#,##0",
        allowSorting: false,
        allowEditing: false,
      };

      if (sectionKey === "closingPercentage") {
        columnConfig.width = 100;
        columnConfig.cellTemplate = function (container, options) {
          let rawValue = options.value ? options.value.replace("%", "").trim() : "0";
          let value = parseInt(rawValue, 10) || 0;
          value = Math.max(0, Math.min(100, value));

          let min = parseInt(inventoryPlanningData.find((r) => r.Type === "Min")[product]) || 0;
          let max = parseInt(inventoryPlanningData.find((r) => r.Type === "Max")[product]) || 100;
          let color = value < min || value > max ? "red-bar" : "green-bar";

          $(container).html(`
            <div class="progress-container">
              <div class="progress-bar ${color}" style="width: ${value}%; height: 100%;"></div>
              <div class="progress-text">${value}%</div>
            </div>`);
        };
      } else if (sectionKey.includes("adjustment")) {
        columnConfig.allowEditing = true;
        columnConfig.cellTemplate = function (container, options) {
          const factor = unitConversionFactors[product] || 1;
          const val = options.value || 0;
          const displayVal = currentUnit !== "MB"
            ? (val / factor).toFixed(2).toLocaleString()
            : Number(val).toFixed(2).toLocaleString();
          $(container).text(displayVal);
        };
      } else if (sectionKey === "closingInventory") {
        columnConfig.cellTemplate = function (container, options) {
          const factor = unitConversionFactors[product] || 1;
          const val = options.value || 0;
          const displayVal = currentUnit !== "MB"
            ? (val / factor).toFixed(2).toLocaleString()
            : Number(val).toFixed(2).toLocaleString();
          $(container).text(displayVal);
        };
      } else if (sectionKey === "terminalAvails" || sectionKey === "customerLifting") {
        columnConfig.cellTemplate = function (container, options) {
          const factor = unitConversionFactors[product] || 1;
          const val = options.value || 0;
          const displayVal = currentUnit !== "MB"
            ? (val / factor).toFixed(2)
            : Number(val).toFixed(2);
          $(container).text(Number(displayVal).toLocaleString());
        };
      }

      return columnConfig;
    }
  }

  function initializeLiftingAmendmentGrid() {
    recalculateLiftingData();

    $("#liftingAmendmentGrid").dxDataGrid({
      dataSource: liftingAmendmentData,
      keyExpr: "id",
      showBorders: true,
      columnAutoWidth: false,
      allowColumnResizing: true,
      paging: { enabled: false },
      height: "auto",
      editing: {
        mode: "cell",
        allowUpdating: true,
      },
      scrolling: {
        scrollByContent: true,
        scrollByThumb: true,
        showScrollbar: "onHover",
      },
      onContentReady: function () {
        console.log("Lifting Amendment Grid Content Ready");
        $(".overlay").fadeOut();
        $(window).trigger("resize");
      },
      customizeColumns: function (columns) {
        columns.forEach((column) => {
          if (column.command === "expand") {
            column.visible = false;
          }
        });
      },
      onEditingStart: function (e) {
        const column = e.column;
        const rowData = e.data;
        const isAdjustment = column.dataField?.includes("adjustment_");
        if (!isAdjustment) return;

        const monthIndex = monthMap[monthStr];
        const rowDate = new Date(parseInt(yearStr), monthIndex, rowData.date);
        rowDate.setHours(0, 0, 0, 0);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (rowDate < today) e.cancel = true;
      },
      onCellPrepared: function (e) {
        if (
          e.rowType === "data" &&
          e.column.dataField?.includes("adjustment_")
        ) {
          const monthIndex = monthMap[monthStr];
          const rowDate = new Date(parseInt(yearStr), monthIndex, e.data.date);
          rowDate.setHours(0, 0, 0, 0);
          const today = new Date();
          today.setHours(0, 0, 0, 0);

          $(e.cellElement).css(
            rowDate < today
              ? { backgroundColor: "#eee", color: "#999" }
              : { backgroundColor: "#f6edc8", fontWeight: "bold" }
          );
        }
      },
      onRowUpdated: function (e) {
        const updatedRowIndex = liftingAmendmentData.findIndex(
          (r) => r.id === e.data.id
        );
        recalculateLiftingData(updatedRowIndex);
        $("#liftingAmendmentGrid").dxDataGrid("instance").refresh();
        renderAllKpiCards(); // Ensure KPI reflects current state
      },
      columns: generateColumns(selection.products),
      masterDetail: {
        enabled: true,
        template: function (container, options) {
          const details = options.data.nomination || [];
          const parentRowDate = options.data.date; // The parent row’s original date

          // Initialize DATE_VALUE_ADJ for each nomination if not already set
          details.forEach(function (nomination) {
            if (typeof nomination.DATE_VALUE_ADJ === "undefined") {
              nomination.DATE_VALUE_ADJ =
                nomination.DATE_VALUE || parentRowDate;
            }
          });

          // If no nomination details are available, show a message and exit.
          if (!details.length) {
            $("<div>")
              .text("No nomination details available.")
              .css({
                "font-size": "14px",
                "text-align": "center",
                padding: "10px",
                color: "#999",
              })
              .appendTo(container);
            return;
          }

          $("<div>")
            .text("Nomination Details")
            .css({
              "font-size": "16px",
              "font-weight": "bold",
              "margin-bottom": "10px",
              "padding-bottom": "5px",
            })
            .appendTo(container);

          const scheduledColumns = selection.products
            .map((product) => ({
              dataField: `scheduledQty_${product}`,
              caption: product,
              width: 80,
              alignment: "center",
              allowSorting: false,
              format: "#,##0",
            }))
            .concat([
              {
                dataField: "scheduledTotal",
                caption: "Total",
                width: 100,
                alignment: "center",
                allowSorting: false,
                allowEditing: false,
                format: "#,##0",
                cellTemplate: function (container, options) {
                  const val = Number(options.value || 0);
                  $(container)
                    .css({ "font-weight": "bold" })
                    .text(val.toLocaleString());
                },
              },
            ]);

          const adjustedColumns = selection.products.map((product) => ({
            dataField: `adjustedQty_${product}`,
            caption: product,
            width: 80,
            alignment: "center",
            allowSorting: false,
            format: "#,##0",
            editorType: "dxNumberBox",
            editorOptions: {
              min: 0,
              showSpinButtons: false,
              format: "#0.##",
              stylingMode: "filled",
              inputAttr: {
                style: "background-color: #f6edc8; font-weight: bold;",
              },
            },
            cellTemplate: function (container, options) {
              const val = Number(options.value || 0);
              $(container).addClass("yellow-bg").text(val.toLocaleString());
            },
          }));

          const dateMoveColumn = {
            dataField: "DATE_VALUE_ADJ",
            caption: "Move to Date",
            width: 120,
            alignment: "center",
            allowSorting: false,
            editorType: "dxDateBox",
            editorOptions: {
              type: "date",
              displayFormat: "dd/MM/yyyy",
              value: (() => {
                const adjDay = details[0]?.DATE_VALUE_ADJ || parentRowDate;
                if (typeof adjDay === "number" && adjDay > 0 && adjDay <= 31) {
                  return new Date(
                    parseInt(yearStr),
                    monthMap[monthStr],
                    adjDay
                  );
                }
                return null;
              })(),
              min: new Date(),
              max: new Date(parseInt(yearStr), monthMap[monthStr] + 1, 0),
              onValueChanged: function (e) {
                const gridInstance = nominationGrid.dxDataGrid("instance");
                const rowIndex = $(e.element).closest(".dx-row").index();
                const nominationRow = gridInstance.getDataSource().items()[
                  rowIndex
                ];

                let newDate;
                if (e.value instanceof Date) newDate = e.value;
                else if (typeof e.value === "number")
                  newDate = new Date(e.value);
                else if (typeof e.value === "string")
                  newDate = new Date(Date.parse(e.value));

                if (!newDate || isNaN(newDate.getTime())) return;

                const newDay = newDate.getDate();
                const oldDay = nominationRow.DATE_VALUE_ADJ || parentRowDate;

                if (newDay === Number(oldDay)) return;

                const sourceRow = liftingAmendmentData.find(
                  (row) => Number(row.date) === Number(oldDay)
                );
                const targetRow = liftingAmendmentData.find(
                  (row) => Number(row.date) === newDay
                );

                if (!sourceRow || !targetRow) {
                  toastr.error("Invalid date selection: row not found.");
                  return;
                }

                const nominationIndex = sourceRow.nomination.findIndex(
                  (n) => n.nominationNumber === nominationRow.nominationNumber
                );
                if (nominationIndex === -1) {
                  toastr.error("Nomination not found in source row.");
                  return;
                }

                const nomination = sourceRow.nomination.splice(
                  nominationIndex,
                  1
                )[0];
                nomination.DATE_VALUE_ADJ = newDay;

                if (!targetRow.nomination) targetRow.nomination = [];
                targetRow.nomination.push(nomination);

                // Update ship counts
                sourceRow.numberOfShips = sourceRow.nomination.length;
                targetRow.numberOfShips = targetRow.nomination.length;

                // Recalculate CL adjustments
                selection.products.forEach((product) => {
                  sourceRow[`adjustment_${product}CL`] =
                    sourceRow.nomination.reduce(
                      (sum, n) =>
                        sum + (Number(n[`adjustedQty_${product}`]) || 0),
                      0
                    );
                  targetRow[`adjustment_${product}CL`] =
                    targetRow.nomination.reduce(
                      (sum, n) =>
                        sum + (Number(n[`adjustedQty_${product}`]) || 0),
                      0
                    );
                });

                recalculateLiftingData();
                $("#liftingAmendmentGrid").dxDataGrid("instance").refresh();
                renderAllKpiCards();
              },
            },
            cellTemplate: function (container, options) {
              const adjDay = options.data.DATE_VALUE_ADJ;
              if (typeof adjDay === "number" && adjDay > 0 && adjDay <= 31) {
                const date = new Date(
                  parseInt(yearStr),
                  monthMap[monthStr],
                  adjDay
                );
                $(container).text(date.toLocaleDateString("en-GB"));
              } else {
                $(container).text(""); // Empty if invalid
              }
            },
          };

          const nominationGrid = $("<div>")
            .dxDataGrid({
              dataSource: details,
              showBorders: true,
              columnAutoWidth: true,
              editing: { mode: "cell", allowUpdating: true },
              onEditingStart: function (e) {
                const parentFullDate = new Date(
                  parseInt(yearStr),
                  monthMap[monthStr],
                  parentRowDate
                );
                parentFullDate.setHours(0, 0, 0, 0);
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                if (parentFullDate < today) e.cancel = true;
              },
              columns: [
                {
                  dataField: "nominationNumber",
                  caption: "Nomination Number",
                  width: 120,
                  alignment: "center",
                  allowSorting: false,
                },
                {
                  dataField: "customerName",
                  caption: "Customer Name",
                  width: 150,
                  alignment: "center",
                  allowSorting: false,
                },
                {
                  dataField: "shipName",
                  caption: "Ship Name",
                  width: 150,
                  alignment: "center",
                  allowSorting: false,
                },
                { caption: "Scheduled Qty", columns: scheduledColumns },
                { caption: "Adjusted Qty", columns: adjustedColumns },
                dateMoveColumn,
              ],
              onRowUpdated: function () {
                const parentRow = liftingAmendmentData.find(
                  (row) => Number(row.date) === parentRowDate
                );
                if (!parentRow) return;

                selection.products.forEach((product) => {
                  parentRow[`adjustment_${product}CL`] =
                    parentRow.nomination.reduce(
                      (sum, n) =>
                        sum + (Number(n[`adjustedQty_${product}`]) || 0),
                      0
                    );
                });

                recalculateLiftingData();
                $("#liftingAmendmentGrid").dxDataGrid("instance").refresh();
                renderAllKpiCards();
              },
            })
            .appendTo(container);
        },
      },
    });

    function setGridDynamicHeight() {
      const windowHeight = $(window).height();
      const headerHeight = $("#app-header").outerHeight(true);
      const buttonHeight = $(".button-group").outerHeight(true);
      const footerHeight = $(".bottom-buttons").outerHeight(true);
      const kpiHeight = $(".kpi-card")
        .first()
        .closest(".row")
        .outerHeight(true);
      const totalOffset =
        headerHeight + buttonHeight + footerHeight + kpiHeight + 40;
      const availableHeight = windowHeight - totalOffset;

      $("#liftingAmendmentGrid")
        .dxDataGrid("instance")
        .option("height", availableHeight);
    }

    $(window).off("resize").on("resize", setGridDynamicHeight);
    setTimeout(setGridDynamicHeight, 200);
  }

  window.liftingAmendmentData = liftingAmendmentData;
  window.updateLiftingGrid = function () {
    recalculateLiftingData();
    $("#liftingAmendmentGrid").dxDataGrid("instance").refresh();
    renderAllKpiCards();
  };
  window.generatePDF = generatePDF;
});