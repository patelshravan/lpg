const BASE_URL = "https://sasserver.demo.sas.com";

const API_ENDPOINTS = {
    READ: "/SASJobExecution/?_program=/Public/lpg/api/invproj_read",
    SAVE: "/SASJobExecution/?_program=/Public/lpg/api/invproj_save",
    UPDATE_UOM: "/SASJobExecution/?_program=/Public/lpg/api/invproj_update_uom",
    CSRF: "/SASJobExecution/csrf",
    CUSTOMER_AMENDMENT_REQUESTS: "../response/customer-amendment-requests.json",
    LIFTING_AMENDMENT: "../response/lifting-amendment.json",
};

export {
    BASE_URL,
    API_ENDPOINTS,
};