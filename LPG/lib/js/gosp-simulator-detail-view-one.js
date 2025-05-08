$(document).ready(function () {
    $.ajaxSetup({ cache: false });

    function getQueryParams() {
        let params = new URLSearchParams(window.location.search);
        return {
            area: params.get("area"),
            productGroup: params.get("productGroup"),
            products: params.get("product") ? params.get("product").split(",") : [],
            month: params.get("month"),
            gosp: params.get("gosp") ? params.get("gosp").split(",") : []
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
        GOSPs: ${selectedGOSPs.join(", ") || ''}
    `);

    // Fetch JSON data
    $.getJSON("../response/gosp_dynamic_production.json?v=" + new Date().getTime(), function (data) {
        // Filter data based on selected area and product (assuming product is the first in products array)
        const filteredData = data.filter(item =>
            item.area === area &&
            (!selection.products.length || selection.products.includes(item.product))
        );

        // Generate data source from JSON
        const generateDataSource = (gosps) => {
            return filteredData.map(item => {
                const row = { date: item.date };
                let totalActual = 0;
                let totalPlanned = 0;

                gosps.forEach(gosp => {
                    const gospData = item.gosp_data.find(g => g.gosp === gosp);
                    row[`actual_${gosp}`] = gospData ? gospData.actual : 0;
                    row[`target_${gosp}`] = gospData ? gospData.target : 0;
                    totalActual += row[`actual_${gosp}`];
                    totalPlanned += row[`target_${gosp}`];
                });

                row.totalActual = item.total_actual || totalActual; // Use JSON total if available
                row.totalPlanned = item.total_planned || totalPlanned; // Use JSON total if available
                return row;
            });
        };

        // Use the selected GOSPs (default to GOSP1 and GOSP2 if none provided)
        const gosps = selectedGOSPs.length > 0 ? selectedGOSPs : ["GOSP1", "GOSP2"];
        const dataSource = generateDataSource(gosps);

        // Columns for the single table with grouped GOSP columns
        const columns = [
            { dataField: "date", caption: "Date", width: 70, fixed: true, allowEditing: false, allowSorting: false, alignment: "center" }
        ];

        // Add grouped columns for each GOSP
        gosps.forEach(gosp => {
            columns.push({
                caption: `${area} ${gosp}`,
                columns: [
                    {
                        dataField: `actual_${gosp}`,
                        caption: "Production Actual",
                        alignment: "center",
                        allowSorting: false,
                        format: "#,##0",
                        allowEditing: false,
                    },
                    {
                        dataField: `target_${gosp}`,
                        caption: "Production Target",
                        alignment: "center",
                        allowSorting: false,
                        format: "#,##0",
                        // 👇 Make editable and yellow
                        cellTemplate: function (cellElement, cellInfo) {
                            $("<div>")
                                .addClass("editable-cell yellow-cell")
                                .text(cellInfo.value)
                                .appendTo(cellElement);
                        },
                        editorType: "dxTextBox",
                        allowEditing: true,
                        setCellValue: function (newData, value, currentRowData) {
                            newData[`target_${gosp}`] = Number(value);
                        }
                    }
                ]
            });
        });

        // Add total columns
        columns.push(
            { dataField: "totalActual", caption: "Total Actual", format: "#,##0", allowEditing: false, allowSorting: false, alignment: "center" },
            { dataField: "totalPlanned", caption: "Total Planned", format: "#,##0", allowEditing: false, allowSorting: false, alignment: "center" }
        );

        // Initialize the single DataGrid
        $("#gospGrid1").dxDataGrid({
            dataSource: dataSource,
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

    }).fail(function (xhr, status, error) {
        console.error("Error fetching JSON data:", error);
    });
});