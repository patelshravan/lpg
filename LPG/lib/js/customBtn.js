// table-action-btn-wrap
new DevExpress.ui.dxButtonGroup(
  document.getElementById("table-action-btn-wrapet"),
  {
    items: [
      {
        style: "bold",
        icon: "bold",
      },
      {
        style: "italic",
        icon: "italic",
      },
      {
        style: "underline",
        icon: "underline",
      },
      {
        style: "strike",
        icon: "strike",
      },
    ],
    keyExpr: "style",
    selectionMode: "multiple",
    stylingMode: "outlined",
  }
);
