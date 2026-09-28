import pdfParse from "pdf-parse";
console.log(typeof pdfParse);
if (typeof pdfParse === "function") {
    console.log("It's a function directly imported!");
} else {
    console.log("Keys:", Object.keys(pdfParse));
    console.log("Default:", typeof pdfParse.default);
}
