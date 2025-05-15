import { BASE_URL, API_ENDPOINTS } from '../api/api-config.js';

$(document).ready(function () {
  $.ajaxSetup({ cache: false });

  let customerAmendmentModalInstance = null;
  let latestAmendmentRequests = [];

  $('.btn:contains("Select Customer Amendment Requests")').on("click", function () {
    const $tbody = $("#customerAmendmentTable tbody");
    if (!$tbody.length) {
      console.error("Table body #customerAmendmentTable tbody not found in the DOM.");
      toastr.error("Table element not found. Please check the HTML structure.");
      return;
    }
    $tbody.empty();

    // 1) Grab the data you already fetched earlier:
    const amendmentRequests = latestAmendmentRequests;

    // 2) Validate / empty message
    if (!Array.isArray(amendmentRequests)) {
      toastr.error("Invalid data format.");
      return;
    }
    if (amendmentRequests.length === 0) {
      $tbody.append("<tr><td colspan='5' class='text-center'>No amendment requests available.</td></tr>");
      return;
    }

    // 3) Group amendment requests by NOMINATION_NO
    const groupedRequests = {};
    amendmentRequests.forEach((row) => {
      const { NOMINATION_NO, SHIP_NAME } = row;
      const key = `${NOMINATION_NO}/${SHIP_NAME}`; // Unique key for nomination
      if (!groupedRequests[key]) {
        groupedRequests[key] = {
          NOMINATION_NO,
          SHIP_NAME,
          requests: []
        };
      }
      groupedRequests[key].requests.push(row);
    });

    // 4) Render rows for each grouped nomination
    Object.values(groupedRequests).forEach((group) => {
      const { NOMINATION_NO, SHIP_NAME, requests } = group;

      let type = "—";
      if (requests.length > 0) {
        type = requests[0].REQUEST_TYPE || "—";
      }

      // Create the nested table with a row for each request (product)
      const $nestedTableBody = $("<tbody>");
      requests.forEach((row) => {
        const {
          PRODUCT_CODE_NAME,
          SCHEDULED_QTY,
          REQUESTED_QTY,
          DATE_VALUE,
          REQUESTED_DATE
        } = row;
        $nestedTableBody.append(`
        <tr>
          <td>${PRODUCT_CODE_NAME || "—"}</td>
          <td>${SCHEDULED_QTY?.toLocaleString() || "—"}</td>
          <td>${REQUESTED_QTY?.toLocaleString() || "—"}</td>
          <td>${DATE_VALUE || "—"}</td>
          <td>${REQUESTED_DATE || "—"}</td>
        </tr>
      `);
      });

      const $nestedTable = $("<table>")
        .addClass("nested-table table table-bordered")
        .hide()
        .append(`
        <thead>
          <tr>
            <th>Product Name</th>
            <th colspan="2" class="text-center">Qty</th>
            <th colspan="2" class="text-center">Date</th>
          </tr>
          <tr>
            <th></th><th>Scheduled</th><th>Requested</th><th>Scheduled</th><th>Requested</th>
          </tr>
        </thead>
      `)
        .append($nestedTableBody);

      const $tr = $("<tr>")
        .attr("data-nomination-no", NOMINATION_NO)
        .data("nominationNo", NOMINATION_NO)
        .data("productCode", requests[0].PRODUCT_CODE).append(`
          <td>
            <div class="nomination-details d-flex align-items-center">
              <span class="toggle-icon me-2" style="cursor: pointer;">▶</span>
              <span class="nomination-text">${NOMINATION_NO} / ${SHIP_NAME}</span>
            </div>
            <div class="nested-table-wrapper"></div>
          </td>
        `)
        .append(`<td>${type}</td>`)
        .append(`<td><input type="checkbox" class="apply-both-checkbox" id="applyBoth_${NOMINATION_NO}" /></td>`)
        .append(`<td><input type="checkbox" class="apply-qty-checkbox" id="applyQty_${NOMINATION_NO}" /></td>`)
        .append(`<td><input type="checkbox" class="apply-date-checkbox" id="applyDate_${NOMINATION_NO}" /></td>`);

      $tr.find(".nested-table-wrapper").append($nestedTable);
      $tbody.append($tr);
    });

    // 5) Re-attach “check all” handlers
    $("#checkAllBoth").off("change").on("change", () => {
      $(".apply-both-checkbox").prop("checked", $("#checkAllBoth").is(":checked"));
    });
    $("#checkAllQty").off("change").on("change", () => {
      $(".apply-qty-checkbox").prop("checked", $("#checkAllQty").is(":checked"));
    });
    $("#checkAllDate").off("change").on("change", () => {
      $(".apply-date-checkbox").prop("checked", $("#checkAllDate").is(":checked"));
    });

    // disable buttons to start
    $("#viewInScenarioBtn, #sendEmailBtn").prop("disabled", true);

    $tbody
      .add("#checkAllBoth, #checkAllQty, #checkAllDate")
      .off("change", "input[type=checkbox]")
      .on("change", "input[type=checkbox]", updateFooterButtons);

    if (!customerAmendmentModalInstance) {
      customerAmendmentModalInstance = new bootstrap.Modal(
        document.getElementById("customerAmendmentModal")
      );
    }
    customerAmendmentModalInstance.show();
  });

  // helper to toggle the footer buttons
  function updateFooterButtons() {
    const anyChecked = !!$(".apply-both-checkbox:checked, .apply-qty-checkbox:checked, .apply-date-checkbox:checked").length;
    $("#viewInScenarioBtn, #sendEmailBtn").prop("disabled", !anyChecked);
  }

  // wire up ALL the checkboxes: the per-row ones AND the header “check all” boxes
  $(document).off("change", "#checkAllBoth, #checkAllQty, #checkAllDate, .apply-both-checkbox, .apply-qty-checkbox, .apply-date-checkbox");
  $(document).on(
    "change",
    "#checkAllBoth, #checkAllQty, #checkAllDate, .apply-both-checkbox, .apply-qty-checkbox, .apply-date-checkbox",
    updateFooterButtons
  );

  // initialize once in case a header box was pre-checked
  updateFooterButtons();

  // Use event delegation for the dropdown toggle
  $("#customerAmendmentTable").off("click", ".nomination-details").on("click", ".nomination-details", function () {
    const $this = $(this);
    const $icon = $this.find(".toggle-icon");
    const $table = $this.next(".nested-table-wrapper").find(".nested-table");
    $table.toggle();
    $icon.text($table.is(":visible") ? "▼" : "▶");
  });

  $("#viewInScenarioBtn").off("click").on("click", function () {
    const missingNominations = [];

    $("#customerAmendmentTable tbody tr").each(function () {
      const $row = $(this);
      const nominationText = $row.find(".nomination-text").text().trim();
      const [nominationNumber] = nominationText.split(" / ").map(s => s.trim());

      const applyBoth = $row.find(".apply-both-checkbox").is(":checked");
      const applyQty = $row.find(".apply-qty-checkbox").is(":checked");
      const applyDate = $row.find(".apply-date-checkbox").is(":checked");
      if (!(applyBoth || applyQty || applyDate)) return;

      let matchFound = false;

      for (let parentRow of liftingAmendmentData) {
        if (!Array.isArray(parentRow.nomination)) continue;

        const nomIndex = parentRow.nomination.findIndex(
          n => n.nominationNumber === nominationNumber
        );
        if (nomIndex === -1) continue;

        const nomination = parentRow.nomination[nomIndex];
        matchFound = true;

        // ── APPLY QTY ──
        if (applyBoth || applyQty) {
          $row.find(".nested-table tbody tr").each(function () {
            const $cells = $(this).find("td");
            const productCode = $cells.eq(0).text().trim();
            const revisedQty = parseFloat($cells.eq(2).text().replace(/,/g, "")) || 0;
            const adjKey = `adjustedQty_${productCode}`;

            nomination[adjKey] = revisedQty;

            parentRow[`adjustment_${productCode}CL`] = parentRow.nomination
              .reduce((sum, n) => sum + (n[adjKey] || 0), 0);
          });
        }

        // ── APPLY DATE + MOVE ──
        if (applyBoth || applyDate) {
          const oldDay = parseInt($row.find(".nested-table tbody tr td").eq(3).text().replace(/\D/g, "")) || 0;
          const newDay = parseInt($row.find(".nested-table tbody tr td").eq(4).text().replace(/\D/g, "")) || oldDay;
          if (newDay !== oldDay) {
            // splice out of old row
            const moved = parentRow.nomination.splice(nomIndex, 1)[0];
            moved.DATE_VALUE_ADJ = newDay;

            // push into (or create) the newDay row
            let targetRow = liftingAmendmentData.find(r => r.date === newDay);
            if (!targetRow) {
              targetRow = { date: newDay, id: "row_" + newDay, nomination: [] };
              liftingAmendmentData.push(targetRow);
            }
            targetRow.nomination = targetRow.nomination || [];
            targetRow.nomination.push(moved);

            // recalc both rows
            const p = moved.PRODUCT_CODE;
            parentRow[`adjustment_${p}CL`] = parentRow.nomination
              .reduce((s, n) => s + (n[`adjustedQty_${p}`] || 0), 0);
            targetRow[`adjustment_${p}CL`] = targetRow.nomination
              .reduce((s, n) => s + (n[`adjustedQty_${p}`] || 0), 0);
          }
        }

        break;  // done with this nomination
      }

      if (!matchFound) {
        missingNominations.push(nominationNumber);
      }
    });

    if (missingNominations.length) {
      toastr.warning("Some nominations not found: " + missingNominations.join(", "));
    } else {
      toastr.success("Scenario updated with selected amendment requests.");
    }

    // recalc & redraw the main grid + KPIs
    updateLiftingGrid();
    renderAllKpiCards();

    // ── NEW: force re-render of any open detail rows ──
    const mainGrid = $("#liftingAmendmentGrid").dxDataGrid("instance");
    mainGrid.getVisibleRows().forEach(rowInfo => {
      if (mainGrid.isRowExpanded(rowInfo.key)) {
        mainGrid.collapseRow(rowInfo.key);
        mainGrid.expandRow(rowInfo.key);
      }
    });

    // finally hide the modal
    if (customerAmendmentModalInstance) {
      customerAmendmentModalInstance.hide();
    }
  });

  $("#sendEmailBtn").off("click").on("click", async function () {
    // build payload array
    const payload = $(".apply-both-checkbox, .apply-qty-checkbox, .apply-date-checkbox")
      .closest("tr")
      .map((_, tr) => {
        const $tr = $(tr);
        const nominationNo = $tr.data("nominationNo");
        const requestType = $tr.find("td").eq(1).text().trim();
        return {
          NOMINATION_NO: nominationNo,
          REQUEST_TYPE: requestType,
          APPLY_BOTH: $tr.find(".apply-both-checkbox").is(":checked") ? "1" : "0",
          APPLY_QTY: $tr.find(".apply-qty-checkbox").is(":checked") ? "1" : "0",
          APPLY_DATE: $tr.find(".apply-date-checkbox").is(":checked") ? "1" : "0"
        };
      }).get();

    if (!payload.length) {
      toastr.warning("Please select at least one nomination to email.");
      return;
    }

    // ** LOG IT **
    console.log("📤 Email payload:", JSON.stringify({ NOM_AMD_DATA: payload }, null, 2));

    const $btn = $(this).prop("disabled", true).text("Sending…");
    try {
      const csrfToken = await fetchCSRFToken();
      const res = await fetch(
        `${BASE_URL}${API_ENDPOINTS.EMAIL_AMENDMENT}`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-TOKEN": csrfToken
        },
        body: JSON.stringify({ NOM_AMD_DATA: payload })
      }
      );
      if (!res.ok) throw new Error(res.statusText);
      await res.json();
      toastr.success("Email request submitted successfully!");
    } catch (err) {
      console.error(err);
      toastr.error("Failed to send email.");
    } finally {
      $btn.prop("disabled", false).text("SEND EMAIL");
    }
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
                matchingRaw?.VERSION_NO ?? activeVersionFromReadAPI?.VERSION_NO ?? -1,
              HISTORY_NO: matchingRaw?.HISTORY_NO ?? null,
              PRODUCT_GROUP: matchingRaw?.PRODUCT_GROUP ?? selection.productGroupCode,
              LOCATION: matchingRaw?.LOCATION ?? selection.locationCode,
              MONTH_VALUE:
                matchingRaw?.MONTH_VALUE ?? selection.month.replace(" ", "").toUpperCase(),
              KS_ROW_NUM: matchingRaw?.KS_ROW_NUM ?? null,
              DATE_VALUE: row.date,
              DATE_VALUE_ADJ: nom.DATE_VALUE_ADJ ?? row.date,
              NOMINATION_NO: nom.nominationNumber,
              CUSTOMER_NAME: nom.customerName,
              SHIP_NAME: nom.shipName,
              PRODUCT_CODE: productCode,
              SCHEDULED_QTY: nom[`scheduledQty_${productCode}`] || 0,
              SCHEDULED_QTY_ADJ: nom[`adjustedQty_${productCode}`] || 0,
              ACTUAL_QTY: matchingRaw?.ACTUAL_QTY ?? (nom[`scheduledQty_${productCode}`] || 0),
            });
          }
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

    const selectedAmendments = latestAmendmentRequests.map(original => {
      const $tr = $(
        `#customerAmendmentTable tbody tr[data-nomination-no="${original.NOMINATION_NO}"]`
      );

      const APPLY_BOTH = $tr.find(".apply-both-checkbox").is(":checked") ? "1" : "0";
      const APPLY_QTY = $tr.find(".apply-qty-checkbox").is(":checked") ? "1" : "0";
      const APPLY_DATE = $tr.find(".apply-date-checkbox").is(":checked") ? "1" : "0";

      return {
        ...original,
        APPLY_BOTH,
        APPLY_QTY,
        APPLY_DATE
      };
    });

    const payload = {
      VERSION: activeVersionFromReadAPI,
      INVENTORY: inventoryData,
      OPENING_INVENTORY: transformedOpeningInventory,
      WORKING_CAPACITY: workingCapacityPayload,
      NOMINATION: nominationAggregate,
      MIN_MAX_PERCENTAGE: minMaxPercentageData,
      NOM_AMD_DATA: selectedAmendments
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

    // Check if the name already exists in savedVersions
    if (savedVersions.some(version => version.name === name)) {
      toastr.error("Version name already exists. Please choose a different name.");
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
        const dateDay = Number(Date);

        Object.entries(productEntries).forEach(([productCode, value]) => {
          const meta = (inventoryData || []).find(
            (inv) => inv.DATE_VALUE === dateDay && inv.PRODUCT_CODE === productCode
          );

          transformedOpeningInventory.push({
            VERSION_NO: meta?.VERSION_NO ?? activeVersionFromReadAPI?.VERSION_NO ?? -1,
            HISTORY_NO: meta?.HISTORY_NO ?? null,
            PRODUCT_GROUP: meta?.PRODUCT_GROUP ?? selection.productGroupCode,
            LOCATION: meta?.LOCATION ?? selection.locationCode,
            MONTH_VALUE: meta?.MONTH_VALUE ?? selection.month.replace(" ", "").toUpperCase(),
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

    const selectedAmendments = latestAmendmentRequests.map(original => {
      const $tr = $(
        `#customerAmendmentTable tbody tr[data-nomination-no="${original.NOMINATION_NO}"]`
      );

      const APPLY_BOTH = $tr.find(".apply-both-checkbox").is(":checked") ? "1" : "0";
      const APPLY_QTY = $tr.find(".apply-qty-checkbox").is(":checked") ? "1" : "0";
      const APPLY_DATE = $tr.find(".apply-date-checkbox").is(":checked") ? "1" : "0";

      return {
        ...original,
        APPLY_BOTH,
        APPLY_QTY,
        APPLY_DATE
      };
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
      NOM_AMD_DATA: selectedAmendments
    };

    console.log("📤 Save As Payload:", versionPayload);

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
      const response = await fetch(`${BASE_URL}${API_ENDPOINTS.SAVE}`, {
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

      // ✅ Update active version info manually
      activeVersionFromReadAPI = {
        VERSION_NO: -1,
        VERSION_NAME: name,
        VERSION_DESCRIPTION: description,
      };

      // ✅ Update the header immediately
      updateHeader(selection);

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
    countriesData = [];

  let originalOpeningInventoryData = [],
    originalWorkingCapacityData = [],
    originalInventoryPlanningData = [];


  // Attach event to Change Unit button
  $("#changeUnitBtn").on("click", function () {
    const nameMap = window.productNameMap || {};

    $("#unitFactorTableBody").empty();

    selection.products.forEach(function (product) {
      const displayName = nameMap[product] || product;
      const key = `${product}_${currentUnit}`;
      const backendFactor = availableUOMData
        .find(item =>
          item.PRODUCT_CODE === product &&
          item.CONVERSION_UNIT === currentUnit
        )?.CONVERSION_FACTOR || 1;
      const factor = userUpdatedUOMFactors[key] ?? backendFactor;

      $("#unitFactorTableBody").append(`
      <tr>
        <td>${displayName}</td>
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

      const productNameMap = {};
      data.UOM.forEach(item => {
        productNameMap[item.PRODUCT_CODE] = item.PRODUCT_CODE_NAME;
      });
      // save it globally so your grid init can see it
      window.productNameMap = productNameMap;

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
              const actualField = `actualQty_${n.PRODUCT_CODE}`;

              nominationMap[nomNo][actualField] = n.ACTUAL_QTY || 0;
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

      storeOriginalNominationState();
      recalculateLiftingData();
      initializeApp();
      renderAllKpiCards();
    } catch (error) {
      console.error("❌ handleReadApiData Failed:", error);
      toastr.error(`Failed to load response data.\n${error}`);
    } finally {
      $("#loadingSpinner").fadeOut();
    }
  };

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

  async function callReadAPIWithSelection(selection) {
    try {
      $("#loadingSpinner").show();
      // const csrfToken = await fetchCSRFToken();

      // const response = await fetch(
      //   `${BASE_URL}${API_ENDPOINTS.READ}`,
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

      // Local mock JSON instead of API
      const response = await fetch(API_ENDPOINTS.LIFTING_AMENDMENT);
      const data = await response.json();

      latestAmendmentRequests = data.NOM_AMD_DATA || [];

      const productNameMap = {};
      data.UOM.forEach(item => {
        productNameMap[item.PRODUCT_CODE] = item.PRODUCT_CODE_NAME;
      });

      window.productNameMap = productNameMap;

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

              const productCode = n.PRODUCT_CODE;
              const productField = `scheduledQty_${productCode}`;
              const adjustedField = `adjustedQty_${productCode}`;
              const actualField = `actualQty_${productCode}`;

              nominationMap[nomNo][productField] = n.SCHEDULED_QTY;
              nominationMap[nomNo][adjustedField] = n.SCHEDULED_QTY_ADJ || 0;
              nominationMap[nomNo][actualField] = n.ACTUAL_QTY || 0;

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

      storeOriginalNominationState();
      recalculateLiftingData();
      initializeApp();
      renderAllKpiCards();
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

      $(".apply-both-checkbox, .apply-qty-checkbox, .apply-date-checkbox").prop("checked", false);
      $("#checkAllBoth, #checkAllQty, #checkAllDate").prop("checked", false);

      latestAmendmentRequests.forEach(r => {
        r.APPLY_BOTH = "0";
        r.APPLY_QTY = "0";
        r.APPLY_DATE = "0";
      });

      updateFooterButtons();

      toastr.success("All adjustments have been reset.");
    });
  }

  // Function for PDF generation
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

    const minRow = inventoryPlanningData.find((r) => r.Type === "Min") || {};
    const maxRow = inventoryPlanningData.find((r) => r.Type === "Max") || {};

    const violationDays = liftingAmendmentData.filter((row) =>
      selection.products.some((p) => {
        const val = parseInt(row[`closingPercentage_${p}`]) || 0;
        const min = parseInt(minRow[p]) || 0;
        const max = parseInt(maxRow[p]) || 100;
        return val < min || val > max;
      })
    ).length;

    const kpiData = [
      [
        "Total Cargoes",
        liftingAmendmentData.reduce((sum, r) => sum + r.numberOfShips, 0),
      ],
      ["Violation Days", violationDays],
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
        date: String(row.date).padStart(2, "0"), // Ensure 2-digit date
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
    const maxColumnsPerPage = Math.floor(usableWidth / 12); // Minimum width consideration

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

        startY = margin; // Reset to top for new page
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
          grid.saveEditData();

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
        if (e.rowType !== "data") return;

        // full JS Date for this row
        const cellDate = new Date(
          parseInt(yearStr),
          monthMap[monthStr],
          Number(e.data.Date)
        );
        cellDate.setHours(0, 0, 0, 0);

        const todayZero = new Date();
        todayZero.setHours(0, 0, 0, 0);

        if (cellDate < todayZero) {
          // past rows → grey + block
          $(e.cellElement).css({
            backgroundColor: "#eee",
            color: "#999",
            cursor: "not-allowed",
          });
        } else {
          // today/future → editable I-beam
          $(e.cellElement).css({
            cursor: "text",
          });
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
      const dateCol =
        hasDate || selector === "#openingInventoryGrid"
          ? [{
            dataField: "Date",
            caption: "Date",
            alignment: "center",
            width: 100,
            allowEditing: false,
            allowSorting: false,
            cellTemplate(container, options) {
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
          }]
          : [];

      // --- Inventory Planning grid (always >= 0, <=100) ---
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
            caption: window.productNameMap[p] || p,
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
              const converted = currentUnit === "MB" ? val : val * factor;
              $(container)
                .css({ "background-color": "#f6edc8", "font-weight": "bold" })
                .text(converted);
            },
          })),
        ]);
      }

      // --- Opening Inventory & Working Capacity grids ---
      return dateCol.concat(
        selection.products.map((p) => {
          const isWorkingCapacity = selector === "#workingCapacityGrid";
          return {
            dataField: p,
            caption: window.productNameMap[p] || p,
            alignment: "center",
            allowEditing:
              hasDate || selector === "#openingInventoryGrid"
                ? editingEnabled
                : false,
            editorType: "dxNumberBox",
            allowSorting: false,
            editorOptions: {
              // prevent negatives in Working Capacity
              ...(isWorkingCapacity ? { min: 0 } : {}),
              showSpinButtons: false,
              format: "#,##0.##",
              inputAttr: {
                style: "background-color: #f6edc8; font-weight: bold;",
              },
            },
            cellTemplate(container, options) {
              $(container)
                .css({ "background-color": "#f6edc8", "font-weight": "bold" })
                .text(Number(options.value || 0));
            },
          };
        })
      );
    }
  }

  function recalculateLiftingData(startIndex = 0) {
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

      // ── sink the apply-flags in the Customer Amendment table ──
      $(`#applyBoth_${nomId}, #applyQty_${nomId}, #applyDate_${nomId}`)
        .prop("checked", false);

      // ── clear them out in our in-memory requests so the payload builder skips them ──
      latestAmendmentRequests
        .filter(r => r.NOMINATION_NO === nomId)
        .forEach(r => {
          r.APPLY_BOTH = "0";
          r.APPLY_QTY = "0";
          r.APPLY_DATE = "0";
        });

      // ── refresh the footer buttons state ──
      updateFooterButtons();

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
    const nameMap = window.productNameMap || {};
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
      .map((p) => `<th>${nameMap[p] || p}</th>`)
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
      .map((v) => `<th>${nameMap[v.name] || v.name}</th>`)
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
        value: currentUnit === "MB" ? rawValue : rawValue * factor,
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
        value: currentUnit === "MB" ? rawValue : rawValue * factor,
      };
    });

    // Demand card
    const demandHeader = selection.products
      .map(p => `<th>${nameMap[p] || p}</th>`)
      .join("");
    const demandValues = selection.products
      .map(p => `<td><strong>${demand.find(d => d.name === p).value.toLocaleString()}</strong></td>`)
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
    const availHeader = selection.products
      .map(p => `<th>${nameMap[p] || p}</th>`)
      .join("");
    const availValues = selection.products
      .map(p => `<td><strong>${available.find(a => a.name === p).value.toLocaleString()}</strong></td>`)
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

  function initializeLiftingAmendmentGrid() {
    recalculateLiftingData();

    // 🔥 Min/Max cache map (no more find() inside every cell)
    const minMaxMap = {};
    (inventoryPlanningData || []).forEach(item => {
      if (item.Type === "Min" || item.Type === "Max") {
        Object.keys(item).forEach(key => {
          if (key !== "Type") {
            if (!minMaxMap[key]) minMaxMap[key] = {};
            minMaxMap[key][item.Type.toLowerCase()] = parseInt(item[key]) || (item.Type === "Min" ? 0 : 100);
          }
        });
      }
    });

    const isInternational = selection.terminal.toLowerCase() === "international";

    const countryMap = {};
    countriesData.forEach((entry) => {
      if (
        entry.PRODUCT_GROUP.toLowerCase() === selection.productGroup.toLowerCase() &&
        selection.products.includes(entry.PRODUCT_CODE) &&
        entry.MONTH_VALUE.toUpperCase() === selection.month.replace(" ", "").toUpperCase()
      ) {
        countryMap[entry.PRODUCT_CODE] = entry.COUNTRIES || [];
      }
    });

    $("#liftingAmendmentGrid").dxDataGrid({
      dataSource: liftingAmendmentData,
      keyExpr: "id",
      showBorders: true,
      columnAutoWidth: false,
      allowColumnResizing: true,
      columnResizingMode: "widget",
      paging: { enabled: false },
      height: "auto",
      editing: { mode: "cell", allowUpdating: true },
      scrolling: {
        scrollByContent: true,
        scrollByThumb: true,
        showScrollbar: "onHover",
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
          e.column.dataField?.startsWith("adjustment_")
        ) {
          // build the full date for this row
          const monthIndex = monthMap[monthStr];
          const rowDate = new Date(
            parseInt(yearStr),
            monthIndex,
            e.data.date
          );
          rowDate.setHours(0, 0, 0, 0);

          const today = new Date();
          today.setHours(0, 0, 0, 0);

          if (rowDate < today) {
            // past → grey & block
            $(e.cellElement).css({
              backgroundColor: "#eee",
              color: "#999",
              cursor: "not-allowed"
            });
          }
          else {
            // today/future → editable I-beam
            $(e.cellElement).css({
              backgroundColor: "#f6edc8",
              fontWeight: "bold",
              cursor: "text"
            });
          }
        }
      },
      onEditorPreparing(e) {
        if (
          e.parentType === "dataRow" &&
          /^adjustment_.+CL$/.test(e.dataField)
        ) {
          const m = e.dataField.match(/^adjustment_(.+)CL$/);
          const product = m ? m[1] : null;

          e.editorOptions.onValueChanged = (args) => {
            const newTotal = Number(args.value) || 0;
            const rowData = e.row.data;

            rowData[e.dataField] = newTotal;

            const noms = rowData.nomination || [];
            const perNom = noms.length ? newTotal / noms.length : 0;
            noms.forEach(n => {
              n[`adjustedQty_${product}`] = perNom;
            });

            recalculateLiftingData(e.row.rowIndex);
            const grid = $("#liftingAmendmentGrid").dxDataGrid("instance");
            grid.refresh();
            if (grid.isRowExpanded(rowData.id)) {
              grid.collapseRow(rowData.id);
              grid.expandRow(rowData.id);
            }
            renderAllKpiCards();
          };
        }
      },
      onRowUpdated(e) {
        const updatedRowIndex = liftingAmendmentData.findIndex(
          (r) => r.id === e.data.id
        );
        recalculateLiftingData(updatedRowIndex);
        $("#liftingAmendmentGrid").dxDataGrid("instance").refresh();
        renderAllKpiCards();
      },
      onContentReady: function () {
        $(".overlay").fadeOut();
        setGridDynamicHeight();
      },
      customizeColumns: function (columns) {
        columns.forEach((col) => {
          if (col.command === "expand") col.visible = false;
        });
      },
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

          const actualColumns = selection.products.map((product) => ({
            dataField: `actualQty_${product}`,
            caption: window.productNameMap[product] || product,
            width: 80,
            alignment: "center",
            allowEditing: false,
            allowSorting: false,
            format: "#,##0",
            cellTemplate: (container, options) => {
              const val = Number(options.value || 0);
              $(container)
                .css({ fontWeight: "bold" })
                .text(val.toLocaleString());
            },
          }));

          const scheduledColumns = selection.products
            .map((product) => ({
              dataField: `scheduledQty_${product}`,
              caption: window.productNameMap[product] || product,
              width: 80,
              alignment: "center",
              allowEditing: false,
              allowSorting: false,
              format: "#,##0",
              calculateCellValue: (rowData) => {
                const value = rowData[`scheduledQty_${product}`];
                return isNaN(value) || value == null ? 0 : value;
              },
            }))
            .concat([
              {
                dataField: "scheduledTotal",
                caption: "Total",
                width: 100,
                alignment: "center",
                allowEditing: false,
                allowSorting: false,
                format: "#,##0",
                cellTemplate: (container, options) => {
                  const val = Number(options.value || 0);
                  $(container)
                    .css({ "font-weight": "bold" })
                    .text(val.toLocaleString());
                },
              },
            ]);

          const adjustedColumns = selection.products.map((product) => ({
            dataField: `adjustedQty_${product}`,
            caption: window.productNameMap[product] || product,
            width: 80,
            alignment: "center",
            allowSorting: false,
            format: "#0.##",
            editorType: "dxNumberBox",
            editorOptions: {
              showSpinButtons: false,
              step: 0.01,
              format: "#0.##",
              inputAttr: {
                style:
                  "background-color: #f6edc8; font-weight: bold; text-align: center;",
              },
            },
            cellTemplate: function (container, options) {
              const val = Number(options.value || 0);
              // show up to 2 decimal places
              $(container)
                .addClass("yellow-bg")
                .text(val.toLocaleString(undefined, {
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 2
                }));
            },
          }));

          // Create the nomination details grid
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
                if (parentFullDate < today) {
                  e.cancel = true;
                }
              },
              columns: [
                {
                  dataField: "nominationNumber",
                  caption: "Nomination Number",
                  width: 120,
                  alignment: "center",
                  allowEditing: false,
                  allowSorting: false,
                },
                {
                  dataField: "customerName",
                  caption: "Customer Name",
                  width: 150,
                  alignment: "center",
                  allowEditing: false,
                  allowSorting: false,
                },
                {
                  dataField: "shipName",
                  caption: "Ship Name",
                  width: 150,
                  alignment: "center",
                  allowEditing: false,
                  allowSorting: false,
                },
                { caption: "Actual Qty", columns: actualColumns },
                { caption: "Scheduled Qty", columns: scheduledColumns },
                { caption: "Adjusted Qty", columns: adjustedColumns },
                {
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
                      const adjDay =
                        options.data.DATE_VALUE_ADJ ||
                        options.data.DATE_VALUE ||
                        parentRowDate;

                      // 🛑 Check for a valid numeric day (1–31)
                      if (
                        typeof adjDay === "number" &&
                        adjDay > 0 &&
                        adjDay <= 31
                      ) {
                        return new Date(
                          parseInt(yearStr),
                          monthMap[monthStr],
                          adjDay
                        );
                      }

                      return null; // Fallback to no selection
                    })(),
                    min: (() => {
                      const today = new Date();
                      today.setHours(0, 0, 0, 0);
                      return today;
                    })(),
                    max: new Date(parseInt(yearStr), monthMap[monthStr] + 1, 0),
                    onValueChanged: function (e) {
                      const gridInstance =
                        nominationGrid.dxDataGrid("instance");
                      const rowIndex = $(e.element).closest(".dx-row").index();
                      const nominationRow = gridInstance
                        .getDataSource()
                        .items()[rowIndex];

                      console.log(
                        "Raw e.value received from date picker:",
                        e.value
                      );

                      // Safely convert timestamp or value to Date
                      let newDate;
                      if (e.value instanceof Date) {
                        newDate = e.value;
                      } else if (typeof e.value === "number") {
                        newDate = new Date(e.value); // <-- for timestamp like 1744675200016
                      } else if (typeof e.value === "string") {
                        newDate = new Date(Date.parse(e.value));
                      }

                      if (!newDate || isNaN(newDate.getTime())) {
                        console.log(
                          "No valid date selected, skipping the move logic."
                        );
                        return;
                      }

                      const newDay = newDate.getDate();

                      const oldDay =
                        nominationRow.DATE_VALUE_ADJ ||
                        nominationRow.DATE_VALUE ||
                        parentRowDate;

                      if (newDay === Number(oldDay)) {
                        console.log("Dates are the same, no action needed.");
                        return;
                      }

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
                        (n) =>
                          n.nominationNumber === nominationRow.nominationNumber
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
                      $("#liftingAmendmentGrid")
                        .dxDataGrid("instance")
                        .refresh();
                      renderAllKpiCards();
                    },
                  },
                  cellTemplate: function (container, options) {
                    const adjDay = options.data.DATE_VALUE_ADJ;
                    if (
                      typeof adjDay === "number" &&
                      adjDay > 0 &&
                      adjDay <= 31
                    ) {
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
                },
              ],
              onRowUpdated: function (e) {
                // Update the adjustment totals in the parent row based on nomination changes.
                selection.products.forEach((product) => {
                  const parentRow = liftingAmendmentData.find(
                    (row) => Number(row.date) === parentRowDate
                  );
                  if (!parentRow) return;
                  const totalAdjustment = parentRow.nomination.reduce(
                    (sum, nomination) =>
                      sum + (Number(nomination[`adjustedQty_${product}`]) || 0),
                    0
                  );
                  parentRow[`adjustment_${product}CL`] = totalAdjustment;
                });
                recalculateLiftingData();
                $("#liftingAmendmentGrid").dxDataGrid("instance").refresh();
                renderAllKpiCards();
              },
              onEditorPrepared(e) {
                if (e.dataField && /^adjustedQty_/.test(e.dataField)) {
                  const cellDate = new Date(parseInt(yearStr), monthMap[monthStr], parentRowDate);
                  cellDate.setHours(0, 0, 0, 0);

                  const today = new Date();
                  today.setHours(0, 0, 0, 0);

                  if (cellDate >= today) {
                    $(e.editorElement).find("input").css("cursor", "text");
                  } else {
                    $(e.editorElement).find("input").css("cursor", "not-allowed");
                  }
                }
              },
              onCellPrepared(e) {
                if (e.rowType !== "data") return;

                const cellDate = new Date(parseInt(yearStr), monthMap[monthStr], parentRowDate);
                cellDate.setHours(0, 0, 0, 0);

                const today = new Date();
                today.setHours(0, 0, 0, 0);

                const isAdjQty = /^adjustedQty_/.test(e.column.dataField);
                const isMoveDate = e.column.dataField === "DATE_VALUE_ADJ";

                if (cellDate < today) {
                  // ❌ Past dates: disable edit styling
                  if (isAdjQty || isMoveDate) {
                    $(e.cellElement).css({
                      backgroundColor: "#eee",
                      color: "#999",
                      cursor: "not-allowed"
                    });
                  }
                } else {
                  // ✅ Present/Future dates: make cursor text for adjustedQty
                  if (isAdjQty) {
                    $(e.cellElement).css({
                      cursor: "text"
                    });
                  }
                }
              }
            })
            .appendTo(container);
        },
      },
      columns: [
        {
          dataField: "date",
          caption: "Date",
          width: 100,
          alignment: "center",
          fixed: true,
          fixedPosition: "left",
          allowSorting: false,
          allowEditing: false,
          cellTemplate: function (container, options) {
            $("<a>")
              .text(options.value)
              .addClass("date-link")
              .on("click", function () {
                const grid = $("#liftingAmendmentGrid").dxDataGrid("instance");
                const isExpanded = grid.isRowExpanded(options.key);
                isExpanded
                  ? grid.collapseRow(options.key)
                  : grid.expandRow(options.key);
              })
              .appendTo(container);
          },
        },

        ...selection.products.map((product) => {
          const countries = countryMap[product] || [];

          if (isInternational) {
            // 🌍 International ➔ Show country name row first
            return {
              caption: countries.join(", "),
              alignment: "center",
              columns: [
                {
                  caption: product,
                  alignment: "center",
                  columns: getProductFieldColumns(product),
                },
              ],
            };
          } else {
            // 🏠 Domestic ➔ Only product
            return {
              caption: window.productNameMap[product] || product,
              alignment: "center",
              columns: getProductFieldColumns(product),
            };
          }
        }),
        {
          caption: "Summary",
          fixed: true,
          fixedPosition: "right",
          columns: [
            {
              dataField: "numberOfShips",
              caption: "Number of Ships",
              width: 130,
              alignment: "center",
              allowEditing: false,
              allowSorting: false,
              format: "#,##0",
            },
            {
              dataField: "totalLifting",
              caption: "Total Lifting",
              width: 130,
              alignment: "center",
              allowEditing: false,
              allowSorting: false,
              format: "#,##0",
            },
            {
              dataField: "liftingPer2Days",
              caption: "Lifting Per 2 Days",
              width: 130,
              alignment: "center",
              allowEditing: false,
              allowSorting: false,
              format: "#,##0",
            },
          ],
        },
      ],
    });

    function getProductFieldColumns(product) {
      return [
        {
          dataField: `terminalAvails_${product}`,
          caption: "Terminal Avails",
          width: 150,
          alignment: "center",
          allowEditing: false,
          allowSorting: false,
          format: "#,##0",
          cellTemplate: terminalAvailsTemplate,
        },
        {
          dataField: `adjustment_${product}TA`,
          caption: "Adj.",
          width: 120,
          alignment: "center",
          allowSorting: false,
          format: "#,##0",
          editorType: "dxNumberBox",
          editorOptions: {
            showSpinButtons: false,
            inputAttr: {
              style: "background-color: #f6edc8; font-weight: bold;",
            },
          },
          cellTemplate: adjustmentTemplate,
        },
        {
          dataField: `customerLifting_${product}`,
          caption: "Customer Lifting",
          width: 150,
          alignment: "center",
          allowEditing: false,
          allowSorting: false,
          format: "#,##0",
          cellTemplate: customerLiftingTemplate,
        },
        {
          dataField: `adjustment_${product}CL`,
          caption: "Adj.",
          width: 120,
          alignment: "center",
          allowSorting: false,
          format: "#,##0",
          editorType: "dxNumberBox",
          editorOptions: {
            showSpinButtons: false,
            inputAttr: {
              style: "background-color: #f6edc8; font-weight: bold;",
            },
          },
          cellTemplate: adjustmentTemplate,
        },
        {
          dataField: `closingInventory_${product}`,
          caption: "Closing Inv.",
          width: 150,
          alignment: "center",
          allowEditing: false,
          allowSorting: false,
          format: "#,##0",
          cellTemplate: closingInventoryTemplate,
        },
        {
          dataField: `closingPercentage_${product}`,
          caption: "Closing %",
          width: 150,
          alignment: "center",
          allowEditing: false,
          allowSorting: false,
          cellTemplate: closingPercentageTemplate,
        },
      ];
    }

    function terminalAvailsTemplate(container, options) {
      const val = Number(options.value || 0);
      const prod = options.column.dataField.split("_")[1];
      const factor = unitConversionFactors[prod] || 1;
      const converted = val * factor;
      $(container).text(converted.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 }));
    }

    function adjustmentTemplate(container, options) {
      const val = Number(options.value || 0);
      const match = options.column.dataField.match(/adjustment_(.+)(TA|CL)/);
      const prod = match ? match[1] : null;
      const factor = unitConversionFactors[prod] || 1;
      const converted = val * factor;
      $(container).addClass("yellow-bg").text(converted.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 }));
    }

    function customerLiftingTemplate(container, options) {
      const val = Number(options.value || 0);
      const prod = options.column.dataField.split("_")[1];
      const factor = unitConversionFactors[prod] || 1;
      const converted = val * factor;
      $(container).text(converted.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 }));
    }

    function closingInventoryTemplate(container, options) {
      const val = Number(options.value || 0);
      const prod = options.column.dataField.split("_")[1];
      const factor = unitConversionFactors[prod] || 1;
      const converted = val * factor;
      $(container).text(converted.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 }));
    }

    function closingPercentageTemplate(container, options) {
      const val = parseInt((options.value || "0").replace("%", ""), 10);
      const prod = options.column.dataField.split("_")[1];

      // grab the latest Min/Max rows
      const minRow = inventoryPlanningData.find(r => r.Type === "Min") || {};
      const maxRow = inventoryPlanningData.find(r => r.Type === "Max") || {};

      const min = parseFloat(minRow[prod]) || 0;
      const max = parseFloat(maxRow[prod]) || 100;

      const colorClass = (val < min || val > max) ? "red-bar" : "green-bar";

      $(container).html(`
    <div class="progress-container">
      <div class="progress-bar ${colorClass}" style="width: ${val}%"></div>
      <div class="progress-text">${val}%</div>
    </div>
  `);
    }

    function setGridDynamicHeight() {
      const windowHeight = $(window).height();
      const headerHeight = $("#app-header").outerHeight(true);
      const buttonHeight = $(".button-group").outerHeight(true);
      const footerHeight = $(".bottom-buttons").outerHeight(true);
      const kpiHeight = $(".kpi-card").first().closest(".row").outerHeight(true);
      const totalOffset = headerHeight + buttonHeight + footerHeight + kpiHeight + 40;
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