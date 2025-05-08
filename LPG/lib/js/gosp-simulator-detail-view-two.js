$(document).ready(function () {
    $.ajaxSetup({ cache: false });

    function getQueryParams() {
        const params = new URLSearchParams(window.location.search);
        return {
            area: params.get("area") || "Qatif",
            productGroup: params.get("productGroup"),
            products: params.get("product") ? params.get("product").split(",") : [],
            month: params.get("month"),
            gosp: params.get("gosp") ? params.get("gosp").split(",") : ["GOSP1", "GOSP2"]
        };
    }

    const selection = getQueryParams();
    const selectedGOSPs = selection.gosp;
    const area = selection.area;

    $("#app-header .title").html(`
      GOSP Simulator - 
      Product Group: ${selection.productGroup || ''} |
      Products: ${selection.products.join(", ") || ''} |
      Area: ${area} |
      Month: ${selection.month || ''} |
      GOSPs: ${selectedGOSPs.join(", ")}
    `);

    $.getJSON("../response/gosp_dynamic_production.json?v=" + new Date().getTime(), function (rawData) {
        const flattenedData = rawData.map(entry => {
            const flattened = {
                date: entry.date,
                totalActual: entry.total_actual,
                totalPlanned: entry.total_planned
            };

            entry.gosp_data.forEach(gospEntry => {
                const gospName = gospEntry.gosp;
                flattened[`${gospName}_actual`] = gospEntry.actual;
                flattened[`${gospName}_target`] = gospEntry.target;
            });

            return flattened;
        });

        // Build columns
        const productionActualCols = selectedGOSPs.map(gosp => ({
            dataField: `${gosp}_actual`,
            caption: `${area} ${gosp}`,
            allowSorting: false,
            alignment: "center",
            format: "#,##0",
            allowEditing: false
        }));

        const productionTargetCols = selectedGOSPs.map(gosp => ({
            dataField: `${gosp}_target`,
            caption: `${area} ${gosp}`,
            allowSorting: false,
            alignment: "center",
            format: "#,##0",
            cellTemplate: function (cellElement, cellInfo) {
                $("<div>")
                    .addClass("editable-cell yellow-cell")
                    .text(cellInfo.value)
                    .appendTo(cellElement);
            },
            editorType: "dxTextBox",
            allowEditing: true,
            setCellValue: function (newData, value, currentRowData) {
                newData[`${gosp}_target`] = Number(value);
            }
        }));

        const columns = [
            { dataField: "date", caption: "Date", width: 70, alignment: "center", allowEditing: false, allowSorting: false, fixed: true },
            {
                caption: "Production Actual",
                alignment: "center",
                columns: productionActualCols
            },
            {
                caption: "Production Target",
                alignment: "center",
                columns: productionTargetCols
            },
            { dataField: "totalActual", caption: "Total Actual", alignment: "center", allowSorting: false, format: "#,##0", allowEditing: false },
            { dataField: "totalPlanned", caption: "Total Planned", alignment: "center", allowSorting: false, format: "#,##0", allowEditing: false }
        ];

        $("#gospGrid1").dxDataGrid({
            dataSource: flattenedData,
            showBorders: true,
            columnAutoWidth: true,
            paging: false,
            height: "auto",
            columns: columns,
            editing: {
                mode: "cell",
                allowUpdating: true
            }
        });
    });
});
