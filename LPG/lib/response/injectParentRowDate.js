const fs = require("fs");
const path = require("path");

// Load original file
const inputPath = path.join(__dirname, "lifting-amendment.json");
const outputPath = path.join(__dirname, "lifting-amendment-updated.json");

const data = JSON.parse(fs.readFileSync(inputPath, "utf-8"));

// Inject parentRowDate into each detail
data.liftingAmendment.forEach((row) => {
  const rowDate = Number(row.date);
  if (Array.isArray(row.details)) {
    row.details.forEach((detail) => {
      detail.parentRowDate = rowDate;
    });
  }
});

// Save updated file
fs.writeFileSync(outputPath, JSON.stringify(data, null, 2), "utf-8");
console.log("✅ parentRowDate injected. Output saved to lifting-amendment-updated.json");
