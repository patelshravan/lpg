$(document).ready(function () {
    //     set date
    setNewDate();
  
  
  function setNewDate() {
    var dt = new Date();
    var notLastMonth = dt.getMonth() < 11;
    var newMon = notLastMonth ? dt.getMonth() + 1 : 0;
  
    var newYr = notLastMonth ? dt.getFullYear() : dt.getFullYear() + 1;
  
    dt.setMonth(newMon);
    dt.setYear(newYr);
  
    let month = dt.toLocaleString("default", { month: "long" });
  
    $("#datepicker1").html("Planning Month - " + month + " " + newYr);
  }
});
  