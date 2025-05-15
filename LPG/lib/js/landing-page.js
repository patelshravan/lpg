// import { BASE_URL, API_ENDPOINTS } from "../api/api-config";

$(document).ready(function () {
  // Configure Toastr
  toastr.options = {
    closeButton: true,
    progressBar: true,
    positionClass: "toast-top-right",
    timeOut: 5000, // 5 seconds
    extendedTimeOut: 2000,
  };

  // Function to fetch CSRF token from SAS server
  async function sasgetCSRFToken() {
    const csrfURL = `${BASE_URL}${API_ENDPOINTS.CSRF}`;
    const res = await fetch(csrfURL, {
      method: "GET",
      credentials: "include",
      headers: { "Cache-Control": "no-cache" },
    });
    return res.headers.get("X-CSRF-TOKEN");
  }

  $("#btnLiftingSimulator").on("click", async function () {
    const button = $(this);
    button.prop("disabled", true).text("Loading...");

    try {
      //  Option 1: From SAS API using config
      // const csrfToken = await sasgetCSRFToken();

      // const userResponse = await fetch(`${BASE_URL}${API_ENDPOINTS.LANDING_PAGE}`, {
      //   method: "POST",
      //   headers: {
      //     "Content-Type": "application/json",
      //     "X-CSRF-TOKEN": csrfToken,
      //     "Cache-Control": "no-cache",
      //   },
      //   credentials: "include",
      //   body: JSON.stringify({}),
      // });

      // if (!userResponse.ok) {
      //   throw new Error(`Failed to fetch user mapping: ${userResponse.status}`);
      // }

      // const userData = await userResponse.json();

      // Option 2: Local mock JSON for testing (commented)
      const userResponse = await fetch(
        "../response/landing-page.json?v=" + Date.now()
      );
      if (!userResponse.ok)
        throw new Error(`Local JSON fetch failed: ${userResponse.status}`);
      const userData = await userResponse.json();

      const mapping = userData.MAPPING || [];

      if (!Array.isArray(mapping) || mapping.length === 0) {
        toastr.error(
          "User is not authenticated or has no group mapping. Please contact admin."
        );
        button
          .prop("disabled", false)
          .text("Inventory & Lifting Amendment Simulator");
        return;
      }

      // Store mapping data in sessionStorage
      sessionStorage.setItem("userMappingData", JSON.stringify(mapping));
      window.location.href = `lifting-amendment.html?v=${Date.now()}`;
    } catch (error) {
      toastr.error("Something went wrong:\n" + error);
      console.error("Error:", error);
      button
        .prop("disabled", false)
        .text("Inventory & Lifting Amendment Simulator");
    }
  });

  $("#btnGospSimulator").on("click", function () {
    const button = $(this);
    button.prop("disabled", true).text("Loading...");

    try {
      // Redirect to GOSP Simulator page
      window.location.href = "gosp-simulator.html";
    } catch (error) {
      toastr.error("Failed to redirect to GOSP Simulator:\n" + error);
      console.error("Error:", error);
      button.prop("disabled", false).text("GOSP Simulator");
    }
  });
});
