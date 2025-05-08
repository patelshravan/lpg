export async function generatePDF({ title = "Bot Report", content = "" }) {
    try {
        const doc = new jsPDF();
        doc.setFontSize(16);
        doc.text(title, 20, 20);

        const lines = doc.splitTextToSize(content || "No content provided.", 180);
        doc.text(lines, 20, 40);

        const fileName = `${title.replace(/\s+/g, "_").toLowerCase()}.pdf`;
        doc.save(fileName);

        return `✅ PDF "${fileName}" generated and downloaded.`;
    } catch (err) {
        console.error("❌ PDF Generation Error:", err);
        return "Failed to generate PDF.";
    }
}
