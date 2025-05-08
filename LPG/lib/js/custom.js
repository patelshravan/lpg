var date = new Date();
if (date.getMonth() === 11) {
  var yyyy = String(date.getFullYear() + 1);
  var nextMonth = 0;
} else {
  var yyyy = String(date.getFullYear());
  var nextMonth = date.getMonth() + 1;
}

var months = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

var selectedMonthName = months[nextMonth];

$(document).ready(function () {
  var date = new Date();
  var yyyy = date.getFullYear();
  var nextMonth = date.getMonth();
  var selectedYear = date.getMonth() === 11 ? yyyy + 1 : yyyy;

  var months = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];

  var selectedMonthName = months[nextMonth];

  // **Set initial text for display**
  $("#datepicker1").text(
    "Planning Month - " + selectedMonthName + "-" + selectedYear
  );

  // **Destroy any existing datepicker instance to avoid conflicts**
  $("#datepicker1").datepicker("destroy");

  // **Initialize Datepicker (Ensure it's NOT visible initially)**
  $("#datepicker1").datepicker({
    format: "MM-yyyy",
    startView: "months",
    minViewMode: "months",
    autoclose: true,
    todayHighlight: true,
    forceParse: false,
    defaultViewDate: { year: selectedYear, month: nextMonth },
  });

  // **Show Datepicker when clicking on #datepicker1**
  $("#datepicker1").on("click", function (e) {
    e.stopPropagation();
    $(this).datepicker("show");
  });

  // **Ensure Datepicker updates text dynamically**
  $("#datepicker1").on("changeDate", function (e) {
    let selectedDate = e.format(0, "MM-yyyy");
    $("#datepicker1").text("Planning Month - " + selectedDate);
  });

  // **Ensure clicking outside closes the datepicker**
  $(document).on("click", function (event) {
    if (!$(event.target).closest("#datepicker1, .datepicker").length) {
      $("#datepicker1").datepicker("hide");
    }
  });
});
